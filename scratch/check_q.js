
import { testSupabaseConnection } from './js/api.js';
async function run() {
  const supabase = await testSupabaseConnection();
  const { data, error } = await supabase.from('questions').select('*').limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();

