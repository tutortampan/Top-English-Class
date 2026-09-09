$lines = Get-Content "admin.html"
$lineNum = 0
$balance = 0
foreach ($line in $lines) {
    $lineNum++
    $openCount = [regex]::Matches($line, '\[').Count
    $closeCount = [regex]::Matches($line, '\]').Count
    $balance += ($openCount - $closeCount)
    if ($openCount -ne $closeCount) {
        # Write-Host "Line $lineNum (Balance $balance): $line"
    }
}
Write-Host "Final square bracket balance across entire HTML: $balance"

# Check where the balance shifts and never returns
$b = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $o = [regex]::Matches($line, '\[').Count
    $c = [regex]::Matches($line, '\]').Count
    $prev = $b
    $b += ($o - $c)
    if ($b -gt $prev -and $b -eq 1) {
        Write-Host "Balance first became 1 at Line $($i+1): $line"
    }
}
