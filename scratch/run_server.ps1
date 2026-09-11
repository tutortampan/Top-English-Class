$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server started at http://localhost:8080/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    
    $localPath = $req.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "admin.html" }
    
    $filePath = Join-Path (Get-Location) $localPath
    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        if ($localPath.EndsWith(".html")) { $res.ContentType = "text/html; charset=utf-8" }
        elseif ($localPath.EndsWith(".css")) { $res.ContentType = "text/css; charset=utf-8" }
        elseif ($localPath.EndsWith(".js")) { $res.ContentType = "application/javascript; charset=utf-8" }
        elseif ($localPath.EndsWith(".json")) { $res.ContentType = "application/json; charset=utf-8" }
        elseif ($localPath.EndsWith(".png")) { $res.ContentType = "image/png" }
        
        $res.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        $res.Headers.Add("Pragma", "no-cache")
        $res.Headers.Add("Expires", "0")
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
    }
    $res.Close()
}
