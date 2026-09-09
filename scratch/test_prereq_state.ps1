$html = Get-Content -Path 'admin.html' -Raw
if ($html -match 'prereqSelect\.disabled\s*=\s*false') {
    Write-Host 'prereqSelect.disabled is explicitly enabled: YES'
} else {
    Write-Host 'prereqSelect.disabled is explicitly enabled: NO (it was left disabled!)'
}
