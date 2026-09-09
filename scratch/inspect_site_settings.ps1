$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
try {
    $res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/site_settings?select=*' -Headers $headers -Method Get
    Write-Host "site_settings count: $($res.Count)"
    if ($res.Count -gt 0) {
        Write-Host "Columns: $(($res[0].PSObject.Properties.Name) -join ', ')"
        $res | Format-List
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
