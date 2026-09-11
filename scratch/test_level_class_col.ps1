$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$testPayload = '{"name":"Test Level","level_number":99,"subject_id":"33333333-3333-3333-3333-333333333333","class_id":"22222222-2222-2222-2222-222222222222"}'
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/levels" -Method Post -Headers $h -Body $testPayload
    Write-Host "Success inserting class_id to levels:" ($res | ConvertTo-Json)
} catch {
    Write-Host "Insert with class_id failed: $($_.Exception.Message)"
}
