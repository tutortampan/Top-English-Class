$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
$tables = @('programs', 'classes', 'subjects', 'levels', 'class_subjects', 'students', 'exams', 'exam_classes', 'questions', 'attempts', 'attempt_answers', 'progress', 'site_settings', 'audit_logs', 'batches')

foreach ($t in $tables) {
    try {
        $res = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/$t?select=*&limit=1" -Headers $headers -Method Get
        Write-Host "TABLE [$t]: AVAILABLE (Count: $($res.Count))"
    } catch {
        Write-Host "TABLE [$t]: ERROR - $($_.Exception.Message)"
    }
}
