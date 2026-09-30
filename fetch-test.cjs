const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
  const [inst, prog, lvl, cls] = await Promise.all([
    fetch(url + '/rest/v1/institutions?select=*', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(r=>r.json()),
    fetch(url + '/rest/v1/programs?select=*', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(r=>r.json()),
    fetch(url + '/rest/v1/levels?select=*', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(r=>r.json()),
    fetch(url + '/rest/v1/classes?select=*', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(r=>r.json())
  ]);
  console.log('INSTITUTIONS:', JSON.stringify(inst, null, 2));
  console.log('PROGRAMS:', JSON.stringify(prog, null, 2));
  console.log('LEVELS:', JSON.stringify(lvl, null, 2));
  console.log('CLASSES:', JSON.stringify(cls, null, 2));
}
run();
