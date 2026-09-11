$html = Get-Content 'admin.html' -Raw

Write-Host '=== CRITICAL: Checking for undefined variable references ===' -ForegroundColor Cyan

$dangerVars = @('primaryTabs', 'domainPills', 'subnav-database', 'subnav-class', 'subnav-student', 'subnav-exam')
$allClear = $true
foreach ($v in $dangerVars) {
  if ($html -match [regex]::Escape($v)) {
    Write-Host "  FAIL: '$v' still present in admin.html" -ForegroundColor Red
    $allClear = $false
  } else {
    Write-Host "  PASS: '$v' correctly absent" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '=== Login Handler Verification ===' -ForegroundColor Cyan
$checks = @{
  'admin-login-btn present'         = $html -match 'admin-login-btn'
  'admin-login-btn click handler'   = $html -match "admin-login-btn.*addEventListener"
  'showConsole defined'             = $html -match 'function showConsole'
  'loadSection defined'             = $html -match 'async function loadSection'
  'activatePrimaryTab defined'      = $html -match 'function activatePrimaryTab'
  'mobileTabs declared'             = $html -match 'const mobileTabs'
  'sectionDomainMap declared'       = $html -match 'const sectionDomainMap'
  'domainToPanelMap declared'       = $html -match 'const domainToPanelMap'
  'Admin login screen present'      = $html -match 'id="admin-login-screen"'
  'Admin console present'           = $html -match 'id="admin-console"'
  'Mobile tabs exist'               = $html -match 'class="mobile-tab"'
  'Session restore on load'         = $html -match 'getAdminSession'
}
foreach ($k in $checks.Keys | Sort-Object) {
  $pass = $checks[$k]
  $color = if ($pass) { 'Green' } else { 'Red' }
  $label = if ($pass) { 'PASS' } else { 'FAIL' }
  Write-Host ("  {0,-45} {1}" -f $k, $label) -ForegroundColor $color
}

Write-Host ''
if ($allClear) {
  Write-Host '=== All dangerous references removed ===' -ForegroundColor Green
} else {
  Write-Host '=== WARNING: Dangerous references still present ===' -ForegroundColor Red
}
