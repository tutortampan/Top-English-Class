const SUPABASE_URL = 'https://xuiszvwfjccvucqpactf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

async function fetchSupabase(table, method, body, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }
  return res.json();
}

async function debugData() {
  try {
    const batches = await fetchSupabase('batches', 'GET', null, 'select=*');
    console.log(`All batches:`, batches);

    const students = await fetchSupabase('students', 'GET', null, 'select=id,name,batch_id,level_id');
    console.log(`All students (level_id/batch_id):`, students);
  } catch (err) {
    console.error("Error:", err);
  }
}

debugData();
