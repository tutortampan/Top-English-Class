$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$student = (Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&class_id=eq.d4c6d85a-44b7-4121-acae-28f7b9e70dcd" -Headers $headers)[0]
Write-Host "Student: $($student.name) (ID: $($student.id))"

# Check attempts for student
$attempts = Invoke-RestMethod -Uri "$baseUrl/attempts?student_id=eq.$($student.id)&select=*" -Headers $headers
Write-Host "Total attempts found: $($attempts.Count)"
foreach ($a in $attempts) {
    $ans = Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$($a.id)&select=id" -Headers $headers
    Write-Host "Attempt ID: $($a.id) | Status: $($a.status) | Exam ID: $($a.exam_id) | Answers Count: $($ans.Count)"
}
