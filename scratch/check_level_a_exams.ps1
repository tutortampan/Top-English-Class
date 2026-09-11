$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$programId = '24d52c09-f2e6-4bbe-b8ab-3eaa41c8b333' # CEC
$classId = 'd4c6d85a-44b7-4121-acae-28f7b9e70dcd' # Camp

# Find Vocabularies subject
$subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$programId" -Headers $headers
Write-Host "Subjects in CEC: $(($subjs | Select-Object id, name) | ConvertTo-Json)"

$vocab = $subjs[0]
$levels = Invoke-RestMethod -Uri "$baseUrl/levels?subject_id=eq.$($vocab.id)&order=level_number" -Headers $headers
Write-Host "Levels for Vocabularies:"
$levels | Format-Table id, name, level_number

# Check Level A (level_number 1)
$levelA = $levels | Where-Object { $_.level_number -eq 1 }
Write-Host "Level A ID: $($levelA.id)"

# Check exams for Level A
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?level_id=eq.$($levelA.id)&select=*" -Headers $headers
Write-Host "Exams for Level A in DB: $($exams.Count)"
$exams | Format-Table id, exam_title, exam_type, exam_status, program_id
