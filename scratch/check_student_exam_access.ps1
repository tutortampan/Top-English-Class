$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

Write-Host "1. Checking student Abid An Naufal:"
$students = Invoke-RestMethod -Uri "$baseUrl/students?name=ilike.*Abid*&select=*,classes(*,programs(*))" -Headers $headers
Write-Host ($students | ConvertTo-Json -Depth 3)

Write-Host "`n2. Checking active exams in database:"
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=*,levels(*),subjects(*),programs(*)" -Headers $headers
Write-Host ($exams | ConvertTo-Json -Depth 3)

Write-Host "`n3. Checking exam_classes:"
$ec = Invoke-RestMethod -Uri "$baseUrl/exam_classes?select=*" -Headers $headers
Write-Host ($ec | ConvertTo-Json -Depth 3)

Write-Host "`n4. Checking audit_logs for exam_metadata:"
$al = Invoke-RestMethod -Uri "$baseUrl/audit_logs?entity_type=eq.exam&select=*" -Headers $headers
Write-Host ($al | ConvertTo-Json -Depth 3)
