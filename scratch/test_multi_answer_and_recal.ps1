$root = 'd:\Drives\Tutor Tampan\Top Class Web Builder\Top English Class'
$pass = 0; $fail = 0

function OK   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:pass++ }
function FAIL ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:fail++ }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " VERIFICATION: MULTI-ANSWER & RECALIBRATOR ENHANCEMENTS     " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check grading.js delimiter support
Write-Host "`n[1] GRADING ENGINE DELIMITERS (js/grading.js)" -ForegroundColor Magenta
$grading = Get-Content "$root\js\grading.js" -Raw
if ($grading -match "split\(\/\[;\/\|\]\/\)") {
  OK "parseCorrectAnswers splits on '/', ';', and '|'"
} else {
  FAIL "parseCorrectAnswers missing slash '/' in split regex"
}

# 2. Check excel-parser.js normalization
Write-Host "`n[2] EXCEL PARSER NORMALIZATION (js/excel-parser.js)" -ForegroundColor Magenta
$parser = Get-Content "$root\js\excel-parser.js" -Raw
if ($parser -match "replace\(\/\\s\*\\\/\\s\*\/g,\s*';'\)") {
  OK "processQuestionImportRows normalizes '/' to ';'"
} else {
  FAIL "processQuestionImportRows does not normalize '/' to ';'"
}

# 3. Check api.js recalibrator modes
Write-Host "`n[3] API RECALIBRATOR MODES (js/api.js)" -ForegroundColor Magenta
$api = Get-Content "$root\js\api.js" -Raw
if ($api -match "previewRecalibrateExam\s*\(\s*examId\s*,\s*mode\s*=\s*'snapshot'\s*\)") {
  OK "previewRecalibrateExam accepts mode parameter with default 'snapshot'"
} else {
  FAIL "previewRecalibrateExam missing mode parameter"
}
if ($api -match "applyRecalibrateExam\s*\(\s*examId\s*,\s*mode\s*=\s*'snapshot'\s*,\s*adminIdentifier") {
  OK "applyRecalibrateExam accepts mode parameter with default 'snapshot'"
} else {
  FAIL "applyRecalibrateExam missing mode parameter"
}
if ($api -match "mode === 'override' && curQ") {
  OK "Conditional targetCorrect based on override mode present"
} else {
  FAIL "Conditional targetCorrect based on override mode missing"
}
if ($api -match "if \(mode === 'override'\)\s*\{\s*answerUpdate\.correct_answer_snapshot = q\.newCorrectAnswer;") {
  OK "Snapshot update restricted to override mode only"
} else {
  FAIL "Snapshot update in applyRecalibrateExam not conditioned on override mode"
}

# 4. Check admin.html Import, Export, Recalibrator & CRUD UI
Write-Host "`n[4] ADMIN CONSOLE (admin.html)" -ForegroundColor Magenta
$admin = Get-Content "$root\admin.html" -Raw

if ($admin -match 'name="recal-mode"') {
  OK "Recalibration mode radio buttons (Override vs Snapshot) present in admin.html"
} else {
  FAIL "Recalibration mode radio buttons MISSING in admin.html"
}
if ($admin -match "previewRecalibrateExam\(examId,\s*recalMode\)") {
  OK "Recalibrator preview passes selected recalMode"
} else {
  FAIL "Recalibrator preview does not pass recalMode"
}
if ($admin -match "applyRecalibrateExam\(examId,\s*recalMode\)") {
  OK "Recalibrator apply passes selected recalMode"
} else {
  FAIL "Recalibrator apply does not pass recalMode"
}
if ($admin -match "modal-recal-mode") {
  OK "Confirmation modal displays selected recalibration mode"
} else {
  FAIL "Confirmation modal does not display selected mode"
}
if ($admin -match "replace\(\/\\s\*\\\/\\s\*\/g,\s*';'\)") {
  OK "Inline Excel import parser normalizes '/' to ';'"
} else {
  FAIL "Inline Excel import parser does not normalize '/' to ';'"
}
if ($admin -match "item\.correctAnswer\s*\|\|\s*''\)\.split\(\/\[;\/\|\]\/\)") {
  OK "Import preview table splits on multiple delimiters and renders chips"
} else {
  FAIL "Import preview table does not render multi-answer chips"
}
if ($admin -match "existingQuestionsRaw\.filter\(q\s*=>\s*!q\.deleted_at\)") {
  OK "Import dedup excludes soft-deleted questions"
} else {
  FAIL "Import dedup does not exclude soft-deleted questions"
}
if ($admin -match "textMap\.get\(textKey\)\s*\|\|\s*\(\s*q\.order\s*!=\s*null") {
  OK "Import dedup prioritizes question_text match over order match"
} else {
  FAIL "Import dedup does not prioritize question_text match"
}
if ($admin -match "replace\(\/\[;\|\]\/g,\s*'\/'\)") {
  OK "Export converts ';' and '|' back to '/' in ANSWER column"
} else {
  FAIL "Export does not convert delimiters to '/'"
}
if ($admin -match "Separate multiple acceptable answers with <code>\/<\/code>") {
  OK "Question CRUD form has helper hint for '/' separator"
} else {
  FAIL "Question CRUD form helper hint MISSING"
}

$summaryColor = if ($fail -eq 0) { 'Green' } else { 'Red' }
Write-Host "`n------------------------------------------------------------"
Write-Host "SUMMARY: $pass PASSED, $fail FAILED" -ForegroundColor $summaryColor
Write-Host "------------------------------------------------------------`n"

if ($fail -gt 0) { exit 1 }
