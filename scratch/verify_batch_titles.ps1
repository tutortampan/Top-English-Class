# Automated verification script for Batch entity, Mr./Miss titles, Overall Score, and Global Grade

$errors = @()

Write-Host "=== VERIFYING FORMAT STUDENT NAME IN JS/API.JS ===" -ForegroundColor Cyan
$apiContent = Get-Content -Raw "d:\Tutor Tampan\Top Class Web Builder\Top English Class\js\api.js"

if ($apiContent -match 'export function formatStudentName') {
    Write-Host "Passed: formatStudentName is exported in js/api.js" -ForegroundColor Green
} else {
    $errors += "formatStudentName is NOT exported in js/api.js"
}

if ($apiContent -match 'Miss\s+\$\{clean\}' -and $apiContent -match 'Mr\.\s+\$\{clean\}') {
    Write-Host "Passed: formatStudentName prefixes 'Miss' for females and 'Mr.' for males" -ForegroundColor Green
} else {
    $errors += "formatStudentName prefixing logic missing or incorrect"
}

if ($apiContent -like "*replace(/^(mr*") {
    Write-Host "Passed: formatStudentName strips existing title before prepending" -ForegroundColor Green
} else {
    $errors += "formatStudentName regex to strip existing titles missing"
}

Write-Host "`n=== VERIFYING SUPABASE SCHEMA ===" -ForegroundColor Cyan
$sqlContent = Get-Content -Raw "d:\Tutor Tampan\Top Class Web Builder\Top English Class\supabase-setup.sql"

if ($sqlContent -match 'CREATE TABLE( IF NOT EXISTS)? batches') {
    Write-Host "Passed: batches table exists in supabase-setup.sql" -ForegroundColor Green
} else {
    $errors += "batches table missing in supabase-setup.sql"
}

if ($sqlContent -match 'batch_id\s+UUID\s+REFERENCES\s+batches') {
    Write-Host "Passed: batch_id foreign key added to students table in supabase-setup.sql" -ForegroundColor Green
} else {
    $errors += "batch_id foreign key missing in students table in supabase-setup.sql"
}

Write-Host "`n=== VERIFYING ADMIN CONSOLE (admin.html) ===" -ForegroundColor Cyan
$adminContent = Get-Content -Raw "d:\Tutor Tampan\Top Class Web Builder\Top English Class\admin.html"

# Verify Batches navigation
if ($adminContent -match 'data-sub="batches"') {
    Write-Host "Passed: Batches sub-navigation item exists in admin.html" -ForegroundColor Green
} else {
    $errors += "Batches navigation item missing in admin.html"
}

# Verify columns in Students table: Batch next to Class, Overall Score, Global Grade
$classBatchRegex = '<th[^>]*>Class<\/th>\s*<th[^>]*>Batch<\/th>'
if ($adminContent -match $classBatchRegex) {
    Write-Host "Passed: 'Batch' column is positioned immediately next to 'Class' column in Students table header" -ForegroundColor Green
} else {
    $errors += "Batch column is NOT positioned immediately next to Class column in Students table"
}

if ($adminContent -match '<th[^>]*>Overall Score<\/th>' -and $adminContent -match '<th[^>]*>Global Grade<\/th>') {
    Write-Host "Passed: 'Overall Score' and 'Global Grade' columns exist in Students table header" -ForegroundColor Green
} else {
    $errors += "Overall Score or Global Grade column missing in Students table header"
}

# Verify hierarchy in formFields
if ($adminContent -match "id:\s*'program_id'[\s\S]*?id:\s*'class_id'[\s\S]*?id:\s*'batch_id'") {
    Write-Host "Passed: formFields.students defines Program -> Class -> Batch hierarchy" -ForegroundColor Green
} else {
    $errors += "formFields.students does not follow Program -> Class -> Batch order"
}

# Verify cascading dropdown dependency
if ($adminContent -match 'populateBatchesForClass' -and $adminContent -match 'populateClassesForProgram') {
    Write-Host "Passed: Cascading dependency logic exists in admin.html openCrudModal" -ForegroundColor Green
} else {
    $errors += "Cascading dependency logic missing in admin.html"
}

Write-Host "`n=== VERIFYING STUDENT CONSOLE (index.html and dashboard.html) ===" -ForegroundColor Cyan
$indexContent = Get-Content -Raw "d:\Tutor Tampan\Top Class Web Builder\Top English Class\index.html"

# Verify 5 steps in index.html
if ($indexContent -match 'id="step-1"[\s\S]*?id="step-2"[\s\S]*?id="step-3"[\s\S]*?id="step-4"[\s\S]*?id="step-5"') {
    Write-Host "Passed: index.html has 5 steps: Program -> Class -> Batch -> Student -> PIN" -ForegroundColor Green
} else {
    $errors += "index.html does not have 5-step hierarchy"
}

if ($indexContent -match 'loadBatches' -and $indexContent -match 'fetchBatches\(state\.classId\)') {
    Write-Host "Passed: Step 3 loads batches for selected class" -ForegroundColor Green
} else {
    $errors += "Step 3 does not load batches for selected class"
}

$dashContent = Get-Content -Raw "d:\Tutor Tampan\Top Class Web Builder\Top English Class\dashboard.html"
if ($dashContent -match 'session\.batch_name') {
    Write-Host "Passed: dashboard.html displays session.batch_name in welcome meta and profile" -ForegroundColor Green
} else {
    $errors += "dashboard.html does not display batch_name"
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
if ($errors.Count -eq 0) {
    Write-Host "ALL VERIFICATION CHECKS PASSED PERFECTLY!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAILED WITH $($errors.Count) ERROR(S):" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "  - $err" -ForegroundColor Red
    }
    exit 1
}
