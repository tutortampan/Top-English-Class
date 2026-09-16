$files = Get-ChildItem -Filter *.html
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $content = $content -replace '\?v=4\.0\.0', '?v=4.0.1'
    Set-Content -Path $file.FullName -Value $content
}

$sw = Get-Content "sw.js"
$sw = $sw -replace '\?v=4\.0\.0', '?v=4.0.1'
$sw = $sw -replace 'abcd-system-v4\.0\.0', 'abcd-system-v4.0.1'
Set-Content -Path "sw.js" -Value $sw
