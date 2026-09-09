$html = Get-Content 'admin.html' -Raw

$suspects = @('escapeHtml','formatExamDisplayName','toLevelLetter','initConnectionBanner','showConsole','formatStudentName','getGrade')

Write-Host '=== Function Usage Audit in admin.html ===' -ForegroundColor Cyan
foreach ($name in $suspects) {
  $defined = ($html -match "function\s+$name\s*\(") -or ($html -match "const\s+$name\s*=")
  $called = $html.Contains($name)
  $status = if ($defined) { 'DEFINED' } elseif ($called) { 'CALLED_BUT_NOT_DEFINED' } else { 'NOT_PRESENT' }
  $color = if ($defined) { 'Green' } elseif ($called) { 'Red' } else { 'Gray' }
  Write-Host ("  {0,-30} -> {1}" -f $name, $status) -ForegroundColor $color
}

Write-Host ''
Write-Host '=== Checking if api.js exports match admin.html imports ===' -ForegroundColor Cyan
$apiContent = Get-Content 'js\api.js' -Raw
$adminImportLine = ($html -split "`n" | Select-String "from './js/api.js'").Line
Write-Host "Import line: $adminImportLine"
Write-Host ''

# Extract names from the import
if ($adminImportLine -match '\{([^}]+)\}') {
  $imports = $Matches[1] -split ',' | ForEach-Object { $_.Trim() }
  Write-Host 'Checking each imported name against api.js exports:'
  foreach ($imp in $imports) {
    $exported = $apiContent -match "export\s+(async\s+)?function\s+$imp\s*\(|export\s+(const|let)\s+$imp\s*="
    $color = if ($exported) { 'Green' } else { 'Red' }
    $label = if ($exported) { 'EXPORTED OK' } else { 'MISSING EXPORT!' }
    Write-Host ("  {0,-35} -> {1}" -f $imp, $label) -ForegroundColor $color
  }
}
