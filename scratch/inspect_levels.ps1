$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/levels?select=*" -Headers $h -Method Get
    Write-Host "Levels records found:" $res.Count
    if ($res.Count -gt 0) {
        Write-Host "Sample record columns:"
        $res[0] | Format-List *
    }
} catch {
    Write-Host "Error fetching levels:" $_.Exception.Message
}
