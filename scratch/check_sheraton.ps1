$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

# Check if Sheraton exists
$sheraton = Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.Sheraton&select=*" -Headers $h -Method Get
Write-Host "Sheraton query:" ($sheraton | ConvertTo-Json)
