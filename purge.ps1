
$files = Get-ChildItem -Path . -Recurse -Include *.html,*.js,*.css | Where-Object { $_.FullName -notmatch 'node_modules|\.git' }
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $newContent = $content -replace 'Affairs', 'Admin' -replace 'AFFAIRS', 'ADMIN' -replace 'affairs', 'admin' -replace 'Blueprints', 'Board' -replace 'BLUEPRINTS', 'BOARD' -replace 'blueprints', 'board'
    if ($content -cne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "Updated $($file.FullName)"
    }
}

