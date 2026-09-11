$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$cec = (Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.CEC&select=id" -Headers $h)[0]
$vocab = (Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$($cec.id)&select=id" -Headers $h)[0]
$lvl = (Invoke-RestMethod -Uri "$baseUrl/levels?select=id&limit=1" -Headers $h)[0]

$exam1Body = @{
    program_id = $cec.id
    subject_id = $vocab.id
    level_id = $lvl.id
    exam_type = "Mid-Term"
    exam_title = "CEC Camp Vocabularies Mid-Term 1"
    answer_type = "multiple_choice"
    exam_status = "published"
    time_limit_minutes = 60
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $h -Method Post -Body $exam1Body
    Write-Host "Success creating Exam 1:" ($res | ConvertTo-Json)
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Error Body: " $reader.ReadToEnd()
}
