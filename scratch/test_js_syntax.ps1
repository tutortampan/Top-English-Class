$html = Get-Content 'admin.html' -Raw
$scripts = [regex]::Matches($html, '(?s)<script\b[^>]*>(.*?)</script>')
Write-Host "Found scripts: $($scripts.Count)"
$idx = 1
foreach ($m in $scripts) {
    $code = $m.Groups[1].Value
    $tmp = "scratch/test_script_$idx.js"
    Set-Content -Path $tmp -Value $code
    $nodeRes = node -c $tmp 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script $idx syntax: PASS"
    } else {
        Write-Host "Script $idx syntax: ERROR: $nodeRes"
    }
    $idx++
}
