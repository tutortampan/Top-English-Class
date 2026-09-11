$lines = Get-Content 'admin.html'
$openB = 0
$closeB = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $opens = ([regex]::Matches($line, '\[')).Count
    $closes = ([regex]::Matches($line, '\]')).Count
    $openB += $opens
    $closeB += $closes
    if ($openB -ne $closeB) {
        # Check if line index is around our recent changes
        if ($i -gt 600 -and $i -lt 720) {
            Write-Host "Levels table line $($i+1): $line (open=$openB, close=$closeB)"
        }
        if ($i -gt 3100 -and $i -lt 3520) {
            Write-Host "Form line $($i+1): $line (open=$openB, close=$closeB)"
        }
    }
}
Write-Host "Final open: $openB, close: $closeB"
