$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

try {
    $res = Invoke-RestMethod -Uri "$baseUrl/audit_logs?limit=1" -Headers $headers -Method Get
    Write-Host "audit_logs read SUCCESS! Count: $($res.Count)"
    if ($res.Count -gt 0) {
        Write-Host "Columns: $(($res[0].PSObject.Properties.Name) -join ', ')"
    }
} catch {
    Write-Host "audit_logs error: $($_.Exception.Message)"
}
