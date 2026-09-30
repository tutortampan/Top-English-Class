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

async function testApi() {
  const students = await fetchSupabase('students', 'GET', null, 'select=id,name,batch_id');
  if(students.length === 0) return console.log("no students");
  const s = students[0];
  console.log("Checking student:", s);

  const data = await fetchSupabase('students', 'GET', null, 'select=batch_id,batches:batch_id(current_level_id,levels:current_level_id(id,level_number,name))&id=eq.' + s.id);
  console.log("Student with level data:", JSON.stringify(data, null, 2));
}

testApi();
