const fs = require('fs');
let content = fs.readFileSync('dashboard.html', 'utf8');

// Safe UI replacements
content = content.replace(/My Classes/g, 'My Classes');
content = content.replace(/Completed Assessments/g, 'Completed Assessments');
content = content.replace(/Assessment\.html/g, 'assessment.html');
content = content.replace(/tec_assessment_id/g, 'tec_assessment_id');
content = content.replace(/Classes Section/g, 'Classes Section');
content = content.replace(/Completed Assessments Section/g, 'Completed Assessments Section');
content = content.replace(/Classes/g, 'Classes');
content = content.replace(/Class/g, 'Class');
content = content.replace(/Assessments/g, 'Assessments');
content = content.replace(/Assessment/g, 'Assessment');

// Safe JS Variable replacements
content = content.replace(/\bAssessment\b/g, 'assessment');
content = content.replace(/\bAssessments\b/g, 'assessments');
content = content.replace(/\bAssessmentId\b/g, 'assessmentId');
content = content.replace(/\bAssessment_id\b/g, 'assessment_id');

content = content.replace(/\bClasses\b/g, 'classes');
content = content.replace(/\bClass\b(?!\s*(=|:))/g, 'classItem');
content = content.replace(/\bClass_id\b/g, 'class_id');
content = content.replace(/\bClassId\b/g, 'classId');

fs.writeFileSync('dashboard.html', content, 'utf8');
console.log('Done dashboard.html');
