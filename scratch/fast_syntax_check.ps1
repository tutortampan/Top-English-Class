$html = Get-Content "admin.html" -Raw

$pattern = '(?s)<script type="module">(.*?)</script>'
if ($html -match $pattern) {
    $js = $matches[1]

    $openParen = [regex]::Matches($js, '\(').Count
    $closeParen = [regex]::Matches($js, '\)').Count
    Write-Host "Parentheses:  ( = $openParen, ) = $closeParen (Diff: $($openParen - $closeParen))"

    $openSquare = [regex]::Matches($js, '\[').Count
    $closeSquare = [regex]::Matches($js, '\]').Count
    Write-Host "Square Brackets: [ = $openSquare, ] = $closeSquare (Diff: $($openSquare - $closeSquare))"

    $openCurly = [regex]::Matches($js, '\{').Count
    $closeCurly = [regex]::Matches($js, '\}').Count
    Write-Host "Curly Braces: { = $openCurly, } = $closeCurly (Diff: $($openCurly - $closeCurly))"

    if ($openCurly -eq $closeCurly -and $openParen -eq $closeParen -and $openSquare -eq $closeSquare) {
        Write-Host "`nSUCCESS: ALL BRACKETS AND PARENTHESES ARE 100% BALANCED!" -ForegroundColor Green
    } else {
        Write-Host "`nFAIL: MISMATCH DETECTED!" -ForegroundColor Red
        exit 1
    }
}
