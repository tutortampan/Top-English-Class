$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
}
$body = '{"email":"admin@admin.local","password":"admin123"}'
try {
    $res = Invoke-RestMethod -Uri "https://xuiszvwfjccvucqpactf.supabase.co/auth/v1/token?grant_type=password" -Method Post -Headers $h -Body $body
    Write-Host "Success:" ($res | ConvertTo-Json)
} catch {
    Write-Host "Auth Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
