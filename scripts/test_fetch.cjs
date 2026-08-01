const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function test() {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_leaderboard_reference_members`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}
test();
