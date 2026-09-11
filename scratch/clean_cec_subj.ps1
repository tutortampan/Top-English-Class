$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$cecS = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.24d52c09-f2e6-4bbe-b8ab-3eaa41c8b333&deleted_at=is.null" -Headers $h
Write-Host "CEC Active Subjects count: $($cecS.Count)"
if ($cecS.Count -gt 1) {
    # Keep the primary one (99316504-99dd-444c-88bd-6ce073f878d3) and delete the duplicate
    $dup = $cecS | Where-Object { $_.id -ne "99316504-99dd-444c-88bd-6ce073f878d3" }
    foreach ($d in $dup) {
        Invoke-RestMethod -Uri "$baseUrl/subjects?id=eq.$($d.id)" -Headers $h -Method Patch -Body '{"deleted_at":"2026-09-09T04:50:00Z"}'
        Write-Host "Cleaned up duplicate subject $($d.id)"
    }
}
