$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
try {
    $res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/rpc/' -Headers $headers -Method Get
    Write-Host "RPC endpoints: $($res)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
