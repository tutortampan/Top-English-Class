$h = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'
$attemptId = '1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3'

Write-Host "--- TEST: Full Evaluation & Auto-Submit on Attempt ---"
# Fetch attempt answers
$answers = Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$attemptId&select=id,question_snapshot,correct_answer_snapshot" -Headers $h
Write-Host "Found $($answers.Count) answers to evaluate."

# Submit attempt patch
$body = @{
    status = 'auto_submitted'
    submitted_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    score = 0
    percentage = 0
    grade = 'F'
} | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attemptId" -Headers $h -Method Patch -Body $body
Write-Host "Attempt updated: status = $($res[0].status), submitted_at = $($res[0].submitted_at)"

# Verify result page can query this attempt
$attemptWithExam = Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attemptId&select=*,exams(*,subjects(name),levels(name))" -Headers $h
Write-Host "Verified attempt query for result.html: status = $($attemptWithExam[0].status)"

# Restore attempt to in_progress for student testing
$restore = @{
    status = 'in_progress'
    submitted_at = $null
} | ConvertTo-Json
$resRestore = Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attemptId" -Headers $h -Method Patch -Body $restore
Write-Host "Restored attempt to in_progress for student: $($resRestore[0].status)"
