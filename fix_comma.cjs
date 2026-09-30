const fs = require('fs');
let content = fs.readFileSync('supabase/functions/start-assessment/index.ts', 'utf-8');
content = content.replace('is_active, "', 'is_active"');
fs.writeFileSync('supabase/functions/start-assessment/index.ts', content);
