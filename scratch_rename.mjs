import fs from 'fs';

const tomlContent = fs.readFileSync('d:/TopsCore/supabase/config.toml', 'utf8');
const projectRefMatch = tomlContent.match(/project_id = "([^"]+)"/);
if (!projectRefMatch) {
  console.log('Cannot find project_id');
  process.exit(1);
}
const url = `https://${projectRefMatch[1]}.supabase.co`;

const envContent = fs.readFileSync('d:/TopsCore/.env', 'utf8');
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
if (!keyMatch) {
  console.log('Cannot find service role key');
  process.exit(1);
}
const key = keyMatch[1];

async function query(table, method, body, filters) {
  let endpoint = `${url}/rest/v1/${table}`;
  if (filters) {
    endpoint += '?' + filters;
  }
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Prefer'] = 'return=representation';
  }
  const res = await fetch(endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function run() {
  const levels = await query('levels', 'GET', null, 'select=*');
  if (!levels) return console.log('No levels found');
  
  for (const lvl of levels) {
    const expectedName = `Vocabulary Mastery ${lvl.level_number}`;
    console.log(`Updating level ${lvl.level_number} classes to ${expectedName}`);
    
    try {
      const updated = await query('classes', 'PATCH', { name: expectedName }, `level_id=eq.${lvl.id}&name=eq.Vocabulary Mastery`);
      console.log(`Updated ${updated.length} rows`);
    } catch (e) {
      console.error(e);
    }
  }
}
run();
