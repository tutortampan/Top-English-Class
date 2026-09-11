# Automated Verification Script for Student Gender Assignment Workflow

Write-Host "===================================================="
Write-Host " RUNNING VERIFICATION: STUDENT GENDER ASSIGNMENT    "
Write-Host "===================================================="

$errors = @()

# 1. Check js/session.js
$sessionContent = Get-Content "js/session.js" -Raw
if ($sessionContent -match 'gender:\s*data\.gender\s*\|\|\s*null') {
    Write-Host "[PASS] js/session.js stores gender in student session." -ForegroundColor Green
} else {
    $errors += "js/session.js missing gender in setStudentSession"
}

if ($sessionContent -match 'export function updateStudentSessionGender') {
    Write-Host "[PASS] js/session.js exports updateStudentSessionGender." -ForegroundColor Green
} else {
    $errors += "js/session.js missing updateStudentSessionGender"
}

# 2. Check js/api.js
$apiContent = Get-Content "js/api.js" -Raw
if ($apiContent -match 'export async function updateStudentGender') {
    Write-Host "[PASS] js/api.js exports updateStudentGender." -ForegroundColor Green
} else {
    $errors += "js/api.js missing updateStudentGender"
}

if ($apiContent -match 'formatStudentName\(rawClean,\s*g\)') {
    Write-Host "[PASS] js/api.js synchronizes name with honorific title on gender update." -ForegroundColor Green
} else {
    $errors += "js/api.js missing formatStudentName title synchronization in updateStudentGender"
}

# 3. Check index.html
$indexContent = Get-Content "index.html" -Raw
if ($indexContent -match 'gender:\s*result\.student\?\.gender\s*\|\|\s*null') {
    Write-Host "[PASS] index.html passes student gender to setStudentSession." -ForegroundColor Green
} else {
    $errors += "index.html missing gender in setStudentSession payload"
}

# 4. Check dashboard.html
$dashContent = Get-Content "dashboard.html" -Raw
if ($dashContent -match 'id="gender-setup-modal"') {
    Write-Host "[PASS] dashboard.html contains First-Entry Gender Setup Modal." -ForegroundColor Green
} else {
    $errors += "dashboard.html missing gender-setup-modal"
}

if ($dashContent -match 'id="btn-prof-male"' -and $dashContent -match 'id="btn-prof-female"') {
    Write-Host "[PASS] dashboard.html contains profile gender change buttons." -ForegroundColor Green
} else {
    $errors += "dashboard.html missing profile gender buttons"
}

if ($dashContent -match 'checkAndPromptGender') {
    Write-Host "[PASS] dashboard.html calls checkAndPromptGender on load." -ForegroundColor Green
} else {
    $errors += "dashboard.html missing checkAndPromptGender"
}

# 5. Check admin.html
$adminContent = Get-Content "admin.html" -Raw
if ($adminContent -match "let gender = 'female';") {
    $errors += "admin.html STILL has hardcoded 'female' fallback!"
} else {
    Write-Host "[PASS] admin.html removed hardcoded 'female' fallback." -ForegroundColor Green
}

if ($adminContent -match 'let gender = null;') {
    Write-Host "[PASS] admin.html initializes gender to null (unassigned)." -ForegroundColor Green
} else {
    $errors += "admin.html missing let gender = null;"
}

if ($adminContent -match 'Unassigned') {
    Write-Host "[PASS] admin.html displays Unassigned badge in preview table." -ForegroundColor Green
} else {
    $errors += "admin.html missing Unassigned badge in preview table"
}

if ($adminContent -match 'Student will choose') {
    Write-Host "[PASS] admin.html student CRUD modal includes Unassigned gender option." -ForegroundColor Green
} else {
    $errors += "admin.html student form missing Unassigned option"
}

# 6. Check supabase/functions/student-login/index.ts
$edgeContent = Get-Content "supabase/functions/student-login/index.ts" -Raw
if ($edgeContent -match 'gender:\s*student\.gender\s*\|\|\s*null') {
    Write-Host "[PASS] Edge Function returns gender in response." -ForegroundColor Green
} else {
    $errors += "Edge Function missing gender in response payload"
}

Write-Host "`n----------------------------------------------------"
if ($errors.Count -eq 0) {
    Write-Host " ALL CHECKS PASSED! (0 ERRORS) " -ForegroundColor Green
    Write-Host "----------------------------------------------------"
    Exit 0
} else {
    Write-Host " VERIFICATION FAILED WITH ERRORS: " -ForegroundColor Red
    $errors | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    Write-Host "----------------------------------------------------"
    Exit 1
}
