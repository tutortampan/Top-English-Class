$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=id,exam_title,exam_type,level_id,program_id,exam_status,deleted_at" -Headers $headers
$exams | Format-Table -AutoSize
