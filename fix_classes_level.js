import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixClasses() {
  console.log('Fetching levels...');
  const { data: levels, error: levelsErr } = await supabase.from('levels').select('id').order('level_number', { ascending: true }).limit(1);
  
  if (levelsErr) {
    console.error('Error fetching levels:', levelsErr);
    return;
  }
  if (!levels || levels.length === 0) {
    console.log('No levels found, cannot fix classes.');
    return;
  }
  
  const defaultLevelId = levels[0].id;
  console.log('Using default level_id:', defaultLevelId);

  console.log('Fetching classes with null level_id...');
  const { data: classes, error: classesErr } = await supabase.from('classes').select('id, name').is('level_id', null);

  if (classesErr) {
    console.error('Error fetching classes:', classesErr);
    return;
  }

  if (!classes || classes.length === 0) {
    console.log('No classes with null level_id found.');
    return;
  }

  console.log(`Found ${classes.length} classes to fix.`);
  
  const updates = classes.map(c => ({
    id: c.id,
    level_id: defaultLevelId
  }));

  const { error: updateErr } = await supabase.from('classes').upsert(updates);
  if (updateErr) {
    console.error('Error updating classes:', updateErr);
  } else {
    console.log('Successfully fixed classes!');
  }
}

fixClasses();
