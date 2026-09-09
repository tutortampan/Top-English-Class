$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/programs" -Method Post -Headers $h -Body '{"name":"Sheraton","is_active":true}'
    Write-Host "Inserted Sheraton successfully:" ($res | ConvertTo-Json)
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Error inserting Sheraton: " $reader.ReadToEnd()
}
