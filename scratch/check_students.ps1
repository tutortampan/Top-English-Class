$headers = @{
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aXN6dndmamNjdnVjcXBhY3RmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTA3MiwiZXhwIjoyMTA0MzExMDcyfQ.sKJHafDkIG8iKvBL_04TN0m-FJf0iwBgObWURV-Gk8w'
  'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aXN6dndmamNjdnVjcXBhY3RmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTA3MiwiZXhwIjoyMTA0MzExMDcyfQ.sKJHafDkIG8iKvBL_04TN0m-FJf0iwBgObWURV-Gk8w'
}
$students = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/students?select=id,name,gender&limit=30' -Headers $headers
foreach ($s in $students) {
  Write-Output "[$($s.gender)] $($s.name)"
}
