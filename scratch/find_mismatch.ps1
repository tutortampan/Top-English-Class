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
        Write-Host "First mismatch at line $($i+1): $line"
        break
    }
}
