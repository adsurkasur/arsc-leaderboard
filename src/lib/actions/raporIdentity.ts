'use server';

import { createClient as createIntegrationClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hashRaporAccessCode, normalizeRaporUnit } from '@/lib/rapor/identity';

type RaporReference = {
  release_member_code: string;
  release_code: string;
  canonical_name: string;
  unit: string;
  position: string | null;
};

type LinkedProfile = {
  profile_id: string;
  member_id: string;
  full_name: string;
  bidang_biro: string;
  link_status: 'linked_exact';
};

type IdentityActionResult =
  | { success: true; profile: LinkedProfile }
  | { success: false; error: string };

function getIntegrationConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
  const pepper = process.env.RAPOR_ACCESS_CODE_PEPPER;

  if (!url || !serviceKey || !pepper) {
    return null;
  }

  return { url, serviceKey, pepper };
}

function isLinkedProfile(value: unknown): value is LinkedProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return typeof profile.profile_id === 'string'
    && typeof profile.member_id === 'string'
    && typeof profile.full_name === 'string'
    && typeof profile.bidang_biro === 'string'
    && profile.link_status === 'linked_exact';
}

async function getCurrentUserId(): Promise<string | null> {
  const userClient = await createClient();
  const { data: { user }, error } = await userClient.auth.getUser();
  return error ? null : user?.id ?? null;
}

async function applyReferenceToProfile(
  userId: string,
  reference: RaporReference,
  url: string,
  serviceKey: string,
): Promise<IdentityActionResult> {
  if (!normalizeRaporUnit(reference.unit)) {
    return { success: false, error: 'Bidang atau biro dari Rapor belum didukung oleh Leaderboard.' };
  }

  const integrationClient = createIntegrationClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await integrationClient.rpc('link_arsc_account_from_reference', {
    p_user_id: userId,
    p_release_member_code: reference.release_member_code,
    p_release_code: reference.release_code,
    p_canonical_name: reference.canonical_name,
    p_unit: reference.unit,
    p_position: reference.position,
  });

  if (error || !isLinkedProfile(data)) {
    return {
      success: false,
      error: error?.message || 'Identitas Rapor belum dapat ditautkan. Coba lagi atau minta admin memeriksa data integrasi.',
    };
  }

  revalidatePath('/');
  return { success: true, profile: data };
}

export async function linkProfileWithRaporCode(accessCode: string): Promise<IdentityActionResult> {
  const normalizedCode = accessCode.trim();
  if (!normalizedCode || normalizedCode.length > 200) {
    return { success: false, error: 'Masukkan kode akses Rapor yang valid.' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: 'Sesi Anda sudah berakhir. Silakan masuk kembali.' };
  }

  const config = getIntegrationConfig();
  if (!config) {
    return { success: false, error: 'Integrasi Rapor belum dikonfigurasi di server.' };
  }

  const integrationClient = createIntegrationClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const accessCodeHash = hashRaporAccessCode(normalizedCode, config.pepper);

  const { data: codeRow, error: codeError } = await integrationClient
    .from('rapor_access_codes')
    .select('member_code, release_code')
    .eq('access_code_hash', accessCodeHash)
    .maybeSingle();

  if (codeError || !codeRow) {
    return { success: false, error: 'Kode akses tidak cocok dengan Rapor aktif.' };
  }

  const { data: memberRow, error: memberError } = await integrationClient
    .from('rapor_members')
    .select('member_code, release_code, name, unit, jabatan')
    .eq('member_code', codeRow.member_code)
    .eq('release_code', codeRow.release_code)
    .maybeSingle();

  if (memberError || !memberRow) {
    return { success: false, error: 'Data anggota untuk kode Rapor ini tidak tersedia.' };
  }

  return applyReferenceToProfile(userId, {
    release_member_code: memberRow.member_code,
    release_code: memberRow.release_code,
    canonical_name: memberRow.name,
    unit: memberRow.unit,
    position: memberRow.jabatan,
  }, config.url, config.serviceKey);
}

export async function refreshProfileFromRapor(): Promise<IdentityActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: 'Sesi Anda sudah berakhir. Silakan masuk kembali.' };
  }

  const config = getIntegrationConfig();
  if (!config) {
    return { success: false, error: 'Integrasi Rapor belum dikonfigurasi di server.' };
  }

  const integrationClient = createIntegrationClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await integrationClient
    .from('profiles')
    .select('member_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.member_id) {
    return { success: false, error: 'Profil ini belum terhubung ke identitas Rapor.' };
  }

  const { data: links, error: linksError } = await integrationClient
    .from('member_release_links')
    .select('release_member_code, release_code')
    .eq('member_id', profile.member_id);

  const { data: activeReferences, error: referenceError } = await integrationClient
    .rpc('get_leaderboard_reference_members');

  if (linksError || referenceError || !links || !activeReferences) {
    return { success: false, error: 'Referensi Rapor aktif belum dapat dibaca.' };
  }

  const linkKeys = new Set(links.map((link) => `${link.release_code}:${link.release_member_code}`));
  const activeReference = (activeReferences as RaporReference[]).find((reference) =>
    linkKeys.has(`${reference.release_code}:${reference.release_member_code}`),
  );

  if (!activeReference) {
    return { success: false, error: 'Belum ada rilis Rapor aktif yang tertaut. Gunakan kode akses rilis terbaru.' };
  }

  return applyReferenceToProfile(userId, activeReference, config.url, config.serviceKey);
}

export async function updateProfileAvatar(avatarUrl: string | null) {
  const userClient = await createClient();
  const { data: { user }, error: userError } = await userClient.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Sesi Anda sudah berakhir. Silakan masuk kembali.' };
  }

  const normalizedUrl = avatarUrl?.trim() || null;
  if (normalizedUrl) {
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'https:') throw new Error('invalid protocol');
    } catch {
      return { success: false, error: 'URL foto profil harus berupa tautan HTTPS yang valid.' };
    }
  }

  const { error: haloError } = await userClient
    .from('users')
    .update({ avatar_url: normalizedUrl })
    .eq('id', user.id);

  if (haloError) {
    return { success: false, error: `Foto profil Halo PSDM belum dapat diperbarui: ${haloError.message}` };
  }

  const { error: leaderboardError } = await userClient
    .from('profiles')
    .update({ avatar_url: normalizedUrl })
    .eq('user_id', user.id);

  if (leaderboardError) {
    return {
      success: false,
      error: `Foto tersimpan di Halo PSDM, tetapi salinan Leaderboard belum tersinkron: ${leaderboardError.message}`,
    };
  }

  revalidatePath('/');
  return { success: true };
}
