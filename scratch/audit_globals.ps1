$html = Get-Content 'admin.html' -Raw

Write-Host '=== window._ assignments (explicit global exposures) ===' -ForegroundColor Cyan
$winMatches = [regex]::Matches($html, 'window\.(\w+)\s*=')
foreach ($m in $winMatches) { Write-Host ('  window.' + $m.Groups[1].Value) }

Write-Host ''
Write-Host '=== Functions called in onclick attributes inside JS template strings ===' -ForegroundColor Yellow
# Find onclick="funcName(" patterns inside backtick template literals
$onclickMatches = [regex]::Matches($html, "onclick=""([a-zA-Z_][a-zA-Z0-9_]*)\(")
$uniqueFuncs = [System.Collections.Generic.HashSet[string]]::new()
foreach ($m in $onclickMatches) {
  [void]$uniqueFuncs.Add($m.Groups[1].Value)
}
foreach ($f in $uniqueFuncs | Sort-Object) {
  Write-Host "  $f"
}

Write-Host ''
Write-Host '=== Imported module names that are NOT exposed as window.* ===' -ForegroundColor Red
$importedNames = @('formatStudentName','getGrade','toLevelLetter','escapeHtml','formatExamDisplayName')
foreach ($name in $importedNames) {
  $exposedAsWindow = $html -match "window\.$name\s*="
  $calledInOnclick = $html -match "onclick=""$name\("
  Write-Host ("  {0,-30} window_exposed={1,5} onclick_called={2,5}" -f $name, $exposedAsWindow, $calledInOnclick)
}
