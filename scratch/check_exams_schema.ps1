$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/exams?select=*&limit=1" -Headers $h -Method Get
    Write-Host "Exams count: $($res.Count)"
    if ($res.Count -gt 0) {
        Write-Host "Sample exam columns:"
        $res[0] | Format-List *
    }
} catch {
    Write-Host "Error fetching exams: " $_.Exception.Message
}
