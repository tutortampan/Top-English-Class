Write-Host "=== ADMIN PORTAL FIX VERIFICATION ===" -ForegroundColor Cyan

$root = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
$adminHtml = Get-Content "$root\admin.html" -Raw -ErrorAction Stop
$styleCss  = Get-Content "$root\css\style.css" -Raw -ErrorAction Stop

$errors = 0
$total  = 0

function Check($label, $pass) {
  $global:total++
  if ($pass) {
    Write-Host "  PASS: $label" -ForegroundColor Green
  } else {
    Write-Host "  FAIL: $label" -ForegroundColor Red
    $global:errors++
  }
}

Write-Host "`n--- CSS Variables ---" -ForegroundColor Yellow
Check "--clr-primary defined"    ($styleCss -match '--clr-primary:')
Check "--clr-surface-2 defined"  ($styleCss -match '--clr-surface-2:')

Write-Host "`n--- Utility Classes ---" -ForegroundColor Yellow
foreach ($cls in @('.justify-end', '.flex-wrap', '.flex-column', '.align-end', '.d-block', '.ml-1', '.ml-2', '.mb-1', '.mb-3', '.btn-warning')) {
  Check "$cls in style.css" ($styleCss -match [regex]::Escape($cls))
}

Write-Host "`n--- Removed Broken Nav Refs ---" -ForegroundColor Yellow
foreach ($bad in @('subnav-database', 'subnav-class', 'subnav-student', 'subnav-exam')) {
  Check "'$bad' removed from admin.html" (-not ($adminHtml -match [regex]::Escape($bad)))
}

Write-Host "`n--- New Navigation Logic Present ---" -ForegroundColor Yellow
foreach ($ref in @('domainToPanelMap', 'sectionDomainMap', 'activatePrimaryTab', 'mobileTabs', 'topbar-domain', 'domainToPanelMap')) {
  Check "'$ref' present in admin.html" ($adminHtml -match [regex]::Escape($ref))
}

Write-Host "`n--- Admin Login Still Working ---" -ForegroundColor Yellow
Check "admin-login-btn present"     ($adminHtml -match 'id="admin-login-btn"')
Check "admin123 default creds hint" ($adminHtml -match 'admin123')
Check "showConsole function"         ($adminHtml -match 'function showConsole')

Write-Host ""
if ($errors -eq 0) {
  Write-Host "=== ALL $total CHECKS PASSED - 0 errors ===" -ForegroundColor Green
} else {
  Write-Host "=== $errors of $total CHECKS FAILED ===" -ForegroundColor Red
}
