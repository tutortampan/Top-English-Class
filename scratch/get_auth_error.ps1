try {
    $res = Invoke-WebRequest -Uri "https://xuiszvwfjccvucqpactf.supabase.co/auth/v1/token?grant_type=password" `
        -Method Post `
        -Headers @{ "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4" } `
        -ContentType "application/json" `
        -Body '{"email":"admin@admin.local","password":"admin123"}'
    Write-Host $res.Content
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Error Body: $($reader.ReadToEnd())"
    }
}
