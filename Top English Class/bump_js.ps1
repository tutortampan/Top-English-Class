$files = Get-ChildItem -Path "js" -Recurse -Filter *.js
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $newContent = $content -replace '\?v=4\.0\.\d', '?v=4.0.4'
    if ($content -cne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent
    }
}
