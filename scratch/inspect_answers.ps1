$h = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$res = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/attempt_answers?attempt_id=eq.1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3&limit=3' -Headers $h
foreach ($ans in $res) {
    Write-Host "Answer ID: $($ans.id)"
    Write-Host "Question Snapshot:" ($ans.question_snapshot | ConvertTo-Json -Depth 3)
    Write-Host "Options Snapshot:" ($ans.options_snapshot | ConvertTo-Json -Depth 3)
    Write-Host "Correct Answer:" $ans.correct_answer_snapshot
    Write-Host "----------------"
}
