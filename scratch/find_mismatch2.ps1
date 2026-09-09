$lines = Get-Content 'admin.html'
$openB = 0
$closeB = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $opens = ([regex]::Matches($line, '\[')).Count
    $closes = ([regex]::Matches($line, '\]')).Count
    $openB += $opens
    $closeB += $closes
}
Write-Host "Total [ = $openB, Total ] = $closeB"

# Let's track line by line where the net difference never comes back to 0
$diff = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $opens = ([regex]::Matches($line, '\[')).Count
    $closes = ([regex]::Matches($line, '\]')).Count
    $prevDiff = $diff
    $diff += ($opens - $closes)
    # Print if diff jumped from 0 to 1 and stayed 1
    if ($diff -eq 1 -and $prevDiff -eq 0) {
        $lastZeroToPositive = $i + 1
    }
}
Write-Host "Last transition from 0 to 1 happened at line: $lastZeroToPositive"
Write-Host "Content: " $lines[$lastZeroToPositive - 1]
