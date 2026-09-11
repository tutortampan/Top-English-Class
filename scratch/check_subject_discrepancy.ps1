$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

Write-Host "--- ALL SUBJECTS IN CEC ---"
$subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?select=id,name,program_id,created_at,is_active,deleted_at" -Headers $headers
$subjs | Format-Table -AutoSize

Write-Host "`n--- ALL LEVELS IN CEC ---"
$levels = Invoke-RestMethod -Uri "$baseUrl/levels?select=id,name,level_number,subject_id,deleted_at" -Headers $headers
$levels | Format-Table -AutoSize

Write-Host "`n--- ALL EXAMS ---"
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=id,exam_title,exam_type,level_id,subject_id,program_id,deleted_at" -Headers $headers
$exams | Format-Table -AutoSize
