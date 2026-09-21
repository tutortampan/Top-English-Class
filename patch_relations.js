const fs = require('fs');
const path = require('path');

// 1. Patch js/api.js short-circuits
const fApi = path.join(__dirname, 'js', 'api.js');
let apiContent = fs.readFileSync(fApi, 'utf8');

const shortCircuit = `
  if (['user_professionals', 'topics', 'question_types', 'class_meetings', 'work_records', 'professional_skills', 'attempts', 'assessment_instances', 'assessments', 'attempt_answers'].includes(normTable)) {
    return JSON.parse(JSON.stringify(MOCK_ADMIN_STORE[normTable] || []));
  }
`;

if (!apiContent.includes("['user_professionals', 'topics'")) {
    apiContent = apiContent.replace(
        /(async\s+function\s+adminFetchAll\s*\([^)]*\)\s*\{\s*)(const\s+normTable\s*=\s*table\.toLowerCase\(\);)/,
        `$1$2${shortCircuit}`
    );
    fs.writeFileSync(fApi, apiContent, 'utf8');
}

// 2. Patch all js/admin/*.js to replace relational joins with '*'
const adminDir = path.join(__dirname, 'js', 'admin');
const files = fs.readdirSync(adminDir);

for (const fname of files) {
    if (fname.endsWith('.js')) {
        const fpath = path.join(adminDir, fname);
        let content = fs.readFileSync(fpath, 'utf8');
        
        // Replace adminFetchAll('table', '*, relations(...)') with adminFetchAll('table', '*')
        content = content.replace(/(adminFetchAll\(\s*'[^']+'\s*,\s*)'[^']+'(\s*,\s*\{[^}]*\}\s*\))/g, `$1'*'$2`);
        content = content.replace(/(adminFetchAll\(\s*'[^']+'\s*,\s*)'[^']+'(\s*\))/g, `$1'*'$2`);
        
        fs.writeFileSync(fpath, content, 'utf8');
    }
}

console.log("Patching complete.");
