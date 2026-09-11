$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$e = Invoke-RestMethod -Uri "$baseUrl/exams?select=id,exam_title,deleted_at" -Headers $h
$q = Invoke-RestMethod -Uri "$baseUrl/questions?select=id,exam_id" -Headers $h
$a = Invoke-RestMethod -Uri "$baseUrl/attempts?select=id" -Headers $h
Write-Host "Current count in DB:"
Write-Host "  Exams: $($e.Count)"
Write-Host "  Questions: $($q.Count)"
Write-Host "  Attempts: $($a.Count)"
