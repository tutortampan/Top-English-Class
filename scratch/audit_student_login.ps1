# Student Login Chain — Comprehensive Automated Audit
# Tests: HTML structure, JS imports, module references, API logic, session flow, CSS

$root = 'D:\Tutor Tampan\Top Class Web Builder\Top English Class'
$pass = 0; $fail = 0; $warn = 0

function OK   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:pass++ }
function FAIL ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:fail++ }
function WARN ($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow; $global:warn++ }

$index   = Get-Content "$root\index.html"     -Raw -ErrorAction Stop
$api     = Get-Content "$root\js\api.js"      -Raw -ErrorAction Stop
$session = Get-Content "$root\js\session.js"  -Raw -ErrorAction Stop
$app     = Get-Content "$root\js\app.js"      -Raw -ErrorAction Stop
$style   = Get-Content "$root\css\style.css"  -Raw -ErrorAction Stop
$dash    = Get-Content "$root\dashboard.html" -Raw -ErrorAction Stop

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " TOP ENGLISH CLASS — Student Login Full Audit" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────
Write-Host "`n[1] HTML STRUCTURE" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
$htmlIDs = @(
  'toast-container','remember-me-banner','rmb-toggle','clear-session-link',
  'sec-program','list-program','search-program','step-num-1','sel-program-label','change-program-btn',
  'sec-class',  'list-class',  'search-class',  'step-num-2','sel-class-label',  'change-class-btn',
  'sec-batch',  'list-batch',  'search-batch',  'step-num-3','sel-batch-label',  'change-batch-btn',
  'sec-student','list-student','search-student','step-num-4','sel-student-label','change-student-btn',
  'sec-pin','pin-0','pin-1','pin-2','pin-3','login-btn','login-btn-text','pin-welcome-text',
  'admin-portal-link'
)
foreach ($id in $htmlIDs) {
  if ($index -match "id=""$id""") { OK "id='$id' present" }
  else { FAIL "id='$id' MISSING from index.html" }
}

# ─────────────────────────────────────────────────────────────
Write-Host "`n[2] MODULE IMPORTS (index.html -> api.js, session.js, app.js)" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
# Extract the import block from index.html
$importBlock = [regex]::Match($index, '<script type="module">([\s\S]+?)</script>').Groups[1].Value

# Functions imported from api.js
$apiImports = @('fetchPrograms','fetchClasses','fetchBatches','fetchStudentsByClass','verifyStudentLogin','formatStudentName')
foreach ($fn in $apiImports) {
  if ($importBlock -match $fn) {
    # Also verify it's actually exported from api.js
    if ($api -match "export\s+(async\s+)?function\s+$fn\s*\(|export\s+function\s+$fn") {
      OK "import '$fn' from api.js -> EXPORTED OK"
    } else {
      FAIL "import '$fn' from api.js -> NOT EXPORTED in api.js"
    }
  } else {
    FAIL "'$fn' NOT imported in index.html"
  }
}

# Functions imported from session.js
$sessionImports = @('setStudentSession','getStudentSession')
foreach ($fn in $sessionImports) {
  if ($importBlock -match $fn) {
    if ($session -match "export\s+function\s+$fn") {
      OK "import '$fn' from session.js -> EXPORTED OK"
    } else {
      FAIL "import '$fn' from session.js -> NOT EXPORTED"
    }
  } else {
    FAIL "'$fn' NOT imported in index.html"
  }
}

# Functions imported from app.js
$appImports = @('showToast','showLoading','hideLoading')
foreach ($fn in $appImports) {
  if ($importBlock -match $fn) {
    if ($app -match "export\s+function\s+$fn") {
      OK "import '$fn' from app.js -> EXPORTED OK"
    } else {
      FAIL "import '$fn' from app.js -> NOT EXPORTED"
    }
  } else {
    FAIL "'$fn' NOT imported in index.html"
  }
}

# ─────────────────────────────────────────────────────────────
Write-Host "`n[3] NO UNDEFINED VARIABLE REFERENCES IN MODULE SCRIPT" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
# Find all function/const/let/var declarations in the module script block
$declaredNames = [System.Collections.Generic.HashSet[string]]::new()
$importedNames = [System.Collections.Generic.HashSet[string]]::new()

