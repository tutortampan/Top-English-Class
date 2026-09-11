$h = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$studentId = '9f39aac4-86b5-4f0a-990e-ccdbc44e69ed'
$examId = '809acaf9-033f-4c38-8341-eed538eb8541'

Write-Host "--- TEST 1: Check Attempt & Answers for Abid ---"
$attempt = (Invoke-RestMethod -Uri "$baseUrl/attempts?student_id=eq.$studentId&exam_id=eq.$examId&status=eq.in_progress" -Headers $h)[0]
Write-Host "Found in_progress attempt: $($attempt.id) - Started at: $($attempt.started_at)"

$answers = Invoke-RestMethod -Uri "$baseUrl/attempt_answers?attempt_id=eq.$($attempt.id)&select=id,question_snapshot,correct_answer_snapshot,score" -Headers $h
Write-Host "Total answers in attempt: $($answers.Count)"

if ($answers.Count -eq 60) {
    Write-Host "SUCCESS: Exactly 60 answers ready in DB!" -ForegroundColor Green
    Write-Host "First question: $($answers[0].question_snapshot.question_text) | Answer type: $($answers[0].question_snapshot.answer_type) | Correct: $($answers[0].correct_answer_snapshot)"
    Write-Host "Last question: $($answers[59].question_snapshot.question_text) | Answer type: $($answers[59].question_snapshot.answer_type) | Correct: $($answers[59].correct_answer_snapshot)"
} else {
    Write-Host "ERROR: Expected 60 answers, found $($answers.Count)" -ForegroundColor Red
}

Write-Host "`n--- TEST 2: Verify Server is serving updated api.js and exam.html ---"
$apiJs = Invoke-RestMethod -Uri "http://localhost:8080/js/api.js"
if ($apiJs -match 'Self-heal: If attempt exists') {
    Write-Host "SUCCESS: js/api.js contains self-heal logic!" -ForegroundColor Green
} else {
    Write-Host "ERROR: js/api.js does not contain self-heal logic!" -ForegroundColor Red
}

$examHtml = Invoke-RestMethod -Uri "http://localhost:8080/exam.html"
if ($examHtml -match 'No Questions Found') {
    Write-Host "SUCCESS: exam.html contains empty question safeguard!" -ForegroundColor Green
} else {
    Write-Host "ERROR: exam.html does not contain empty question safeguard!" -ForegroundColor Red
}
