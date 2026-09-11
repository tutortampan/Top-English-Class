$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"
$l = Invoke-RestMethod -Uri "$baseUrl/levels?select=*&limit=1" -Headers $h
Write-Host "Levels columns:" ($l | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)
