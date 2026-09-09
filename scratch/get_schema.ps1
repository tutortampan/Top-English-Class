$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/?apikey=sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4' -Headers $headers
Write-Host "Tables in Supabase PostgREST schema:"
$res.definitions.PSObject.Properties.Name | ForEach-Object {
    Write-Host " - $_"
}
