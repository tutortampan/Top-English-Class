$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

# Grab a class
$classes = Invoke-RestMethod -Uri "$baseUrl/classes?limit=1" -Headers $headers -Method Get
$classId = $classes[0].id

# Create a temporary exam to test exam_classes insert
$progs = Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.CEC" -Headers $headers -Method Get
$subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$($progs[0].id)" -Headers $headers -Method Get
$levels = Invoke-RestMethod -Uri "$baseUrl/levels?subject_id=eq.$($subjs[0].id)" -Headers $headers -Method Get

$examPayload = @{
    program_id = $progs[0].id
    subject_id = $subjs[0].id
    level_id = $levels[0].id
    exam_type = "Daily"
    exam_title = "Temp Exam For RLS Check"
    time_limit_minutes = 60
    minimum_required_score = 60
    answer_type = "multiple_choice"
    exam_status = "draft"
    question_order = "sequential"
} | ConvertTo-Json

$exam = Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $headers -Method Post -Body $examPayload
$examId = $exam[0].id
Write-Host "Created test exam: $examId"

# Now test insert into exam_classes
$ecPayload = @{
    exam_id = $examId
    class_id = $classId
} | ConvertTo-Json

try {
    $ec = Invoke-RestMethod -Uri "$baseUrl/exam_classes" -Headers $headers -Method Post -Body $ecPayload
    Write-Host "exam_classes INSERT SUCCESS! Count: $($ec.Count)"
    
    # Cleanup exam_classes
    Invoke-RestMethod -Uri "$baseUrl/exam_classes?exam_id=eq.$examId" -Headers $headers -Method Delete | Out-Null
    Write-Host "exam_classes cleaned up."
} catch {
    Write-Host "exam_classes INSERT FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
} finally {
    # Cleanup test exam
    Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$examId" -Headers $headers -Method Delete | Out-Null
    Write-Host "test exam cleaned up."
}
