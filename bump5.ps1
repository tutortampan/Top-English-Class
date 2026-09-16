$jsFiles = Get-ChildItem -Path 'js' -Recurse -Filter *.js
foreach ($f in $jsFiles) {
    $content = Get-Content $f.FullName
    $content = $content -replace '\?v=4\.0\.[0-9]', '?v=4.0.5'
    Set-Content -Path $f.FullName -Value $content
}

$htmlFiles = Get-ChildItem -Filter *.html
foreach ($f in $htmlFiles) {
    $content = Get-Content $f.FullName
    $content = $content -replace '\?v=4\.0\.[0-9]', '?v=4.0.5'
    Set-Content -Path $f.FullName -Value $content
}

$sw = Get-Content "sw.js"
$sw = $sw -replace '\?v=4\.0\.[0-9]', '?v=4.0.5'
$sw = $sw -replace 'abcd-system-v4\.0\.[0-9]', 'abcd-system-v4.0.5'
Set-Content -Path "sw.js" -Value $sw
