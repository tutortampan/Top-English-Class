# TOP ENGLISH CLASS -- ABCD PRIMARY ARCHITECTURE SUITE VERIFICATION
# Validates A (ACADEMY), B (BLUEPRINT), C (CHALLENGES), D (DESK)
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " ABCD PRIMARY ARCHITECTURE SUITE VERIFICATION                   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Check($name, $condition, $details = "") {
    if ($condition) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $global:passed++
    } else {
        Write-Host "  [FAIL] $name $details" -ForegroundColor Red
        $global:failed++
    }
}

# -------------------------------------------------------------
# 1. NAVIGATION SHELL (admin.html)
# -------------------------------------------------------------
Write-Host "`n[1] NAVIGATION SHELL (admin.html)" -ForegroundColor Yellow
$adminHtml = Get-Content "admin.html" -Raw

Assert-Check "Sidebar group A -- ACADEMY present" ($adminHtml -match 'ACADEMY')
Assert-Check "Sidebar group B -- BLUEPRINT present" ($adminHtml -match 'BLUEPRINT')
Assert-Check "Sidebar group C -- CHALLENGES present" ($adminHtml -match 'CHALLENGES')
Assert-Check "Sidebar group D -- DESK present" ($adminHtml -match 'DESK')

Assert-Check "Mobile tab data-panel='academy' present" ($adminHtml -match 'data-panel="academy"')
Assert-Check "Mobile tab data-panel='blueprint' present" ($adminHtml -match 'data-panel="blueprint"')
Assert-Check "Mobile tab data-panel='challenges' present" ($adminHtml -match 'data-panel="challenges"')
Assert-Check "Mobile tab data-panel='desk' present" ($adminHtml -match 'data-panel="desk"')

Assert-Check "ABCD KPI counter: kpi-academy present" ($adminHtml -match 'id="kpi-academy"')
Assert-Check "ABCD KPI counter: kpi-qbank present" ($adminHtml -match 'id="kpi-qbank"')
Assert-Check "ABCD KPI counter: kpi-assessments present" ($adminHtml -match 'id="kpi-assessments"')
Assert-Check "ABCD KPI counter: kpi-attempts present" ($adminHtml -match 'id="kpi-attempts"')

# -------------------------------------------------------------
# 2. ROUTER & ALIASING (js/admin/app.js)
# -------------------------------------------------------------
Write-Host "`n[2] ROUTER AND ALIASING (js/admin/app.js)" -ForegroundColor Yellow
$appJs = Get-Content "js/admin/app.js" -Raw

Assert-Check "aliasSectionMap defined in app.js" ($appJs -match 'const aliasSectionMap\s*=')
Assert-Check "aliasSectionMap maps academy-students to students" ($appJs -match "'academy-students':\s*'students'")
Assert-Check "aliasSectionMap maps blueprint-bank to questions" ($appJs -match "'blueprint-bank':\s*'questions'")
Assert-Check "aliasSectionMap maps challenges-hub to exams" ($appJs -match "'challenges-hub':\s*'exams'")
Assert-Check "aliasSectionMap maps desk-settings to settings" ($appJs -match "'desk-settings':\s*'settings'")

Assert-Check "sectionDomainMap maps sections to ABCD 4 domains" (
    $appJs -match "institutions:\s*'ACADEMY'" -and
    $appJs -match "subjects:\s*'BLUEPRINT'" -and
    $appJs -match "exams:\s*'CHALLENGES'" -and
    $appJs -match "audit:\s*'DESK'"
)

Assert-Check "loadSection applies aliasSectionMap lookup" ($appJs -match 'section\s*=\s*aliasSectionMap\[section\]\s*\|\|\s*section;')
Assert-Check "loadSection updates topbar breadcrumb domain" ($appJs -match 'domainEl\.textContent\s*=\s*domain;')
Assert-Check "showConsole triggers updateAdminKpiBanner" ($appJs -match 'updateAdminKpiBanner\(\);')
Assert-Check "showConsole defaults to challenges panel" ($appJs -match "activatePrimaryTab\('challenges'\);")

# -------------------------------------------------------------
# 3. ACADEMY HIERARCHICAL DRILL-DOWNS
# -------------------------------------------------------------
Write-Host "`n[3] ACADEMY HIERARCHICAL DRILL-DOWNS" -ForegroundColor Yellow
$progMgmtJs = Get-Content "js/admin/program-management.js" -Raw
$stdMgmtJs = Get-Content "js/admin/student-management.js" -Raw

Assert-Check "Institutions has Programs drill-down button" ($appJs -match 'data-nav-progs')
Assert-Check "Programs has filter by institution support" ($progMgmtJs -match 'window\._filterInstitutionId')
Assert-Check "Programs has Batches drill-down button" ($progMgmtJs -match 'window\._filterProgramId')
Assert-Check "Batches has filter by program support" ($progMgmtJs -match 'window\._filterProgramId')
Assert-Check "Batches active students column has drill-down" ($progMgmtJs -match 'window\._filterBatchId')
Assert-Check "Students roster has filter by batch banner and data filter" ($stdMgmtJs -match 'window\._filterBatchId')

