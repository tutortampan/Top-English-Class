$h = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'
$attemptId = '1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3'

Write-Host "--- TEST: Can we update attempt status to auto_submitted? ---"
try {
    $body = @{
        status = 'auto_submitted'
        submitted_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        score = 0
        percentage = 0
        grade = 'F'
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attemptId" -Headers $h -Method Patch -Body $body
    Write-Host "SUCCESS: Updated attempt status: $($res[0].status)"
    
    # Restore to in_progress for ongoing testing
    $bodyRestore = @{
        status = 'in_progress'
        submitted_at = $null
    } | ConvertTo-Json
    $res2 = Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attemptId" -Headers $h -Method Patch -Body $bodyRestore
    Write-Host "Restored to in_progress for testing: $($res2[0].status)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
