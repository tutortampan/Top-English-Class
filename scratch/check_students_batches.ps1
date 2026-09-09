$headers = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$batches = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/batches?select=id,name,class_id,classes(name)" -Headers $headers
Write-Host "Total Batches: $($batches.Count)"
$batches | ForEach-Object { Write-Host " - Batch: $($_.name) [Class: $($_.classes.name)]" }

$students = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/students?select=id,name,gender,class_id,classes(name),batch_id,batches(name)&deleted_at=is.null" -Headers $headers
Write-Host "Total Students: $($students.Count)"
$students | ForEach-Object { Write-Host " - Student: $($_.name) ($($_.gender)) [Class: $($_.classes.name) | Batch: $($_.batches.name)]" }
