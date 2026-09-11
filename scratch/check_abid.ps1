$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$students = Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&select=id,name,gender,class_id,program_id,classes(id,name,programs(id,name))" -Headers $headers
$students | ConvertTo-Json -Depth 4
