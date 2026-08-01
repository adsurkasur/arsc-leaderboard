"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

// 5. Read the remote secret from a server-only environment variable with no NEXT_PUBLIC_ prefix
// We use process.env.SUPABASE_INTEGRATION_SERVICE_KEY as instructed.
const INTEGRATION_KEY = process.env.SUPABASE_INTEGRATION_SERVICE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function syncRaporMembers() {
  if (!SUPABASE_URL || !INTEGRATION_KEY) {
    return { success: false, error: "Missing server-only integration configuration." };
  }

  // 1. Create the normal cookie-aware server Supabase client.
  const userClient = await createClient();

  // 2. Call auth.getUser() to resolve the verified current user.
  const { data: { user }, error: userErr } = await userClient.auth.getUser();

  // 3. Reject missing or invalid users.
  if (userErr || !user) {
    return { success: false, error: "Unauthorized: Missing or invalid authenticated session." };
  }

  // In this project's authorization model, isAdmin is checked via the 'user_roles' table.
  const { data: adminData, error: profileErr } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (profileErr || !adminData) {
    return { success: false, error: "Forbidden: Requires Leaderboard admin role." };
  }

  // 6. Only after successful authorization, create a separate integration client using SUPABASE_INTEGRATION_SERVICE_KEY.
  const integrationClient = createSupabaseClient(SUPABASE_URL, INTEGRATION_KEY);

  const { data: remoteData, error: rpcError } = await integrationClient.rpc("get_leaderboard_reference_members");

  if (rpcError) {
    console.error("Integration RPC Error:", rpcError);
    // 8. Preserve snapshot fallback and reconciliation behavior.
    return await handleSnapshotFallback(integrationClient);
  }

  if (!remoteData || remoteData.length === 0) {
    return { success: true, message: "No active/published members returned from RPC.", report: null };
  }

  // 7. Never return, log, or expose the secret.
  return await processSync(remoteData, integrationClient);
}

import { SupabaseClient } from "@supabase/supabase-js";

async function handleSnapshotFallback(integrationClient: SupabaseClient) {
  console.log("Falling back to local snapshot due to remote failure...");
  try {
    const snapshotPath = path.join(process.cwd(), ".data", "MINIMIZED_CONFIDENTIAL_SNAPSHOT.json");
    if (!fs.existsSync(snapshotPath)) {
      return { success: false, error: "Remote RPC failed and local snapshot not found." };
    }
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    const data = snapshot.members.map((m: Record<string, unknown>) => ({
      release_member_code: m.release_member_code,
      release_code: m.release_code,
      canonical_name: m.canonical_name,
      unit: m.unit,
      position: m.position,
    }));
    return await processSync(data, integrationClient);
  } catch (err: unknown) {
    return { success: false, error: `Snapshot fallback failed: ${(err as Error).message}` };
  }
}

async function processSync(remoteData: Record<string, unknown>[], integrationClient: SupabaseClient) {
  const newIdentities = 0;
  let linkedIdentities = 0;
  let ambiguous = 0;
  const reconciliationErrors: string[] = [];
  
  const { data: existingMembers, error: membersErr } = await integrationClient.from("members").select("*");
  if (membersErr) throw membersErr;
  
  const { data: existingLinks, error: linksErr } = await integrationClient.from("member_release_links").select("*");
  if (linksErr) throw linksErr;

  const membersByName = new Map<string, Record<string, unknown>[]>();
  for (const m of existingMembers) {
    const arr = membersByName.get(m.canonical_name as string) || [];
    arr.push(m);
    membersByName.set(m.canonical_name as string, arr);
  }

  const linksByReleaseCode = new Map<string, Record<string, unknown>>();
  for (const l of existingLinks) {
    linksByReleaseCode.set(l.release_member_code as string, l);
  }

  for (const row of remoteData) {
    const release_member_code = row.release_member_code as string;
    const release_code = row.release_code as string;
    const canonical_name = row.canonical_name as string;
    const unit = row.unit as string;
    const position = row.position as string;

    if (linksByReleaseCode.has(release_member_code)) {
      continue;
    }

    const possibleMatches = membersByName.get(canonical_name) || [];
    
    let stableMemberId = null;

    if (possibleMatches.length === 1) {
      stableMemberId = possibleMatches[0].member_id;
      linkedIdentities++;
    } else if (possibleMatches.length > 1) {
      ambiguous++;
      reconciliationErrors.push(`Ambiguous identity for ${canonical_name}: multiple stable members found.`);
      continue;
    } else {
      reconciliationErrors.push(`Unmatched identity for ${canonical_name}: not found in stable members.`);
      continue;
    }

    if (stableMemberId) {
      const { error: insertErr } = await integrationClient.from("member_release_links").insert({
        member_id: stableMemberId,
        release_member_code,
        release_code,
        unit,
        position,
      });
      if (insertErr) {
        reconciliationErrors.push(`Failed to insert link for ${release_member_code}: ${insertErr.message}`);
      }
    }
  }

  const report = {
    processed: remoteData.length,
    newIdentities,
    linkedIdentities,
    ambiguous,
    reconciliationErrors,
  };

  return { success: true, report };
}
