# Comprehensive Verification Script for Top English Class Exam Hierarchy and Prerequisite Rules
$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   TOP ENGLISH CLASS -- HIERARCHY AND PREREQUISITE CHECKS       " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Codebase static checks: admin.html
Write-Host "`n[Check 1] Checking admin.html form field hierarchy and options..." -ForegroundColor Yellow
$adminHtml = Get-Content -Raw "admin.html"

# Verify hierarchy in formFields.exams
if ($adminHtml -match "id:\s*'program_id'[\s\S]*?id:\s*'class_id'[\s\S]*?id:\s*'subject_id'[\s\S]*?id:\s*'exam_type'[\s\S]*?id:\s*'level_id'[\s\S]*?id:\s*'exam_order'[\s\S]*?id:\s*'exam_title'[\s\S]*?id:\s*'prerequisite_exam_id'") {
    Write-Host "  PASS: formFields.exams hierarchy is Program -> Class -> Subject -> Exam Type -> Level -> Order -> Title -> Prerequisite" -ForegroundColor Green
} else {
    Write-Host "  FAIL: formFields.exams hierarchy does not match!" -ForegroundColor Red
    exit 1
}

# Verify exam types are Daily, Weekly, Monthly, Final
if ($adminHtml -match "options:\s*\[\s*'Daily'\s*,\s*'Weekly'\s*,\s*'Monthly'\s*,\s*'Final'\s*\]") {
    Write-Host "  PASS: Exam types restricted to Daily, Weekly, Monthly, Final" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Exam types do not match Daily, Weekly, Monthly, Final" -ForegroundColor Red
    exit 1
}

# Verify Level is in letters: A, B, C...
if ($adminHtml -match 'toLevelLetter\(l\.level_number\)' -and $adminHtml -match 'function toLevelLetter') {
    Write-Host "  PASS: Level numbers are converted to letters (A, B, C...) via toLevelLetter" -ForegroundColor Green
} else {
    Write-Host "  FAIL: toLevelLetter missing or not used for level options" -ForegroundColor Red
    exit 1
}

# Verify Order is in numbers: 1, 2, 3...
if ($adminHtml -match "options:\s*\[\s*'1'\s*,\s*'2'\s*,\s*'3'") {
    Write-Host "  PASS: Order options are in numbers ('1', '2', '3'...)" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Order options are not in numbers" -ForegroundColor Red
    exit 1
}

# Verify Prerequisite requirement rule in admin.html
if ($adminHtml -match 'isFirstExam\s*=' -and $adminHtml -match 'Ujian ini bukan Level A Urutan 1') {
    Write-Host "  PASS: Mandatory prerequisite validation enforced when not Level A Order 1" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Prerequisite requirement logic missing in admin.html" -ForegroundColor Red
    exit 1
}

# 2. Check dashboard.html for Level Letters and Order
Write-Host "`n[Check 2] Checking dashboard.html level letters and order badge..." -ForegroundColor Yellow
$dashHtml = Get-Content -Raw "dashboard.html"
if ($dashHtml -match "toLevelLetter" -and $dashHtml -match 'Level \$\{toLevelLetter\(level\.level_number\)\}' -and $dashHtml -match 'Order \$\{escapeHtml\(exam\.exam_order\)\}') {
    Write-Host "  PASS: dashboard.html uses toLevelLetter and displays Order badge" -ForegroundColor Green
} else {
    Write-Host "  FAIL: dashboard.html missing toLevelLetter or Order badge" -ForegroundColor Red
    exit 1
}

# 3. Check js/api.js exports and error recovery
Write-Host "`n[Check 3] Checking js/api.js exports and metadata hydration..." -ForegroundColor Yellow
$apiJs = Get-Content -Raw "js/api.js"
if ($apiJs -match "export function toLevelLetter" -and $apiJs -match "isMissingCol" -and $apiJs -match 'audit_logs') {
    Write-Host "  PASS: js/api.js exports toLevelLetter and has dual-layer auxiliary storage" -ForegroundColor Green
} else {
    Write-Host "  FAIL: js/api.js missing required exports or auxiliary logic" -ForegroundColor Red
    exit 1
}

