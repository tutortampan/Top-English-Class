const url = 'https://xuiszvwfjccvucqpactf.supabase.co';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

async function fix() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  const resLevels = await fetch(`${url}/rest/v1/levels?select=id&order=level_number.asc&limit=1`, { headers });
  const levels = await resLevels.json();
  if (!levels || levels.length === 0) {
    console.log('No levels found');
    return;
  }
  const defaultLevelId = levels[0].id;
  console.log('Default Level ID:', defaultLevelId);

  const resClasses = await fetch(`${url}/rest/v1/classes?level_id=is.null&select=id,name`, { headers });
  const classes = await resClasses.json();
  
  if (!classes || classes.length === 0) {
    console.log('No classes with null level_id.');
    return;
  }
  console.log(`Found ${classes.length} classes to fix.`);
  
  for (const cls of classes) {
    console.log('Updating class:', cls.name);
    await fetch(`${url}/rest/v1/classes?id=eq.${cls.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ level_id: defaultLevelId })
    });
  }
  console.log('Done!');
}
fix().catch(console.error);
