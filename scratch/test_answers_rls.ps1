$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$studentId = '9f39aac4-86b5-4f0a-990e-ccdbc44e69ed' # Mr. Abid An Naufal
$examId = '809acaf9-033f-4c38-8341-eed538eb8541' # CEC Camp Vocabularies Weekly A 1

try {
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $expectedEnd = (Get-Date).AddMinutes(60).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $payload = @{
        student_id = $studentId
        exam_id = $examId
        started_at = $now
        expected_end_at = $expectedEnd
        status = 'in_progress'
        score = 0
        percentage = 0
        grade = 'F'
    } | ConvertTo-Json

    $attempt = Invoke-RestMethod -Uri "$baseUrl/attempts" -Headers $headers -Method Post -Body $payload
    $attId = $attempt[0].id

    # Test attempt_answers
    $ansPayload = @(
        @{
            attempt_id = $attId
            question_snapshot = @{ question_text = "What is the meaning of Apple?" }
            student_answer = $null
            score = 0
        }
    ) | ConvertTo-Json

    $ans = Invoke-RestMethod -Uri "$baseUrl/attempt_answers" -Headers $headers -Method Post -Body $ansPayload
    Write-Host "SUCCESS: Created attempt_answers $($ans[0].id)"

    # Clean up
    Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$attId" -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$attId" -Headers $headers -Method Delete | Out-Null
    Write-Host "Cleaned up test data."
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
