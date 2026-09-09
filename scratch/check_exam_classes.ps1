$headers = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$exams = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/exams?select=id,exam_title,exam_type,program_id,subject_id,level_id" -Headers $headers
Write-Host "Total Exams: $($exams.Count)"
$exams | ForEach-Object { Write-Host " - Exam: $($_.exam_title) ($($_.exam_type)) [ID: $($_.id)]" }

$ec = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/exam_classes?select=*,classes(name),exams(exam_title)" -Headers $headers
Write-Host "Total Exam_Classes: $($ec.Count)"
$ec | ForEach-Object { Write-Host " - $($_.exams.exam_title) assigned to $($_.classes.name) (Class ID: $($_.class_id))" }
