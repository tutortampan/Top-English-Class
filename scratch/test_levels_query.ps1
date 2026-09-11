$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/levels?select=*,subjects(name,program_id,programs(name))" -Headers $h -Method Get
    Write-Host "Success fetching levels with subjects & programs:" ($res | ConvertTo-Json -Depth 4)
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Error: " $reader.ReadToEnd()
}
