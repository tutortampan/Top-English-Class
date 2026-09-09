$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
Write-Host "--- PROGRAMS ---"
$progs = Invoke-RestMethod -Uri "$baseUrl/programs?select=*" -Headers $h -Method Get
$progs | Format-Table id, name, is_active, deleted_at

Write-Host "--- CLASSES ---"
$classes = Invoke-RestMethod -Uri "$baseUrl/classes?select=*,programs(name)" -Headers $h -Method Get
$classes | Format-Table id, name, program_id, is_active, deleted_at

Write-Host "--- SUBJECTS ---"
$subjects = Invoke-RestMethod -Uri "$baseUrl/subjects?select=*,programs(name)" -Headers $h -Method Get
$subjects | Format-Table id, name, program_id, is_active, deleted_at
