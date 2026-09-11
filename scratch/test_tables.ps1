$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
try {
    $res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/exam_classes?select=*&limit=1' -Headers $headers -Method Get
    Write-Host "exam_classes table EXISTS! Count: $($res.Count)"
} catch {
    Write-Host "exam_classes error: $($_.Exception.Message)"
}