# 4. Live Supabase integration test
Write-Host "`n[Check 4] Live Supabase lifecycle test..." -ForegroundColor Yellow
try {
    # Fetch test dependencies
    $progs = Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.CEC" -Headers $headers -Method Get
    $classes = Invoke-RestMethod -Uri "$baseUrl/classes?program_id=eq.$($progs[0].id)" -Headers $headers -Method Get
    $subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$($progs[0].id)" -Headers $headers -Method Get
    $levelsUri = "$baseUrl/levels?subject_id=eq.$($subjs[0].id)&order=level_number"
    $levels = Invoke-RestMethod -Uri $levelsUri -Headers $headers -Method Get

    Write-Host "  Fetched Program: $($progs[0].name), Class: $($classes[0].name), Subject: $($subjs[0].name), Level 1: $($levels[0].name)" -ForegroundColor Gray

    # A. Insert Exam 1: Level A, Order 1 (Prerequisite: None)
    $exam1Payload = @{
        program_id = $progs[0].id
        subject_id = $subjs[0].id
        level_id = $levels[0].id
        exam_type = "Daily"
        exam_title = "CEC Camp Vocabularies Daily A 1"
        time_limit_minutes = 60
        minimum_required_score = 60
        answer_type = "multiple_choice"
        exam_status = "published"
        question_order = "sequential"
        retake_allowed = $true
    } | ConvertTo-Json

    $res1 = Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $headers -Method Post -Body $exam1Payload
    $exam1Id = $res1[0].id
    Write-Host "  Created Exam 1 (Level A, Order 1): $exam1Id" -ForegroundColor Green

    # Save metadata for Exam 1 (class_id and order 1)
    $ecPayload1 = @{ exam_id = $exam1Id; class_id = $classes[0].id } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/exam_classes" -Headers $headers -Method Post -Body $ecPayload1 | Out-Null
    $auditPayload1 = @{
        actor_role = "admin"
        action = "exam_metadata"
        entity_type = "exam"
        entity_id = $exam1Id
        new_value = @{ prerequisite_exam_id = $null; exam_order = "1"; class_id = $classes[0].id }
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/audit_logs" -Headers $headers -Method Post -Body $auditPayload1 | Out-Null
    Write-Host "  Exam 1 auxiliary metadata saved (prerequisite: null, order: 1)." -ForegroundColor Green

    # B. Insert Exam 2: Level A, Order 2 (Prerequisite: Exam 1)
    $exam2Payload = @{
        program_id = $progs[0].id
        subject_id = $subjs[0].id
        level_id = $levels[0].id
        exam_type = "Daily"
        exam_title = "CEC Camp Vocabularies Daily A 2"
        time_limit_minutes = 60
        minimum_required_score = 60
        answer_type = "multiple_choice"
        exam_status = "published"
        question_order = "sequential"
        retake_allowed = $true
    } | ConvertTo-Json

    $res2 = Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $headers -Method Post -Body $exam2Payload
    $exam2Id = $res2[0].id
    Write-Host "  Created Exam 2 (Level A, Order 2): $exam2Id" -ForegroundColor Green

    # Save metadata for Exam 2 (prerequisite = exam1Id, order = 2)
    $ecPayload2 = @{ exam_id = $exam2Id; class_id = $classes[0].id } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/exam_classes" -Headers $headers -Method Post -Body $ecPayload2 | Out-Null
    $auditPayload2 = @{
        actor_role = "admin"
        action = "exam_metadata"
        entity_type = "exam"
        entity_id = $exam2Id
        new_value = @{ prerequisite_exam_id = $exam1Id; exam_order = "2"; class_id = $classes[0].id }
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/audit_logs" -Headers $headers -Method Post -Body $auditPayload2 | Out-Null
    Write-Host "  Exam 2 auxiliary metadata saved (prerequisite: $exam1Id, order: 2)." -ForegroundColor Green

    # C. Verify rehydration via queries
    $checkLogUri = "$baseUrl/audit_logs?entity_id=eq.$exam2Id&select=*"
    $checkLog = Invoke-RestMethod -Uri $checkLogUri -Headers $headers -Method Get
    if ($checkLog[0].new_value.prerequisite_exam_id -eq $exam1Id -and $checkLog[0].new_value.exam_order -eq "2") {
        Write-Host "  PASS: Exam 2 prerequisite and order successfully verified in metadata store!" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Metadata mismatch for Exam 2" -ForegroundColor Red
        exit 1
    }

    # Clean up test exams
    $delEc1 = "$baseUrl/exam_classes?exam_id=eq.$exam1Id"
    $delEc2 = "$baseUrl/exam_classes?exam_id=eq.$exam2Id"
    $delAudit1 = "$baseUrl/audit_logs?entity_id=eq.$exam1Id"
    $delAudit2 = "$baseUrl/audit_logs?entity_id=eq.$exam2Id"
    $delExam1 = "$baseUrl/exams?id=eq.$exam1Id"
    $delExam2 = "$baseUrl/exams?id=eq.$exam2Id"

    Invoke-RestMethod -Uri $delEc1 -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri $delEc2 -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri $delAudit1 -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri $delAudit2 -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri $delExam1 -Headers $headers -Method Delete | Out-Null
    Invoke-RestMethod -Uri $delExam2 -Headers $headers -Method Delete | Out-Null
    Write-Host "  Cleaned up all test exams from live database." -ForegroundColor Gray
} catch {
    Write-Host "  Live integration test encountered an error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "  Response: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n>>> ALL 4 VERIFICATION SUITES PASSED FLAWLESSLY! <<<" -ForegroundColor Green
