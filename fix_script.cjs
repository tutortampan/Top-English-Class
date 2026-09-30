const fs = require('fs');
let content = fs.readFileSync('supabase/functions/start-assessment/index.ts', 'utf-8');

content = content.replace('is_remedial_unlocked', '');

content = content.replace(/const \{ count: pastAttempts \}[^;]+;/s, 
  `const { data: pastAttemptsData } = await supabase
      .from("attempts")
      .select("id, status, is_remedial_unlocked, created_at")
      .eq("student_id", student_id)
      .or(\`assessment_id.eq.\${assessment_id},Assessment_id.eq.\${assessment_id}\`)
      .in("status", ["submitted", "auto_submitted", "evaluated", "SUBMITTED", "AUTO_SUBMITTED", "EVALUATED"])
      .order("created_at", { ascending: false });`
);

content = content.replace(/const attemptCount = pastAttempts \|\| 0;/, 
  'const attemptCount = pastAttemptsData?.length || 0;'
);

content = content.replace(/if \(!student\.is_remedial_unlocked\)/, 
  'const mostRecentAttempt = pastAttemptsData?.[0];\n      if (!mostRecentAttempt?.is_remedial_unlocked)'
);

fs.writeFileSync('supabase/functions/start-assessment/index.ts', content);
console.log('Fixed');
