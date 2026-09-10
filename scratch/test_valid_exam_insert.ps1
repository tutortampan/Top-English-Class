$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

# Grab CEC, Vocabularies, Level 1
$progs = Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.CEC" -Headers $headers -Method Get
$subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$($progs[0].id)" -Headers $headers -Method Get
$levels = Invoke-RestMethod -Uri "$baseUrl/levels?subject_id=eq.$($subjs[0].id)" -Headers $headers -Method Get

$payload = @{
    program_id = $progs[0].id
    subject_id = $subjs[0].id
    level_id = $levels[0].id
    exam_type = "Daily"
    exam_title = "CEC Camp Vocabularies Daily 1st A"
    time_limit_minutes = 60
    minimum_required_score = 60
    answer_type = "multiple_choice"
    exam_status = "published"
    question_order = "sequential"
    retake_allowed = $true
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $headers -Method Post -Body $payload
    Write-Host "Insert SUCCESS! Created Exam ID: $($res[0].id)"
    Write-Host "Returned Fields: $(($res[0].PSObject.Properties.Name) -join ', ')"
    
    # Clean up test exam
    Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$($res[0].id)" -Headers $headers -Method Delete | Out-Null
    Write-Host "Cleaned up test exam."
} catch {
    Write-Host "Insert FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
