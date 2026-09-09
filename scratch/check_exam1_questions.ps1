$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'
$q = Invoke-RestMethod -Uri "$baseUrl/questions?exam_id=eq.809acaf9-033f-4c38-8341-eed538eb8541&select=id,question_text" -Headers $headers
Write-Host "Questions for Exam Weekly A 1: $($q.Count)"
