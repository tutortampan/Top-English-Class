$html = Get-Content "admin.html" -Raw

Write-Host "=== VALIDATING JS SYNTAX IN ADMIN.HTML ===" -ForegroundColor Cyan

# Extract the main script block
$pattern = '(?s)<script type="module">(.*?)</script>'
if ($html -match $pattern) {
    $js = $matches[1]
    Write-Host "Found module script block, length: $($js.Length) chars"

    # Count brackets
    $openCurly = ($js.ToCharArray() | Where-Object { $_ -eq '{' }).Count
    $closeCurly = ($js.ToCharArray() | Where-Object { $_ -eq '}' }).Count
    Write-Host "Curly Braces: { = $openCurly, } = $closeCurly (Diff: $($openCurly - $closeCurly))"

    $openParen = ($js.ToCharArray() | Where-Object { $_ -eq '(' }).Count
    $closeParen = ($js.ToCharArray() | Where-Object { $_ -eq ')' }).Count
    Write-Host "Parentheses:  ( = $openParen, ) = $closeParen (Diff: $($openParen - $closeParen))"

    $openSquare = ($js.ToCharArray() | Where-Object { $_ -eq '[' }).Count
    $closeSquare = ($js.ToCharArray() | Where-Object { $_ -eq ']' }).Count
    Write-Host "Square Brackets: [ = $openSquare, ] = $closeSquare (Diff: $($openSquare - $closeSquare))"

    if ($openCurly -eq $closeCurly -and $openParen -eq $closeParen -and $openSquare -eq $closeSquare) {
        Write-Host "`nBRACKET & PAREN COUNTS ARE PERFECTLY BALANCED!" -ForegroundColor Green
    } else {
        Write-Host "`nBRACKET MISMATCH DETECTED!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Could not find module script block!" -ForegroundColor Red
    exit 1
}
