const fs = require('fs');
let content = fs.readFileSync('d:/TopsCore/js/admin/class.js', 'utf8');

// Fix renderResults
content = content.replace(
  /const \[rawData, allPrograms, allClasses, allBatches\] = await Promise\.all\(\[/,
  'const [rawData, allInstitutions, allPrograms, allBatches] = await Promise.all(['
);

content = content.replace(
  /\$\{\(allPrograms \|\| \[\]\)/g,
  '${(allInstitutions || [])'
);

content = content.replace(
  /\$\{\(allClasses \|\| \[\]\)/g,
  '${(allPrograms || [])'
);

content = content.replace(
  /data-prog="\$\{c\.institution_id\}"/g,
  'data-inst="${c.institution_id}"'
);

content = content.replace(
  /data-class="\$\{b\.program_id\}"/g,
  'data-prog="${b.program_id}"'
);

// Fix renderStudentProgress
content = content.replace(
  /const \[allStudents, allPrograms, allClasses, allBatches, allAssignments, allAssessments, allAttempts\] = await Promise\.all\(\[/,
  'const [allStudents, allInstitutions, allPrograms, allBatches, allAssignments, allAssessments, allAttempts] = await Promise.all(['
);

// Fix renderClassInstances
content = content.replace(
  /adminFetchAll\('classes', 'id, name, institution_id'\)/g,
  "adminFetchAll('classes', 'id, name')"
);

fs.writeFileSync('d:/TopsCore/js/admin/class.js', content, 'utf8');
console.log('Fixed class.js');
