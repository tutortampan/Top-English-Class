$replacements = @{
  'A,?oA' = '📥';
  'A,?o' = '📤';
  'A,?"?~A_A,A?' = '🗑️';
  'A,?~A' = '👥';
  'A,A??A_A,A?' = '👤';
  'A,?~A ' = '👤';
  'A,???z' = '🔄';
  'A,??A?' = '🔍';
  'A,?TA' = '📊';
  'A,,' = '💾';
  'A"??A_A,A?' = '🟢';
  'A?"A A_A,A?' = '🚧';
  'A,???T' = '⏱️';
  'A,?oA?' = '📁';
  'Ã¢Å“Â Ã¯Â¸Â ' = '✏️';
  'Ã°Å¸â€”â€˜Ã¯Â¸Â ' = '🗑️';
  'Ã¢â€ â€™' = '→';
  'Ã°Å¸â€œÂ¤' = '📥';
  'âœï¸ ' = '✏️';
  'âœ ï¸ ' = '✏️';
  'Ã¢Å“â€œ' = '✓';
  'Ã°Å¸â€œÂ¥' = '📤';
  'Ã°Å¸â€œÅ ' = '📊';
  'Ã°Å¸Â¤â€˜' = '👨';
  'Ã°Å¸Â¤â€™' = '👩';
  'â€”' = '—';
  'â†’' = '→';
  'ðŸ’¾' = '💾';
  'ðŸ“¥' = '📥';
  'ðŸ“¤' = '📤';
  'ðŸ“Š' = '📊';
  'ðŸ› ï¸ ' = '🛠️';
  'âš¡' = '⚡';
  'ðŸ”„' = '🔄';
  'ðŸ ›ï¸ ' = '🏛️';
  'ðŸ‘¤' = '👤';
  'ðŸ“„' = '📄';
  'ðŸŽ™ï¸ ' = '🎙️';
  'ðŸ”˜' = '🔘';
  'ðŸ‘¥' = '👥';
  'ðŸ“ ' = '📉';
  'ðŸŸ¢' = '🟢';
  'ðŸš§' = '🚧';
  'ðŸ”€' = '🔀';
  'âž¡ï¸ ' = '➡️';
  'â ±ï¸ ' = '⏱️';
  'ðŸŽ¯' = '🎯';
  'ðŸ”½' = '🔽';
  'ðŸŒ ' = '🌍';
  'ðŸ”’' = '🔒';
  'ðŸ—‘ï¸ ' = '🗑️';
  'ðŸ“œ' = '📜';
  'ðŸ” ' = '🔍';
  'ðŸ‘¨' = '👨';
  'ðŸ‘©' = '👩';
  'âœ“' = '✓'
}

$files = Get-ChildItem -Path js, css, index.html, dashboard.html -Include *.js, *.css, *.html -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }
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
