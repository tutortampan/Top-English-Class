$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$testKey = "exam_meta_test_uuid"
$testVal = @{
    prerequisite_exam_id = "00000000-0000-0000-0000-000000000001"
    exam_order = "1"
    class_id = "d4c6d85a-44b7-4121-acae-28f7b9e70dcd"
} | ConvertTo-Json -Compress

$body = @{
    key = $testKey
    value = $testVal
    updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

try {
    Write-Host "1. Testing insert into site_settings..."
    $res = Invoke-RestMethod -Uri "$baseUrl/site_settings" -Headers $headers -Method Post -Body $body
    Write-Host "Success! Inserted:" ($res | ConvertTo-Json)

    Write-Host "2. Testing fetch from site_settings..."
    $fetch = Invoke-RestMethod -Uri "$baseUrl/site_settings?key=eq.$testKey" -Headers $headers -Method Get
    Write-Host "Fetched value: $($fetch[0].value)"

    Write-Host "3. Testing cleanup from site_settings..."
    Invoke-RestMethod -Uri "$baseUrl/site_settings?key=eq.$testKey" -Headers $headers -Method Delete | Out-Null
    Write-Host "Cleaned up successfully!"
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
