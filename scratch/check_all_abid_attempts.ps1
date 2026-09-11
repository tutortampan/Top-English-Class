$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$students = Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&select=id,name" -Headers $headers

foreach ($s in $students) {
    Write-Host "Checking $($s.name) ($($s.id)):"
    $attempts = Invoke-RestMethod -Uri "$baseUrl/attempts?student_id=eq.$($s.id)&select=*" -Headers $headers
    Write-Host "  Attempts: $($attempts.Count)"
    foreach ($a in $attempts) {
        $ans = Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$($a.id)&select=id" -Headers $headers
        Write-Host "  - Attempt $($a.id) | Status: $($a.status) | Exam: $($a.exam_id) | Answers: $($ans.Count)"
    }
}
