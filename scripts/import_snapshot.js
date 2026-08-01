import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Setup basic environment variables if run directly with --env-file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Cannot run admin import.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function importSnapshot() {
  const snapshotPath = process.argv[2] || path.join(process.cwd(), '.data', 'MINIMIZED_CONFIDENTIAL_SNAPSHOT.json');
  
  if (!fs.existsSync(snapshotPath)) {
    console.error(`Snapshot file not found: ${snapshotPath}`);
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  console.log(`Starting import for release: ${snapshot.release_code} (${snapshot.members.length} members)`);

  const report = {
    total: snapshot.members.length,
    upserted_members: 0,
    upserted_links: 0,
    linked_exact: 0,
    unmatched: 0,
    ambiguous: 0,
    errors: []
  };

  for (const m of snapshot.members) {
    try {
      // 1. Upsert Canonical Member
      const { error: memberError } = await supabase
        .from('members')
        .upsert({
          id: m.member_id,
          canonical_name: m.canonical_name
        }, { onConflict: 'id' });

      if (memberError) throw new Error(`Member upsert failed for ${m.canonical_name}: ${memberError.message}`);
      report.upserted_members++;

      // 2. Upsert Member Release Link
      const { error: linkError } = await supabase
        .from('member_release_links')
        .upsert({
          member_id: m.member_id,
          release_code: m.release_code,
          release_member_code: m.release_member_code,
          unit: m.unit,
          position: m.position,
          evaluation_status: m.evaluation_status
        }, { onConflict: 'member_id, release_code' });

      if (linkError) throw new Error(`Link upsert failed for ${m.canonical_name}: ${linkError.message}`);
      report.upserted_links++;

      // 3. Reconcile Profiles
      // Find profiles matching the canonical name
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, member_id')
        .ilike('full_name', m.canonical_name);

      if (profError) throw new Error(`Profile search failed: ${profError.message}`);

      if (profiles.length === 1) {
        const p = profiles[0];
        if (p.member_id === m.member_id) {
          // Already linked correctly
          report.linked_exact++;
        } else if (p.member_id === null) {
          // Unlinked, link it
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ member_id: m.member_id, link_status: 'linked_exact' })
            .eq('id', p.id);
            
          if (updateError) throw new Error(`Profile link failed: ${updateError.message}`);
          report.linked_exact++;
        } else {
          // Profile is linked to someone else? That's an anomaly.
          report.ambiguous++;
          report.errors.push(`Anomaly: Profile ${p.full_name} is already linked to member_id ${p.member_id}, expected ${m.member_id}`);
        }
      } else if (profiles.length > 1) {
        // Ambiguous match
        report.ambiguous++;
        report.errors.push(`Ambiguous match for ${m.canonical_name}: Found ${profiles.length} profiles.`);
        // Mark all these profiles as ambiguous if they aren't linked yet
        for (const p of profiles) {
          if (p.member_id === null) {
            await supabase.from('profiles').update({ link_status: 'ambiguous' }).eq('id', p.id);
          }
        }
      } else {
        // No match found
        report.unmatched++;
      }

    } catch (e) {
      report.errors.push(e.message);
    }
  }

  console.log('\n--- Reconciliation Report ---');
  console.log(`Total Members Processed: ${report.total}`);
  console.log(`Members Upserted:        ${report.upserted_members}`);
  console.log(`Release Links Upserted:  ${report.upserted_links}`);
  console.log(`Profiles Exactly Linked: ${report.linked_exact}`);
  console.log(`Profiles Unmatched:      ${report.unmatched}`);
  console.log(`Profiles Ambiguous:      ${report.ambiguous}`);
  if (report.errors.length > 0) {
    console.log('\nErrors / Anomalies:');
    report.errors.slice(0, 10).forEach(e => console.log(`- ${e}`));
    if (report.errors.length > 10) console.log(`...and ${report.errors.length - 10} more errors.`);
  }
}

importSnapshot().catch(console.error);
