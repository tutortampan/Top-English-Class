$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$body = '{"deleted_at": null}'
$res = Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.66666666-6666-6666-6666-666666666666" -Method Patch -Headers $h -Body $body
Write-Host "Restored exam: $($res[0].exam_title) (deleted_at: $($res[0].deleted_at))"
