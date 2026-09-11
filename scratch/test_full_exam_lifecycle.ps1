$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

# Exam 1: Weekly A 1
$examId = '809acaf9-033f-4c38-8341-eed538eb8541'
# Student: Abid An Naufal
$studentId = '9f39aac4-86b5-4f0a-990e-ccdbc44e69ed'

Write-Host "1. Fetching exam details..."
$exam = (Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$examId&select=*" -Headers $headers)[0]
Write-Host "   Exam: $($exam.exam_type) - $($exam.exam_title)"

Write-Host "2. Fetching questions for exam..."
$questions = Invoke-RestMethod -Uri "$baseUrl/questions?exam_id=eq.$examId&select=*&order=question_order" -Headers $headers
Write-Host "   Total questions found: $($questions.Count)"

Write-Host "3. Creating simulated in-progress attempt..."
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$expectedEnd = (Get-Date).AddMinutes($exam.time_limit_minutes).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$attemptPayload = @{
    student_id = $studentId
    exam_id = $examId
    started_at = $now
    expected_end_at = $expectedEnd
    status = 'in_progress'
    score = 0
    percentage = 0
    grade = 'F'
} | ConvertTo-Json

$attempt = (Invoke-RestMethod -Uri "$baseUrl/attempts" -Headers $headers -Method Post -Body $attemptPayload)[0]
Write-Host "   Created attempt ID: $($attempt.id)"

Write-Host "4. Creating attempt_answers snapshots for 60 questions..."
$answerRows = @()
foreach ($q in $questions) {
    $answerRows += @{
        attempt_id = $attempt.id
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
$answerPayload = $answerRows | ConvertTo-Json -Depth 5
$insertedAnswers = Invoke-RestMethod -Uri "$baseUrl/attempt_answers" -Headers $headers -Method Post -Body $answerPayload
Write-Host "   Created $($insertedAnswers.Count) attempt answers successfully!"

Write-Host "5. Cleaning up simulated attempt..."
Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$($attempt.id)" -Headers $headers -Method Delete | Out-Null
Invoke-RestMethod -Uri "$baseUrl/attempts?id=eq.$($attempt.id)" -Headers $headers -Method Delete | Out-Null
Write-Host "   Cleaned up test attempt."

Write-Host "`n>>> EXAM START LIFECYCLE 100% OPERATIONAL <<<"
