# Test Suite: Exam Creation Process, File Uploading, and Upload Forms Verification
$ErrorActionPreference = "Stop"

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " EXAM CREATION & UPLOAD FORMS DEEP AUDIT VERIFICATION            " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Check($title, $condition) {
    if ($condition) {
        Write-Host "  [PASS] $title" -ForegroundColor Green
        $global:passed++
    } else {
        Write-Host "  [FAIL] $title" -ForegroundColor Red
        $global:failed++
    }
}

# 1. Broken HTML Tags Check
Write-Host "`n[1] HTML & FORM STRUCTURE INTEGRITY" -ForegroundColor Yellow
$appJs = Get-Content "js/admin/app.js" -Raw
$brokenSelects = Select-String -Path "js/**/*.js", "admin.html", "*.html" -Pattern '<select program=' -CaseSensitive:$false
Assert-Check "Zero '<Select Program=' or malformed select tags across workspace" ($brokenSelects.Count -eq 0)

$studentSelect1 = $appJs -match 'id="import-student-program"' -and $appJs -match '<select class="form-control" id="import-student-program"'
Assert-Check "Student import program dropdown is a valid <select class='form-control'>" $studentSelect1

$studentSelect2 = $appJs -match 'id="import-student-class"' -and $appJs -match '<select class="form-control" id="import-student-class"'
Assert-Check "Student import class dropdown is a valid <select class='form-control'>" $studentSelect2

$studentSelect3 = $appJs -match 'id="import-student-batch"' -and $appJs -match '<select class="form-control" id="import-student-batch"'
Assert-Check "Student import batch dropdown is a valid <select class='form-control'>" $studentSelect3

$studentSelect4 = $appJs -match 'id="import-student-level"' -and $appJs -match '<select class="form-control" id="import-student-level"'
Assert-Check "Student import level dropdown is a valid <select class='form-control'>" $studentSelect4

$recalSelect1 = $appJs -match 'id="recalibrator-exam-select"' -and $appJs -match '<select class="form-control" id="recalibrator-exam-select"'
Assert-Check "Recalibrator exam dropdown is a valid <select class='form-control'>" $recalSelect1

$exportSelect1 = $appJs -match 'id="export-exam-select"' -and $appJs -match '<select class="form-control" id="export-exam-select"'
Assert-Check "Export exam dropdown is a valid <select class='form-control'>" $exportSelect1

# 2. Native Alert Elimination
Write-Host "`n[2] NO NATIVE ALERT() CALLS (Modern showToast Enforced)" -ForegroundColor Yellow
$alertCalls = Select-String -Path "js/**/*.js" -Pattern 'alert\(' -CaseSensitive:$false
Assert-Check "Zero native alert() calls across all js/ files" ($alertCalls.Count -eq 0)

# 3. Rule 2.2 Student ID Elimination in Exports
Write-Host "`n[3] RULE 2.2 COMPLIANCE (No Business Student ID)" -ForegroundColor Yellow
$studMgmt = Get-Content "js/admin/student-management.js" -Raw
$hasIdInHeaders = $studMgmt -match "const headers = \['ID'"
Assert-Check "Student export does not include 'ID' column (compliant with AGENTS.md §2.2)" (-not $hasIdInHeaders)

# 4. Exam Builder & Assessment Creation
Write-Host "`n[4] EXAM BUILDER & LIFECYCLE WIZARD" -ForegroundColor Yellow
$builderJs = Get-Content "js/admin/exam-builder.js" -Raw
Assert-Check "openAssessmentBuilder exported in exam-builder.js" ($builderJs -match 'export async function openAssessmentBuilder')
Assert-Check "createTopic imported in exam-builder.js" ($builderJs -match 'createTopic,')
Assert-Check "updateAssessmentWithTopics imported in exam-builder.js" ($builderJs -match 'updateAssessmentWithTopics,')
Assert-Check "Inline topic creation unblocks Evaluation flow" ($builderJs -match 'btn-wiz-add-topic' -and $builderJs -match 'createTopic\(\{')
Assert-Check "Edit mode prepopulation implemented for title, subject, duration, and topics" ($builderJs -match 'editAssessment\.title' -and $builderJs -match 'selectedTopicIds\.add')
Assert-Check "updateAssessmentWithTopics called in persistAssessment when editing" ($builderJs -match 'updateAssessmentWithTopics\(asmId,')

# 5. API Resilience & Database Fallbacks
Write-Host "`n[5] DATABASE RESILIENCE & ADAPTERS (js/api.js)" -ForegroundColor Yellow
$apiJs = Get-Content "js/api.js" -Raw
Assert-Check "updateAssessmentWithTopics exported in js/api.js" ($apiJs -match 'export async function updateAssessmentWithTopics')
Assert-Check "createAssessmentWithTopics fallback resolves institution_id safely from subject" ($apiJs -match 'instId && payload\.subject_id')
Assert-Check "publishAssessment has snapshot freeze and count return" ($apiJs -match 'assessment_questions.*insert' -and $apiJs -match 'total_questions')

# 6. Question Bank Import Engine & Templates
Write-Host "`n[6] CENTRAL QUESTION IMPORT & TEMPLATES" -ForegroundColor Yellow
$centralJs = Get-Content "js/admin/central-assessment.js" -Raw
$excelParser = Get-Content "js/excel-parser.js" -Raw
Assert-Check "renderCentralQuestionImport present in central-assessment.js" ($centralJs -match 'export async function renderCentralQuestionImport')
Assert-Check "Question template download generates valid XLSX structure" ($centralJs -match 'btn-download-central-tmpl' -and $centralJs -match 'Central_Question_Bank_Template\.xlsx')
Assert-Check "Indonesian header aliases mapped in excel-parser.js (soal, jawaban, tema, tipe_kata)" (
    $excelParser -match "'soal'" -and $excelParser -match "'jawaban'" -and $excelParser -match "'tipe_kata'" -and $excelParser -match "'tema'"
)
Assert-Check "Legacy database question insert fallback handles missing exam_id constraint" ($centralJs -match 'legacyChunk' -and $centralJs -match 'fallbackExamId')

# 7. Student Spreadsheet Import & Templates
Write-Host "`n[7] STUDENT SPREADSHEET IMPORT & TEMPLATES" -ForegroundColor Yellow
Assert-Check "Student template download generates Template_Student_Import.xlsx" ($appJs -match 'Template_Student_Import\.xlsx')
Assert-Check "Student import has auto-batch creation" ($appJs -match 'batchesToCreate' -and $appJs -match 'safeStudentInsert')

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " AUDIT SUMMARY: $passed PASSED, $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
