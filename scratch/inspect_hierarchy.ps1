$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

$programs = Invoke-RestMethod -Uri "$baseUrl/programs?select=*" -Headers $h
Write-Host "PROGRAMS:"
$programs | ForEach-Object { Write-Host " - Prog: $($_.name) [ID: $($_.id)]" }

$subjects = Invoke-RestMethod -Uri "$baseUrl/subjects?select=*,programs(name)" -Headers $h
Write-Host "`nSUBJECTS:"
$subjects | ForEach-Object { Write-Host " - Subj: $($_.name) [ID: $($_.id)] (Prog: $($_.programs.name))" }

$levels = Invoke-RestMethod -Uri "$baseUrl/levels?select=*,subjects(name)" -Headers $h
Write-Host "`nLEVELS:"
$levels | ForEach-Object { Write-Host " - Level: $($_.name) [ID: $($_.id)] (Subj: $($_.subjects.name))" }

$exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=*,levels(name),subjects(name),programs(name)" -Headers $h
Write-Host "`nEXAMS:"
$exams | ForEach-Object { Write-Host " - Exam: $($_.exam_title) (Prog: $($_.programs.name), Subj: $($_.subjects.name), Level: $($_.levels.name)) [Status: $($_.exam_status)]" }
