const url = 'https://xuiszvwfjccvucqpactf.supabase.co';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';
async function run() {
  const res = await fetch(`${url}/rest/v1/classes?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log(await res.json());
}
run();