# Collect declared function names
[regex]::Matches($importBlock, 'function\s+(\w+)\s*\(') | ForEach-Object { [void]$declaredNames.Add($_.Groups[1].Value) }
[regex]::Matches($importBlock, '(?:const|let|var)\s+(\w+)\s*=') | ForEach-Object { [void]$declaredNames.Add($_.Groups[1].Value) }

# Collect imported names from import statements
[regex]::Matches($importBlock, '\{([^}]+)\}\s+from') | ForEach-Object {
  $_.Groups[1].Value -split ',' | ForEach-Object { [void]$importedNames.Add($_.Trim()) }
}

# Check for ReferenceError-prone patterns: calling undefined names
$knownSafe = $declaredNames + $importedNames + @('window','document','localStorage','sessionStorage',
  'console','setTimeout','clearTimeout','Date','JSON','Math','Array','Object','String','Number',
  'Boolean','Error','Promise','fetch','crypto','event','navigator','location','history',
  'parseInt','parseFloat','isNaN','encodeURIComponent','decodeURIComponent','URL')

# Check critical names are all defined
$criticalUsed = @('state','fetchPrograms','fetchClasses','fetchBatches','fetchStudentsByClass',
  'verifyStudentLogin','setStudentSession','getStudentSession','showToast','showLoading','hideLoading',
  'loadPrograms','loadClasses','loadBatches','loadStudents','renderOptions','resetFrom',
  'checkPinComplete','restoreSavedLogin')

foreach ($name in $criticalUsed) {
  $isDeclared = $declaredNames -contains $name
  $isImported = $importedNames -contains $name
  if ($isDeclared -or $isImported) {
    OK "'$name' is defined/imported"
  } elseif ($importBlock -match $name) {
    WARN "'$name' is used but not found in declaration list (may be safe)"
  } else {
    FAIL "'$name' NOT defined and NOT found in module script"
  }
}

# ─────────────────────────────────────────────────────────────
Write-Host "`n[4] API LOGIC VALIDATION" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
# verifyStudentLogin should have Edge Function fallback
if ($api -match 'student-login') { OK "verifyStudentLogin has Edge Function path" }
else { WARN "No 'student-login' Edge Function reference in api.js" }

if ($api -match 'sha256') { OK "PIN hashing (sha256) function present" }
else { FAIL "PIN sha256 hash function MISSING from api.js" }

if ($api -match 'isPlaceholderUrl') { OK "Placeholder URL guard present (fallback to mock data)" }
else { FAIL "isPlaceholderUrl function MISSING" }

if ($api -match 'MOCK_STUDENTS') { OK "Mock student data present for offline/demo mode" }
else { WARN "No mock student data - offline mode may fail" }

if ($api -match 'pin_hash') { OK "PIN hash comparison implemented" }
else { FAIL "PIN hash comparison MISSING" }

if ($api -match 'is_active.*true\|is_active.*false\|\.eq.*is_active') {
  OK "is_active filter present in student query"
} else { WARN "is_active filter not found - may return inactive students" }

