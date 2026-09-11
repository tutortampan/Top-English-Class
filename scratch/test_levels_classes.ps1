$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/levels?select=*,subjects(name,program_id,programs(name)),classes(name)" -Headers $h
    Write-Host "Success with classes! Count: $($res.Count)"
} catch {
    Write-Host "Failed with classes: $($_.Exception.Message)"
}
