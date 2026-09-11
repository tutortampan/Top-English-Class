const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xuiszvwfjccvucqpactf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: levels } = await sb.from('levels').select('*');
  const { data: subjects } = await sb.from('subjects').select('*');
  
  console.log("Subjects:");
  subjects.forEach(s => console.log(s.name, s.id));
  console.log("Levels:");
  levels.forEach(l => console.log(l.name, l.level_number, l.subject_id, l.deleted_at));
}
check();
