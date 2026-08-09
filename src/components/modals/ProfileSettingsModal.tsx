'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ImageIcon, Info, Loader2, RefreshCw, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/lib/types';
import type { Tables } from '@/integrations/supabase/types';
import { User } from '@supabase/supabase-js';
import { RaporLinkForm } from '@/components/profile/RaporLinkForm';
import { refreshProfileFromRapor, updateProfileAvatar } from '@/lib/actions/raporIdentity';
import { accountUsesRapor, formatHaloPosition, formatHaloUnit } from '@/lib/sharedProfile';

type HaloProfile = Pick<
  Tables<'users'>,
  'id' | 'name' | 'biro' | 'jabatan' | 'role' | 'avatar_url'
>;

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onProfileChanged?: () => void | Promise<void>;
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  user,
  onProfileChanged,
}: ProfileSettingsModalProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [haloProfile, setHaloProfile] = useState<HaloProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    setIsLoadingProfile(true);
    setLoadError(null);
    const [profileResult, haloResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('users')
        .select('id, name, biro, jabatan, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const leaderboardProfile = profileResult.error ? null : profileResult.data;
    const sharedProfile = haloResult.error ? null : haloResult.data;

    setProfile(leaderboardProfile);
    setHaloProfile(sharedProfile);
    setAvatarUrl(sharedProfile?.avatar_url || leaderboardProfile?.avatar_url || '');

    if (!leaderboardProfile && !sharedProfile) {
      setLoadError(
        profileResult.error?.message
          || haloResult.error?.message
          || 'Profil akun belum tersedia di Halo PSDM maupun Leaderboard.',
      );
    }
    setIsLoadingProfile(false);
  }, [user]);

  useEffect(() => {
    if (open && user) void fetchUserProfile();
  }, [open, user, fetchUserProfile]);

  const handleSaveAvatar = async () => {
    if (!profile && !haloProfile) {
      toast({ title: 'Profil belum siap', description: loadError || 'Muat ulang profil lalu coba lagi.', variant: 'destructive' });
      return;
    }

    setIsSavingAvatar(true);
    const result = await updateProfileAvatar(avatarUrl || null);
    setIsSavingAvatar(false);

    if (!result.success) {
      toast({
        title: 'Foto belum tersimpan',
        description: 'error' in result ? result.error : 'Perubahan belum dapat disimpan.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Foto profil diperbarui', description: 'Perubahan tersimpan di profil akun ARSC.' });
    await fetchUserProfile();
    await onProfileChanged?.();
  };

  const handleRefreshIdentity = async () => {
    setIsRefreshing(true);
    const result = await refreshProfileFromRapor();
    setIsRefreshing(false);

    if (!result.success) {
      toast({
        title: 'Belum dapat disinkronkan',
        description: 'error' in result ? result.error : 'Integrasi Rapor belum dapat digunakan.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Data Rapor diperbarui', description: 'Nama dan bidang/biro sudah memakai rilis aktif.' });
    await fetchUserProfile();
    await onProfileChanged?.();
  };

  const isLinked = profile?.link_status === 'linked_exact' || profile?.link_status === 'manually_linked';
  const usesRapor = accountUsesRapor(haloProfile?.role);
  const displayName = isLinked
    ? profile?.full_name || haloProfile?.name || user?.email || 'Akun ARSC'
    : haloProfile?.name || profile?.full_name || user?.email || 'Akun ARSC';
  const displayUnit = isLinked
    ? profile?.bidang_biro || formatHaloUnit(haloProfile?.biro) || 'Belum tersinkron dari Rapor'
    : formatHaloUnit(haloProfile?.biro) || profile?.bidang_biro || 'Belum diatur di Halo PSDM';
  const displayPosition = formatHaloPosition(haloProfile?.jabatan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <div className="space-y-6">
          <DialogHeader className="space-y-2 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              Profil akun
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Data akun berasal dari Halo PSDM. Identitas Rapor ditambahkan untuk anggota yang memilikinya.
            </DialogDescription>
          </DialogHeader>

          {isLoadingProfile ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Memuat profil…
            </div>
          ) : loadError ? (
            <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="space-y-2">
                <p className="font-medium text-destructive">Profil belum dapat dimuat</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{loadError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUserProfile}>
                Coba lagi
              </Button>
            </div>
          ) : profile || haloProfile ? (
            <div className="space-y-5">
            <section className="rounded-2xl border bg-muted/25 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{isLinked ? 'Identitas Rapor' : 'Profil Halo PSDM'}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {isLinked ? 'Nama dan unit mengikuti Rapor ARSC aktif.' : 'Profil dasar yang digunakan bersama oleh aplikasi ARSC.'}
                  </p>
                </div>
                {isLinked ? (
                  <Badge variant="outline" className="gap-1.5 border-success/25 bg-success/10 text-success">
                    <CheckCircle2 className="size-3.5" />
                    Terhubung
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/5 text-primary">
                    <CheckCircle2 className="size-3.5" />
                    Halo PSDM
                  </Badge>
                )}
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-fullname">Nama lengkap</Label>
                  <Input id="profile-fullname" value={displayName} readOnly className="bg-background/70" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-bidangbiro">Bidang/Biro</Label>
                  <Input
                    id="profile-bidangbiro"
                    value={displayUnit}
                    readOnly
                    className="bg-background/70"
                  />
                </div>
                {displayPosition && (
                  <div className="space-y-2">
                    <Label htmlFor="profile-position">Jabatan</Label>
                    <Input id="profile-position" value={displayPosition} readOnly className="bg-background/70" />
                  </div>
                )}
              </div>

              {isLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 -ml-2 gap-2 text-primary"
                  onClick={handleRefreshIdentity}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Sinkronkan dari Rapor aktif
                </Button>
              )}
            </section>

            {!isLinked && usesRapor && (
              <RaporLinkForm
                onLinked={async (linkedProfile) => {
                  setProfile((current) => current ? {
                    ...current,
                    full_name: linkedProfile.full_name,
                    bidang_biro: linkedProfile.bidang_biro,
                    member_id: linkedProfile.member_id,
                    link_status: linkedProfile.link_status,
                  } : current);
                  await fetchUserProfile();
                  await onProfileChanged?.();
                }}
              />
            )}

            {!isLinked && !usesRapor && (
              <section className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Info className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Tidak memerlukan identitas Rapor</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Akun PH memakai profil Halo PSDM dan tetap dapat menggunakan fitur akun tanpa memasukkan kode Rapor.
                  </p>
                </div>
              </section>
            )}

            <section className="space-y-3 rounded-2xl border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Foto profil</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Opsional. Gunakan tautan gambar HTTPS yang dapat diakses publik.
                  </p>
                </div>
              </div>
              <Input
                id="profile-avatar"
                type="url"
                placeholder="https://…"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                disabled={isSavingAvatar}
              />
              <Button variant="secondary" onClick={handleSaveAvatar} disabled={isSavingAvatar} className="gap-2">
                {isSavingAvatar && <Loader2 className="size-4 animate-spin" />}
                Simpan foto
              </Button>
            </section>
            </div>
          ) : null}

          <DialogFooter className="pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
