$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$attemptId = '1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3'
$examId = '809acaf9-033f-4c38-8341-eed538eb8541'

$exam = (Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$examId&select=*" -Headers $headers)[0]
$questions = Invoke-RestMethod -Uri "$baseUrl/questions?exam_id=eq.$examId&select=*&order=question_order" -Headers $headers
Write-Host "Questions to insert: $($questions.Count)"

$answerRows = @()
foreach ($q in $questions) {
    $answerRows += @{
        attempt_id = $attemptId
        question_id = $q.id
        question_snapshot = @{
            question_text = $q.question_text
            answer_type = if ($q.answer_type) { $q.answer_type } else { $exam.answer_type }
            correct_answer = if ($q.correct_answer) { $q.correct_answer } else { '' }
            options_json = $q.options_json
        }
        options_snapshot = $q.options_json
        correct_answer_snapshot = if ($q.correct_answer) { $q.correct_answer } else { '' }
        student_answer = $null
        score = 0
    }
}

try {
    $inserted = Invoke-RestMethod -Uri "$baseUrl/attempt_answers" -Headers $headers -Method Post -Body ($answerRows | ConvertTo-Json -Depth 5)
    Write-Host "SUCCESS: Inserted $($inserted.Count) attempt answers!"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
