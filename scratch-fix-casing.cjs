const fs = require('fs');
const path = require('path');
const dir = 'd:/TopsCore/js/admin';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  content = content.replace(/adminFetchAll\('Assessments'/g, "adminFetchAll('assessments'");
  content = content.replace(/Assessment_title/g, "title");
  content = content.replace(/Assessment_status/g, "status");
  content = content.replace(/Assessment_id/g, "assessment_id");
  content = content.replace(/Assessment_type/g, "assessment_type");
  
  if (content !== original) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('Fixed', f);
  }
}
