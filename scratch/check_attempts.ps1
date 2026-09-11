$headers = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$attempts = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/attempts?select=*,students(name,gender,batch_id,class_id,batches(name),classes(name)),exams(exam_title,exam_type)" -Headers $headers
Write-Host "Total Attempts: $($attempts.Count)"
$attempts | ForEach-Object {
    Write-Host " - Attempt: $($_.students.name) [Class: $($_.students.classes.name), Batch: $($_.students.batches.name)] - $($_.exams.exam_title) -> Score: $($_.score) ($($_.percentage)%)"
}
