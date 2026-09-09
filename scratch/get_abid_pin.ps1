$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'
$abid = Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&select=id,name,gender,pin_hash,classes(name,programs(name))" -Headers $headers
$abid | Format-List
