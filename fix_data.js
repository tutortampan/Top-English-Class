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

async function fixData() {
  try {
    console.log("1. Checking for Classes with NULL level_id...");
    const classes = await fetchSupabase('classes', 'GET', null, 'select=id,name,level_id&level_id=is.null');
    console.log(`Found ${classes.length} classes with NULL level_id.`);

    if (classes.length > 0) {
      console.log("Fetching available levels to assign...");
      const levels = await fetchSupabase('levels', 'GET', null, 'select=id,name,level_number&order=level_number.asc&limit=1');
      if (levels.length === 0) {
        console.log("No levels found. Cannot fix classes automatically.");
      } else {
        const defaultLevelId = levels[0].id;
        console.log(`Assigning classes to default level: ${levels[0].name} (ID: ${defaultLevelId})`);
        
        // Patch classes
        const patchRes = await fetchSupabase('classes', 'PATCH', { level_id: defaultLevelId }, 'level_id=is.null');
        console.log(`Updated classes.`);
      }
    }

    console.log("\n2. Checking for Duplicate Assessments (Camp 131 issue)...");
    const assessments = await fetchSupabase('assessments', 'GET', null, 'select=id,title,class_id,level_id,created_at');
    
    // Find duplicates
    const assessmentMap = {};
    const duplicates = [];
    for (const a of assessments) {
      const key = `${a.title}_${a.class_id}_${a.level_id}`;
      if (assessmentMap[key]) {
        duplicates.push(a);
      } else {
        assessmentMap[key] = true;
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate assessments.`);
    for (const d of duplicates) {
      console.log(`- Deleting duplicate assessment: ${d.title} (ID: ${d.id})`);
      // Delete duplicate
      // Wait, let's just mark it as deleted_at or DELETE it?
      // For assessments, there might be constraints, but let's try a DELETE
      await fetchSupabase('assessments', 'DELETE', null, `id=eq.${d.id}`);
      console.log(`  Deleted.`);
    }

    console.log("\nAll automated fixes complete!");
  } catch (err) {
    console.error("Error running fix script:", err);
  }
}

fixData();
