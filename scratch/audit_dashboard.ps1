$root = 'D:\Tutor Tampan\Top Class Web Builder\Top English Class'
$api = Get-Content "$root\js\api.js" -Raw
$session = Get-Content "$root\js\session.js" -Raw
$app = Get-Content "$root\js\app.js" -Raw
$pass = 0; $fail = 0

function OK   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:pass++ }
function FAIL ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:fail++ }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Dashboard Imports Full Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Dashboard imports from api.js
$dashApiImports = @(
  'fetchStudentSubjects','fetchLevels','fetchStudentProgress','fetchExamsForStudentLevel',
  'fetchStudentAttemptsForExam','fetchAllStudentAttempts','updateStudentPin',
  'uploadStudentPhoto','updateStudentGender','formatStudentName','toLevelLetter'
)
Write-Host "`n[1] DASHBOARD api.js imports" -ForegroundColor Magenta
foreach ($fn in $dashApiImports) {
  if ($api -match "export\s+(async\s+)?function\s+$fn\s*\(") {
    OK "$fn -> EXPORTED OK"
  } else {
    FAIL "$fn -> MISSING EXPORT in api.js"
  }
}

# Dashboard imports from session.js
Write-Host "`n[2] DASHBOARD session.js imports" -ForegroundColor Magenta
@('requireStudentSession','clearStudentSession','updateStudentSessionGender') | ForEach-Object {
  if ($session -match "export function $_") { OK "$_ -> EXPORTED OK" }
  else { FAIL "$_ -> MISSING in session.js" }
}

# Dashboard imports from app.js
Write-Host "`n[3] DASHBOARD app.js imports" -ForegroundColor Magenta
@('showToast','showLoading','hideLoading','getGrade') | ForEach-Object {
  if ($app -match "export function $_") { OK "$_ -> EXPORTED OK" }
  else { FAIL "$_ -> MISSING in app.js" }
}

# Verify no duplicate id in dashboard HTML
Write-Host "`n[4] DUPLICATE IDs CHECK" -ForegroundColor Magenta
$dashHtml = Get-Content "$root\dashboard.html" -Raw
$allIds = [regex]::Matches($dashHtml, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$idGroups = $allIds | Group-Object | Where-Object { $_.Count -gt 1 }
if ($idGroups) {
  foreach ($g in $idGroups) {
    FAIL "Duplicate id '$($g.Name)' found $($g.Count) times"
  }
} else {
  OK "No duplicate IDs found in dashboard.html"
}

# Verify critical HTML elements exist in dashboard
Write-Host "`n[5] DASHBOARD HTML ELEMENTS" -ForegroundColor Magenta
$dashIDs = @(
  'toast-container','subjects-grid','header-student-name','welcome-name','welcome-meta',
  'logout-btn','view-profile-btn','profile-modal','level-modal','levels-container',
  'level-modal-title','close-level-modal','header-avatar','avatar-container',
  'photo-file-input','change-pin-form','pin-old','pin-new','pin-confirm',
  'stat-overall-score','stat-overall-grade-badge','stat-exams-done'
)
foreach ($id in $dashIDs) {
  if ($dashHtml -match "id=""$id""") { OK "id='$id' present" }
  else { FAIL "id='$id' MISSING from dashboard.html" }
}

# Check requireStudentSession redirects to index.html on failure
Write-Host "`n[6] SESSION GUARD LOGIC" -ForegroundColor Magenta
if ($session -match "requireStudentSession") { OK "requireStudentSession defined" }
else { FAIL "requireStudentSession MISSING" }

if ($session -match "window\.location\.href") { OK "requireStudentSession does redirect" }
else { FAIL "requireStudentSession does NOT redirect" }

if ($dashHtml -match "requireStudentSession\(\)") { OK "dashboard.html calls requireStudentSession()" }
else { FAIL "dashboard.html does NOT call requireStudentSession()" }

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  PASS: $global:pass   FAIL: $global:fail" -ForegroundColor Cyan
if ($global:fail -eq 0) {
  Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
} else {
  Write-Host "  $global:fail FAILURES FOUND" -ForegroundColor Red
}
