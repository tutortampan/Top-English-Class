$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$questions = Invoke-RestMethod -Uri "$baseUrl/questions?select=id,exam_id,question_text,question_order" -Headers $headers
Write-Host "Total questions in database: $($questions.Count)"
$questions | Format-Table -AutoSize