# -------------------------------------------------------------
# 4. BLUEPRINT HIERARCHICAL DRILL-DOWNS
# -------------------------------------------------------------
Write-Host "`n[4] BLUEPRINT HIERARCHICAL DRILL-DOWNS" -ForegroundColor Yellow
$centralJs = Get-Content "js/admin/central-assessment.js" -Raw

Assert-Check "Subjects has Topics drill-down button" ($appJs -match 'data-nav-topics')
Assert-Check "Topics has filter by subject banner and pre-select" ($centralJs -match 'window\._filterSubjectId')
Assert-Check "Topics has Questions drill-down button" ($centralJs -match 'btn-nav-questions')
Assert-Check "Central Question Bank has filter by topic banner and pre-select" ($centralJs -match 'window\._filterTopicId')

# -------------------------------------------------------------
# 5. CHALLENGES EXECUTION & CONTEXTUAL ACTIONS
# -------------------------------------------------------------
Write-Host "`n[5] CHALLENGES EXECUTION AND CONTEXTUAL ACTIONS" -ForegroundColor Yellow

Assert-Check "Challenges Hub title updated" ($appJs -match 'Challenges Hub')
Assert-Check "Challenges Hub header has quick shortcuts" (
    $appJs -match 'hub-btn-assignments' -and
    $appJs -match 'hub-btn-results' -and
    $appJs -match 'hub-btn-recalibrate'
)
Assert-Check "Challenge row has Results contextual button" ($appJs -match 'window\._filterExamResults=')
Assert-Check "Challenge row has Recalibrate contextual button" ($appJs -match 'window\._filterRecalibrateExam=')
Assert-Check "Results view filters by challenge when navigated" ($appJs -match 'if\s*\(window\._filterExamResults\)')
Assert-Check "Recalibrator pre-selects challenge when navigated" ($appJs -match 'if\s*\(window\._filterRecalibrateExam\)')

# -------------------------------------------------------------
# 6. DESK ADMINISTRATION & DIAGNOSTICS
# -------------------------------------------------------------
Write-Host "`n[6] DESK ADMINISTRATION AND DIAGNOSTICS" -ForegroundColor Yellow

Assert-Check "Settings section has DESK header" ($appJs -match 'D — DESK')
Assert-Check "Settings section includes Custom Admin Password override" ($appJs -match 'tec_admin_custom_password')
Assert-Check "Settings section includes DB Connectivity and Latency tool" ($appJs -match 'diag-db-status')
Assert-Check "Settings section includes Local Browser Cache cleaner" ($appJs -match 'btn-diag-clear-cache')
Assert-Check "Settings section includes Activity and Audit Log navigation" ($appJs -match 'btn-diag-view-audit')

# -------------------------------------------------------------
# 7. LIVE DATABASE INTEGRITY (Zero Data Loss)
# -------------------------------------------------------------
Write-Host "`n[7] LIVE DATABASE INTEGRITY (Zero Data Loss)" -ForegroundColor Yellow
$sbUrl = "https://xuiszvwfjccvucqpactf.supabase.co"
$sbKey = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"

$headers = @{
    "apikey" = $sbKey
    "Authorization" = "Bearer $sbKey"
}

try {
    $qResp = Invoke-WebRequest -Uri "$sbUrl/rest/v1/questions?select=id&limit=1" -Headers ($headers + @{"Prefer"="count=exact"}) -Method Get -UseBasicParsing
    $rangeQ = $qResp.Headers['content-range']
    if ($rangeQ -is [array]) { $rangeQ = $rangeQ[0] }
    $qCount = [int]($rangeQ.Split('/')[1])
    Assert-Check "Central Question Bank data intact ($qCount questions in live DB)" ($qCount -ge 1000)

    $attResp = Invoke-WebRequest -Uri "$sbUrl/rest/v1/attempts?select=id&limit=1" -Headers ($headers + @{"Prefer"="count=exact"}) -Method Get -UseBasicParsing
    $rangeAtt = $attResp.Headers['content-range']
    if ($rangeAtt -is [array]) { $rangeAtt = $rangeAtt[0] }
    $attCount = [int]($rangeAtt.Split('/')[1])
    Assert-Check "Attempts history intact ($attCount attempts in live DB)" ($attCount -ge 360)

    $stdResp = Invoke-WebRequest -Uri "$sbUrl/rest/v1/students?select=id&limit=1" -Headers ($headers + @{"Prefer"="count=exact"}) -Method Get -UseBasicParsing
    $rangeStd = $stdResp.Headers['content-range']
    if ($rangeStd -is [array]) { $rangeStd = $rangeStd[0] }
    $stdCount = [int]($rangeStd.Split('/')[1])
    Assert-Check "Student roster intact ($stdCount students in live DB)" ($stdCount -ge 130)
} catch {
    Assert-Check "Database live connection query succeeded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# SUMMARY
# -------------------------------------------------------------
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " AUDIT SUMMARY: $passed PASSED, $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
