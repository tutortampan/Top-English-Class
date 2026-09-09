$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}

$progUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/programs?name=eq.CEC'
$progs = Invoke-RestMethod -Uri $progUrl -Headers $headers -Method Get
$progId = $progs[0].id

$subjUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/subjects?program_id=eq.$progId"
$subjs = Invoke-RestMethod -Uri $subjUrl -Headers $headers -Method Get
$subjId = $subjs[0].id

$lvlUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/levels?subject_id=eq.$subjId"
$levels = Invoke-RestMethod -Uri $lvlUrl -Headers $headers -Method Get
$lvlId = $levels[0].id

Write-Host "Found Program: $($progs[0].name), Subject: $($subjs[0].name), Level: $($levels[0].level_number)"

$payload = @{
    program_id = $progId
    subject_id = $subjId
    level_id = $lvlId
    exam_title = "Test Prereq Null Exam"
    exam_type = "Quiz"
    prerequisite_exam_id = $null
    time_limit_minutes = 60
    answer_type = "multiple_choice"
    exam_status = "draft"
    question_order = "sequential"
}
$bodyWithPrereqNull = $payload | ConvertTo-Json

try {
    Write-Host "Testing INSERT with prerequisite_exam_id = null..."
    $res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/exams' -Headers $headers -Method Post -Body $bodyWithPrereqNull
    Write-Host "INSERT SUCCESS! Result:" ($res | ConvertTo-Json)
    
    # Clean up test exam
    $testId = $res[0].id
    $del = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/exams?id=eq.$testId" -Headers $headers -Method Delete
    Write-Host "Cleaned up test exam $testId."
} catch {
    Write-Host "INSERT Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
