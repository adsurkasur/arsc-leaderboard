import { createClient } from '@supabase/supabase-js';

async function runTests() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const anonClient = createClient(supabaseUrl, supabaseKey);

  console.log("\n--- 1. Authentication & Role Creation ---");
  const memberEmail = `member_${Date.now()}@example.com`;
  const adminEmail = `admin_${Date.now()}@example.com`;
  const password = "password123";

  // Create Synthetic Member
  const { data: memberData, error: memberErr } = await anonClient.auth.signUp({
    email: memberEmail,
    password,
    options: { data: { full_name: "Test Member", bidang_biro: "IT" } }
  });
  if (memberErr) throw memberErr;
  console.log("Created Synthetic Member auth user:", memberData.user.id);

  await new Promise(r => setTimeout(r, 1000));

  // Verify Profile was auto-created and has member_id
  const { data: profData, error: profErr } = await supabaseAdmin.from('profiles').select('*').eq('user_id', memberData.user.id);
  if (profErr || profData.length === 0) {
      console.error("FAILURE: Profile not auto-created by trigger.", profErr);
  } else {
      console.log("SUCCESS: Profile auto-created. member_id:", profData[0].member_id);
  }
  const memberProfileId = profData[0].id;
  const canonicalMemberId = profData[0].member_id;

  // Create Synthetic Admin
  const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true
  });
  if (adminErr) throw adminErr;
  
  const { error: setAdminErr } = await supabaseAdmin.from('user_roles').insert([
      { user_id: adminData.user.id, role: 'admin' }
  ]);
  if (setAdminErr) console.error("Failed to assign admin role:", setAdminErr);
  else console.log("Assigned Admin role successfully.");

  const memberClient = createClient(supabaseUrl, supabaseKey);
  await memberClient.auth.signInWithPassword({ email: memberEmail, password });
  
  const adminClient = createClient(supabaseUrl, supabaseKey);
  await adminClient.auth.signInWithPassword({ email: adminEmail, password });

  console.log("\n--- 2. Member Submission Flow (Verification Requests) ---");
  const { data: compData, error: compErr } = await adminClient.from('competitions').insert([
      { title: "Rapor Test Comp", date: "2026-07-28" }
  ]).select('*');
  if (compErr) throw compErr;
  const compId = compData[0].id;

  // Member submits request with Rapor fields
  const { data: reqData, error: reqErr } = await memberClient.from('verification_requests').insert([
      { 
          profile_id: memberProfileId, 
          competition_id: compId, 
          message: "My submission",
          achievement: "Juara 1",
          evidence_url: "https://example.com/certificate.pdf"
      }
  ]).select('*');

  if (reqErr) {
      console.error("FAILURE: Member failed to submit request.", reqErr);
  } else {
      console.log("SUCCESS: Member submitted request with evidence_url and achievement.", reqData[0].id);
  }
  const requestId = reqData[0].id;

  console.log("\n--- 3. Unauthorized Admin Access ---");
  const { error: hackErr } = await memberClient.from('verification_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
  
  if (hackErr) {
      console.log("SUCCESS: Member correctly blocked from approving requests.");
  } else {
      console.log("FAILURE (VULNERABILITY): Member approved their own request!");
  }

  console.log("\n--- 4. Admin Approval & Triggers ---");
  // Admin approves request
  const { error: approveErr } = await adminClient.from('verification_requests')
      .update({ 
          status: 'approved', 
          reviewer_id: adminData.user.id,
          reviewer_notes: "Looks good"
      })
      .eq('id', requestId);
  
  if (approveErr) {
      console.log("Admin failed to update request:", approveErr);
  } else {
      console.log("Admin successfully updated request status and audit fields.");
  }

  // Admin inserts into participation_logs with Rapor fields
  const { data: partData, error: partErr } = await adminClient.from('participation_logs').insert([
      { 
          profile_id: memberProfileId, 
          competition_id: compId, 
          admin_id: adminData.user.id,
          achievement: "Juara 1",
          evidence_url: "https://example.com/certificate.pdf",
          participation_date: "2026-07-28"
      }
  ]).select('*');

  if (partErr) {
      console.log("Admin failed to insert participation log:", partErr.message);
  } else {
      console.log("Admin successfully inserted participation log.");
      
      const { data: checkProfile } = await supabaseAdmin.from('profiles').select('total_participation_count').eq('id', memberProfileId);
      console.log("Participation Count Trigger Check -> New count:", checkProfile[0].total_participation_count, "(Expected: 1)");
      
      console.log("\n--- 5. Duplicate Handling ---");
      const { error: dupErr } = await adminClient.from('participation_logs').insert([
          { profile_id: memberProfileId, competition_id: compId, admin_id: adminData.user.id }
      ]);
      if (dupErr) {
          console.log("SUCCESS: Duplicate participation log correctly blocked by UNIQUE constraint.");
      } else {
          console.log("FAILURE: Duplicate insertion allowed.");
      }
  }

  console.log("\n=== Stage 1 Validation Completed ===");
}

runTests().catch(console.error);
