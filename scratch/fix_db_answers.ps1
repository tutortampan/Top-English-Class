$url = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/questions?select=id,correct_answer'
$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aXN6dndmamNjdnVjcXBhY3RmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTA3MiwiZXhwIjoyMTA0MzExMDcyfQ.sKJHafDkIG8iKvBL_04TN0m-FJf0iwBgObWURV-Gk8w'
}
$response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers

$count = 0
foreach ($q in $response) {
    if ($q.correct_answer -match '[;\|]') {
        $newAnswer = $q.correct_answer -replace '\s*[;\|]\s*', '/'
        $updateUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/questions?id=eq.$($q.id)"
        $body = @{ correct_answer = $newAnswer } | ConvertTo-Json
        $patchHeaders = @{
            'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
            'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aXN6dndmamNjdnVjcXBhY3RmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTA3MiwiZXhwIjoyMTA0MzExMDcyfQ.sKJHafDkIG8iKvBL_04TN0m-FJf0iwBgObWURV-Gk8w'
            'Content-Type' = 'application/json'
            'Prefer' = 'return=minimal'
        }
        Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $patchHeaders -Body $body
        Write-Host "Updated question $($q.id): $($q.correct_answer) -> $newAnswer"
        $count++
    }
}
Write-Host "Updated $count questions in database."
