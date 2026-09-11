$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

# Restore subject
$body = '{"deleted_at": null, "is_active": true}'
$resSub = Invoke-RestMethod -Uri "$baseUrl/subjects?id=eq.33333333-3333-3333-3333-333333333333" -Method Patch -Headers $h -Body $body
Write-Host "Restored subject: $($resSub[0].name) (deleted_at: $($resSub[0].deleted_at))"

# Restore level
$resLvl = Invoke-RestMethod -Uri "$baseUrl/levels?id=eq.44444444-4444-4444-4444-444444444444" -Method Patch -Headers $h -Body $body
Write-Host "Restored level: $($resLvl[0].name) (deleted_at: $($resLvl[0].deleted_at))"

# Restore exam
$resExam = Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.66666666-6666-6666-6666-666666666666" -Method Patch -Headers $h -Body $body
Write-Host "Restored exam: $($resExam[0].exam_title) (deleted_at: $($resExam[0].deleted_at))"
