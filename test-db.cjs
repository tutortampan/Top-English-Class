const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const sb = createClient(url, key);

async function run() {
  const [inst, prog, lvl, cls] = await Promise.all([
    sb.from('institutions').select('*'),
    sb.from('programs').select('*'),
    sb.from('levels').select('*'),
    sb.from('classes').select('*')
  ]);
  console.log('INSTITUTIONS:', JSON.stringify(inst.data, null, 2));
  console.log('PROGRAMS:', JSON.stringify(prog.data, null, 2));
  console.log('LEVELS:', JSON.stringify(lvl.data, null, 2));
  console.log('CLASSES:', JSON.stringify(cls.data, null, 2));
}
run();
