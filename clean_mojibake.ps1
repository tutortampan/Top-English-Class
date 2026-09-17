$replacements = @{
    "â€”" = "—"
    "â†’" = "→"
    "ðŸ’¾" = "💾"
    "ðŸ“¥" = "📥"
    "ðŸ“¤" = "📤"
    "ðŸ“Š" = "📊"
    "ðŸ› ï¸ " = "🛠️"
    "âš¡" = "⚡"
    "ðŸ”„" = "🔄"
    "ðŸ ›ï¸ " = "🏛️"
    "ðŸ‘¤" = "👤"
    "ðŸ“„" = "📄"
    "ðŸŽ™ï¸ " = "🎙️"
    "ðŸ”˜" = "🔘"
    "ðŸ‘¥" = "👥"
    "ðŸ“ " = "📉"
    "ðŸŸ¢" = "🟢"
    "ðŸš§" = "🚧"
    "ðŸ”€" = "🔀"
    "âž¡ï¸ " = "➡️"
    "â ±ï¸ " = "⏱️"
    "ðŸŽ¯" = "🎯"
    "ðŸ”½" = "🔽"
    "ðŸŒ " = "🌍"
    "ðŸ”’" = "🔒"
    "ðŸ—‘ï¸ " = "🗑️"
    "ðŸ“œ" = "📜"
    "ðŸ” " = "🔍"
    "ðŸ‘¨" = "👨"
    "ðŸ‘©" = "👩"
    "âœ“" = "✓"
}

$files = Get-ChildItem -Path . -Include *.js, *.css, *.html -Recurse | Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $changed = $false
    foreach ($key in $replacements.Keys) {
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $replacements[$key])
            $changed = $true
        }
    }
    if ($changed) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed mojibake in: $($file.FullName)"
    }
}
