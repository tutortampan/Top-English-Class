$h = @{ 'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4' }
try {
    $res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/functions/v1/start-exam' -Headers $h -Method Post -Body '{}' -ContentType 'application/json'
    Write-Host "start-exam edge function is DEPLOYED! Result: $res"
} catch {
    Write-Host "start-exam response: $($_.Exception.Message)"
}
