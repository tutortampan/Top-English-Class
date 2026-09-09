$headers = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$progress = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/progress?select=*,students(name,gender,batch_id,batches(name),classes(name,programs(name))),subjects(name),levels(name,level_number)" -Headers $headers
Write-Host "Total Progress: $($progress.Count)"
