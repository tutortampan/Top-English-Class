$h = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/attempt_answers?attempt_id=eq.1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3&select=id' -Headers $h
Write-Host "Total answers populated for attempt: $($res.Count)"
