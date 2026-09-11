$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$s = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/site_settings?select=*" -Headers $h
Write-Host "Site Settings count: $($s.Count)"
$s | ForEach-Object { Write-Host "$($_.key) = $($_.value)" }