if ($api -match 'deleted_at') { OK "Soft-delete filter present in queries" }
else { WARN "deleted_at filter not found - may return deleted records" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n[5] SESSION MANAGEMENT" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
$sessionFns = @('setStudentSession','getStudentSession','clearStudentSession','requireStudentSession',
                'setAdminSession','getAdminSession','clearAdminSession','requireAdminSession',
                'updateStudentSessionGender')
foreach ($fn in $sessionFns) {
  if ($session -match "export function $fn") { OK "session.js exports '$fn'" }
  else { FAIL "session.js MISSING export '$fn'" }
}

if ($session -match "SESSION_KEY") { OK "SESSION_KEY constant defined" }
else { FAIL "SESSION_KEY MISSING from session.js" }

if ($session -match "sessionStorage") { OK "sessionStorage used (correct - not localStorage)" }
else { FAIL "sessionStorage not used in session.js" }

if ($session -match "JSON.parse.*JSON.stringify|JSON.stringify.*JSON.parse") {
  OK "JSON serialization used for session data"
} else { WARN "JSON serialization pattern not detected" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n[6] LOGIN FLOW LOGIC" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
if ($index -match "getStudentSession.*dashboard|dashboard.*getStudentSession") {
  OK "Existing session redirect to dashboard.html present"
} else { FAIL "Missing redirect: logged-in users not redirected to dashboard" }

if ($index -match "pin-0.*focus|focus.*pin-0") { OK "PIN focus auto-advance present" }
else { WARN "PIN auto-focus not detected" }

if ($index -match "Enter.*loginBtn|loginBtn.*Enter") { OK "Enter key triggers login button" }
else { WARN "Enter key binding not detected" }

if ($index -match "Backspace") { OK "PIN backspace handling present" }
else { WARN "PIN backspace handling not detected" }

if ($index -match "paste") { OK "PIN paste handler present" }
else { WARN "PIN paste handler not detected" }

if ($index -match "window\.location.*dashboard") { OK "Successful login redirects to dashboard.html" }
else { FAIL "Successful login does NOT redirect to dashboard.html" }

if ($index -match "disabled = true.*disabled = false|login-btn.*disabled") {
  OK "Login button disabled state managed"
} else { WARN "Login button disabled state not detected" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n[7] DASHBOARD SESSION GUARD" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
if ($dash -match "getStudentSession|requireStudentSession") {
  OK "dashboard.html checks for student session"
} else { FAIL "dashboard.html has NO session guard - any user can access it" }

if ($dash -match "index\.html") { OK "dashboard.html redirects to index.html when unauthenticated" }
else { WARN "dashboard.html may not redirect unauthenticated users" }

if ($dash -match "session\.js") { OK "dashboard.html imports from session.js" }
else { FAIL "dashboard.html does NOT import session.js" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n[8] SUPABASE CONFIG" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
$supa = Get-Content "$root\js\supabase.js" -Raw
if ($supa -match 'YOUR_PROJECT|placeholder|REPLACE_ME') {
  FAIL "Supabase URL/Key still has placeholder value"
} else {
  OK "Supabase URL/Key appear to be set (not placeholder)"
}

if ($supa -match 'esm\.sh.*supabase') { OK "Supabase loaded from CDN (esm.sh)" }
else { WARN "Supabase CDN import path not found" }

if ($supa -match 'createClient') { OK "Supabase createClient call present" }
else { FAIL "Supabase createClient MISSING" }

if ($supa -match 'persistSession.*true') { OK "Supabase persistSession:true configured" }
else { WARN "persistSession not explicitly set to true" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n[9] CSS COMPLETENESS" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
$cssClasses = @('.spinner','--clr-bg-1','--clr-primary','--clr-surface-2','--space-1','--space-2')
foreach ($cls in $cssClasses) {
  if ($style -match [regex]::Escape($cls)) { OK "$cls defined in style.css" }
  else { WARN "$cls not found in style.css (index.html has inline styles as fallback)" }
}

# ─────────────────────────────────────────────────────────────
Write-Host "`n[10] LOADING OVERLAY" -ForegroundColor Magenta
# ─────────────────────────────────────────────────────────────
if ($app -match "loading-overlay") { OK "loading-overlay class used in showLoading()" }
else { WARN "loading-overlay class not in app.js" }

if ($style -match "loading-overlay") { OK ".loading-overlay CSS defined in style.css" }
else { FAIL ".loading-overlay CSS MISSING from style.css - loading overlay won't render" }

# ─────────────────────────────────────────────────────────────
Write-Host "`n=== FINAL SUMMARY ===" -ForegroundColor Cyan
Write-Host "  PASS: $global:pass" -ForegroundColor Green
Write-Host "  FAIL: $global:fail" -ForegroundColor Red
Write-Host "  WARN: $global:warn" -ForegroundColor Yellow

if ($global:fail -eq 0) {
  Write-Host "`n  ALL CRITICAL CHECKS PASSED" -ForegroundColor Green
} else {
  Write-Host "`n  $global:fail CRITICAL FAILURES FOUND - fix before testing" -ForegroundColor Red
}
