const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);
const serviceClient = createClient(supabaseUrl, serviceRoleKey);

async function testRpc() {
  console.log("=== Testing RPC Permissions ===");
  
  // 1. Create a dummy user to test authenticated access
  const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
    email_confirm: true
  });
  if (authErr) throw authErr;
  const user = authData.user;
  
  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: user.email,
    password: 'password123'
  });
  if (signInErr) throw signInErr;
  
  const authenticatedClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`
      }
    }
  });

  // 2. Test anon access (should fail)
  const { data: anonData, error: anonErr } = await anonClient.rpc('get_leaderboard_reference_members');
  if (anonErr) {
    console.log("Anon execution error (expected):", anonErr.message);
  } else {
    console.log("Anon execution SUCCESS? (bad)", anonData);
    console.error("ERROR: anon should not be able to execute RPC");
  }

  // 3. Test authenticated access (should fail)
  const { data: authRpcData, error: authRpcErr } = await authenticatedClient.rpc('get_leaderboard_reference_members');
  if (authRpcErr) {
    console.log("Auth execution error (expected):", authRpcErr.message);
  } else {
    console.error("ERROR: auth should not be able to execute RPC. Returned data:", authRpcData);
  }

  // 4. Test service_role access (should succeed)
  const { data: serviceRpcData, error: serviceRpcErr } = await serviceClient.rpc('get_leaderboard_reference_members');
  if (serviceRpcErr) {
    console.error("Service execution error:", serviceRpcErr.message);
  } else {
    console.log(`Service execution SUCCESS. Returned ${serviceRpcData.length} rows.`);
    console.log("Rows returned:", serviceRpcData.map(r => r.release_member_code));
  }

  // 5. Test direct SELECT access to rapor_members (should return 0 rows for authenticated)
  const { data: selectData, error: selectErr } = await authenticatedClient.from('rapor_members').select('*');
  if (selectErr) {
    console.error("Direct SELECT error:", selectErr.message);
  } else {
    console.log(`Direct SELECT on rapor_members returned ${selectData.length} rows (expected 0 due to RLS).`);
  }

  console.log("=== Test Complete ===");
}

testRpc().catch(console.error);
