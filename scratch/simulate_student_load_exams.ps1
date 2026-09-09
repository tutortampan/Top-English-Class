$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

# Get Abid's details
$student = (Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&select=id,name,class_id,classes(program_id)" -Headers $headers)[0]
$studentId = $student.id
$classId = $student.class_id
$programId = $student.classes.program_id

Write-Host "Student ID: $studentId, Class ID: $classId, Program ID: $programId"

# Get Level 1 for Vocabularies
$subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$programId&name=eq.Vocabularies" -Headers $headers
$levels = Invoke-RestMethod -Uri "$baseUrl/levels?subject_id=eq.$($subjs[0].id)&level_number=eq.1" -Headers $headers
$levelId = $levels[0].id

Write-Host "Level ID: $levelId"

# 1. Test fetchExamsForStudentLevel
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?level_id=eq.$levelId&exam_status=eq.published&deleted_at=is.null&order=exam_title" -Headers $headers
Write-Host "Exams returned: $($exams.Count)"
foreach ($e in $exams) {
    Write-Host " - $($e.id): $($e.exam_type) - $($e.exam_title)"
}

# 2. Test audit_logs query as used in fetchExamsForStudentLevel
$logs = Invoke-RestMethod -Uri "$baseUrl/audit_logs?entity_type=eq.exam&action=eq.exam_metadata&select=entity_id,new_value,created_at" -Headers $headers
Write-Host "Audit logs returned: $($logs.Count)"

# 3. Test fetchStudentAttemptsForExam
if ($exams.Count -gt 0) {
    $attempts = Invoke-RestMethod -Uri "$baseUrl/attempts?student_id=eq.$studentId&exam_id=eq.$($exams[0].id)&status=in.(submitted,auto_submitted)" -Headers $headers
    Write-Host "Attempts for exam $($exams[0].id): $($attempts.Count)"
}
