import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envStr = fs.readFileSync('.env.example', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envStr.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});
const sb = createClient(supabaseUrl, supabaseKey);
async function run() {
  const { data, error } = await sb.from('classes').select('id, name, code, description').eq('is_active', true).is('deleted_at', null);
  console.log('Classes:', data);
  console.log('Error:', error);
}
run();
