$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

Write-Host "=== ERASING EXISTING EXAM DATA ==="

# 1. Delete attempt answers & attempts if any
try {
    Invoke-RestMethod -Uri "$baseUrl/attempt_answers?id=neq.00000000-0000-0000-0000-000000000000" -Headers $h -Method Delete
    Write-Host "Attempt answers deleted."
} catch {
    Write-Host "Attempt answers delete note: $($_.Exception.Message)"
}

try {
    Invoke-RestMethod -Uri "$baseUrl/attempts?id=neq.00000000-0000-0000-0000-000000000000" -Headers $h -Method Delete
    Write-Host "Attempts deleted."
} catch {
    Write-Host "Attempts delete note: $($_.Exception.Message)"
}

# 2. Delete questions
try {
    Invoke-RestMethod -Uri "$baseUrl/questions?id=neq.00000000-0000-0000-0000-000000000000" -Headers $h -Method Delete
    Write-Host "Questions deleted."
} catch {
    Write-Host "Questions delete note: $($_.Exception.Message)"
}

# 3. Delete exam_classes if any
try {
    Invoke-RestMethod -Uri "$baseUrl/exam_classes?exam_id=neq.00000000-0000-0000-0000-000000000000" -Headers $h -Method Delete
    Write-Host "Exam_classes deleted."
} catch {
    Write-Host "Exam_classes delete note: $($_.Exception.Message)"
}

# 4. Delete exams
try {
    Invoke-RestMethod -Uri "$baseUrl/exams?id=neq.00000000-0000-0000-0000-000000000000" -Headers $h -Method Delete
    Write-Host "Exams deleted."
} catch {
    Write-Host "Exams delete note: $($_.Exception.Message)"
}

# Verify counts
$e = Invoke-RestMethod -Uri "$baseUrl/exams?select=id" -Headers $h
$q = Invoke-RestMethod -Uri "$baseUrl/questions?select=id" -Headers $h
Write-Host "Remaining Exams: $($e.Count)"
Write-Host "Remaining Questions: $($q.Count)"
Write-Host "=== RESET COMPLETE ==="
