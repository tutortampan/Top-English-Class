$files = Get-ChildItem -Path . -Recurse -Include *.js, *.html
foreach ($f in $files) {
    if ($f.FullName -match "node_modules") { continue }
    $content = Get-Content $f.FullName -Raw
    $newContent = $content -replace 'v=4\.0\.16', 'v=4.0.17'
    
    if ($content -cne $newContent) {
        Set-Content -Path $f.FullName -Value $newContent -NoNewline
    }
}
