$html = Get-Content 'admin.html' -Raw
$scripts = [regex]::Matches($html, '(?s)<script\b[^>]*>(.*?)</script>')
$idx = 1
foreach ($m in $scripts) {
    $code = $m.Groups[1].Value
    # Strip comments
    $stripped = [regex]::Replace($code, '(?s)/\*.*?\*/', '')
    $stripped = [regex]::Replace($stripped, '//[^\r\n]*', '')
    # Strip strings
    $stripped = [regex]::Replace($stripped, "'[^'\\]*(?:\\.[^'\\]*)*'", "''")
    $stripped = [regex]::Replace($stripped, '"[^"\\]*(?:\\.[^"\\]*)*"', '""')

    $pOpen = ([regex]::Matches($stripped, '\(')).Count
    $pClose = ([regex]::Matches($stripped, '\)')).Count
    $bOpen = ([regex]::Matches($stripped, '\[')).Count
    $bClose = ([regex]::Matches($stripped, '\]')).Count
    $cOpen = ([regex]::Matches($stripped, '\{')).Count
    $cClose = ([regex]::Matches($stripped, '\}')).Count

    Write-Host "Script ${idx}:"
    Write-Host "  Parens:  ( = $pOpen, ) = $pClose (diff: $($pOpen - $pClose))"
    Write-Host "  Brackets:[ = $bOpen, ] = $bClose (diff: $($bOpen - $bClose))"
    Write-Host "  Braces:  { = $cOpen, } = $cClose (diff: $($cOpen - $cClose))"
    $idx++
}
