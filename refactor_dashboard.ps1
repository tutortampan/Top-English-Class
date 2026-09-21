$content = Get-Content 'dashboard.html' -Raw
$content = $content -ireplace '\bexam\.html\b', 'assessment.html'
$content = $content -ireplace '\btec_exam_id\b', 'tec_assessment_id'

# UI Labels
$content = $content -creplace 'Subjects', 'Classes'
$content = $content -creplace 'Subject', 'Class'
$content = $content -creplace 'Exams', 'Assessments'
$content = $content -creplace 'Exam', 'Assessment'

# Variable names \bexam\b -> assessment
$content = $content -creplace '\bexam\b', 'assessment'
$content = $content -creplace '\bexams\b', 'assessments'
$content = $content -creplace '\bexamId\b', 'assessmentId'
$content = $content -creplace '\bexam_id\b', 'assessment_id'

$content = $content -creplace '\bsubjects\b', 'classes'
$content = $content -creplace '\bsubject\b(?!\s*(=|:))', 'classItem' # Avoid 'subject =' 
$content = $content -creplace '\bsubject_id\b', 'class_id'
$content = $content -creplace '\bsubjectId\b', 'classId'

Set-Content 'dashboard.html' $content -Encoding UTF8
