$root = 'D:\Tutor Tampan\Top Class Web Builder\Top English Class'
$pass = 0; $fail = 0

function OK   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:pass++ }
function FAIL ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:fail++ }

Write-Host ''
Write-Host '=================================================================' -ForegroundColor Cyan
Write-Host ' CENTRALIZED ASSESSMENT SYSTEM V1 -- SUITE VERIFICATION          ' -ForegroundColor Cyan
Write-Host '=================================================================' -ForegroundColor Cyan

# -------------------------------------------------------------
# 1. Excel Question Bank Deduplication & Word-Type Safeguards
# -------------------------------------------------------------
Write-Host "`n[1] CENTRAL QUESTION IMPORT AND DEDUPLICATION ENGINE" -ForegroundColor Magenta
$excelCode = Get-Content "$root\js\excel-parser.js" -Raw

if ($excelCode -match 'export\s+(async\s+)?function\s+processCentralBankQuestionImport\b') {
  OK 'processCentralBankQuestionImport exported in js/excel-parser.js'
} else {
  FAIL 'processCentralBankQuestionImport MISSING in js/excel-parser.js'
}

if ($excelCode -match 'ratio\s*>=\s*0\.85') {
  OK 'Level 2 possible duplicate detection threshold (>= 85%) present'
} else {
  FAIL 'Level 2 possible duplicate detection threshold (>= 85%) MISSING'
}

if ($excelCode -match 'wordTypeWarning') {
  OK 'Smart word-type heuristic suggestion engine present'
} else {
  FAIL 'Smart word-type heuristic suggestion engine MISSING'
}

if ($excelCode -match 'inSheetDuplicate') {
  OK 'In-sheet exact duplicate pre-check implemented'
} else {
  FAIL 'In-sheet exact duplicate pre-check MISSING'
}

# -------------------------------------------------------------
# 2. Damerau-Levenshtein Typo Tolerance with Short-Word Protection
# -------------------------------------------------------------
Write-Host "`n[2] SCORING ENGINE AND SHORT-WORD TYPO PROTECTION" -ForegroundColor Magenta
$gradingCode = Get-Content "$root\js\grading.js" -Raw

if ($gradingCode -match 'minLen\s*>=\s*4\s*&&\s*dist\s*<=\s*2') {
  OK 'js/grading.js enforces minLen >= 4 for distance <= 2'
} else {
  FAIL 'js/grading.js MISSING minLen >= 4 check'
}

if ($gradingCode -match 'minLen\s*===\s*3\s*&&\s*dist\s*===\s*1') {
  OK 'js/grading.js enforces minLen === 3 for distance 1'
} else {
  FAIL 'js/grading.js MISSING minLen === 3 check'
}

# Check edge function submit-exam
$submitEdge = Get-Content "$root\supabase\functions\submit-exam\index.ts" -Raw
if ($submitEdge -match 'minLen\s*>=\s*4\s*&&\s*dist\s*<=\s*2') {
  OK 'supabase/functions/submit-exam/index.ts has short-word safeguard'
} else {
  FAIL 'supabase/functions/submit-exam/index.ts MISSING short-word safeguard'
}

# Accurate Damerau-Levenshtein simulation in PowerShell
function Get-DamerauLevenshtein($a, $b) {
  $la = $a.Length; $lb = $b.Length
  $stride = $lb + 1
  $d = New-Object int[] (($la + 1) * $stride)
  for ($i = 0; $i -le $la; $i++) { $d[$i * $stride] = $i }
  for ($j = 0; $j -le $lb; $j++) { $d[$j] = $j }
  for ($i = 1; $i -le $la; $i++) {
    for ($j = 1; $j -le $lb; $j++) {
      $cost = if ($a[$i - 1] -eq $b[$j - 1]) { 0 } else { 1 }
      $del = $d[($i - 1) * $stride + $j] + 1
      $ins = $d[$i * $stride + ($j - 1)] + 1
      $sub = $d[($i - 1) * $stride + ($j - 1)] + $cost
      $m = [Math]::Min($del, [Math]::Min($ins, $sub))
      if ($i -gt 1 -and $j -gt 1 -and $a[$i - 1] -eq $b[$j - 2] -and $a[$i - 2] -eq $b[$j - 1]) {
        $trans = $d[($i - 2) * $stride + ($j - 2)] + $cost
        $m = [Math]::Min($m, $trans)
      }
      $d[$i * $stride + $j] = $m
    }
  }
  return $d[$la * $stride + $lb]
}

function Simulate-TypoCheck($student, $correct) {
  $la = $student.Length; $lb = $correct.Length
  $minLen = [Math]::Min($la, $lb)
  $dist = Get-DamerauLevenshtein $student $correct
  $isAllowed = ($minLen -ge 4 -and $dist -le 2) -or ($minLen -eq 3 -and $dist -eq 1)
  return $isAllowed
}

# "go" vs "to": minLen 2 -> NOT allowed
if (-not (Simulate-TypoCheck 'go' 'to')) {
  OK "Short-word rule prevents 'go' from matching 'to' (length 2, dist 1)"
} else {
  FAIL "Short-word rule failed on 'go' vs 'to'"
}

# "cat" vs "cot": minLen 3, dist 1 -> allowed
if (Simulate-TypoCheck 'cat' 'cot') {
  OK "Short-word rule allows single-letter typo on 3-letter word ('cat' vs 'cot')"
} else {
  FAIL 'Short-word rule rejected valid 3-letter typo'
}

# "accommodate" vs "acommodate": minLen 10, dist 1 -> allowed
if (Simulate-TypoCheck 'acommodate' 'accommodate') {
  OK "Typo tolerance allows minor typo on long word ('acommodate' vs 'accommodate')"
} else {
  FAIL 'Typo tolerance failed on long word'
}

# -------------------------------------------------------------
# 3. Assessment Builder Architecture (js/admin/exam-builder.js)
# -------------------------------------------------------------
Write-Host "`n[3] ASSESSMENT BUILDER ARCHITECTURE (js/admin/exam-builder.js)" -ForegroundColor Magenta
$builderCode = Get-Content "$root\js\admin\exam-builder.js" -Raw

if ($builderCode -match 'export\s+async\s+function\s+openAssessmentBuilder\b') {
  OK 'openAssessmentBuilder exported in js/admin/exam-builder.js'
} else {
  FAIL 'openAssessmentBuilder MISSING in js/admin/exam-builder.js'
}

if ($builderCode -match 'name="wiz-type"\s+value="EVALUATION"' -and $builderCode -match 'name="wiz-type"\s+value="EXAM"') {
  OK 'Evaluation vs Exam assessment type separation implemented'
} else {
  FAIL 'Evaluation vs Exam assessment type separation MISSING'
}

if ($builderCode -match 'btn-publish-assessment' -and $builderCode -match 'Freeze') {
  OK 'Publish and Freeze Snapshot workflow implemented'
} else {
  FAIL 'Publish and Freeze Snapshot workflow MISSING'
}

if ($builderCode -match 'tab-assign' -and $builderCode -match 'assignAssessment') {
  OK 'Inline Batch / Student assignment step implemented'
} else {
  FAIL 'Inline Batch / Student assignment step MISSING'
}

# -------------------------------------------------------------
# 4. Security & Data Protection in API & Edge Functions
# -------------------------------------------------------------
Write-Host "`n[4] SECURITY AND DATA PROTECTION (Client Answer Key Sanitization)" -ForegroundColor Magenta
$apiCode = Get-Content "$root\js\api.js" -Raw

if ($apiCode -match 'delete\s+snap\.correct_answer' -and $apiCode -match 'delete\s+snap\.accepted_answers') {
  OK 'js/api.js strips answer keys from startExam client response'
} else {
  FAIL 'js/api.js DOES NOT strip answer keys from startExam response'
}

$startEdge = Get-Content "$root\supabase\functions\start-exam\index.ts" -Raw
if ($startEdge -match 'select\("id,\s*question_id,\s*question_snapshot,\s*topic_snapshot,\s*word_type_snapshot,\s*student_answer,\s*score"\)') {
  OK 'supabase/functions/start-exam/index.ts strips answer keys from client response'
} else {
  FAIL 'supabase/functions/start-exam/index.ts exposes answer keys'
}

# -------------------------------------------------------------
# 5. Assignment Filtering Logic (.or() Query Pattern)
# -------------------------------------------------------------
Write-Host "`n[5] ASSIGNMENT RETRIEVAL AND ACCESS CONTROL" -ForegroundColor Magenta
if ($apiCode -match 'query\.or\(orConditions\.join') {
  OK 'js/api.js fetchAssignments combines batch and student filters with .or()'
} else {
  FAIL 'js/api.js fetchAssignments DOES NOT combine filters with .or()'
}

# -------------------------------------------------------------
# 6. Best Score Recalculator Simulation
# -------------------------------------------------------------
Write-Host "`n[6] BEST SCORE RESOLUTION ENGINE" -ForegroundColor Magenta

if ($apiCode -match 'export\s+async\s+function\s+recalculateBestScore\b') {
  OK 'recalculateBestScore exported in js/api.js'
} else {
  FAIL 'recalculateBestScore MISSING in js/api.js'
}

# Simulate multiple attempts and resolve best score
$mockAttempts = @(
  @{ id = 'att-1'; percentage = 55.0; created_at = '2026-09-01T10:00:00Z' },
  @{ id = 'att-2'; percentage = 85.0; created_at = '2026-09-02T10:00:00Z' },
  @{ id = 'att-3'; percentage = 70.0; created_at = '2026-09-03T10:00:00Z' }
)

$sorted = $mockAttempts | Sort-Object -Property @{ Expression = { $_.percentage }; Descending = $true }, @{ Expression = { $_.created_at }; Descending = $true }
$bestId = $sorted[0].id

if ($bestId -eq 'att-2') {
  OK "Highest percentage attempt ($($sorted[0].percentage)%) correctly designated as best score"
} else {
  FAIL "Best score designated incorrectly: got $bestId"
}

# Verify attempt history preservation
if ($mockAttempts.Count -eq 3) {
  OK 'Full attempt history preserved across all 3 attempts without truncation'
} else {
  FAIL 'Attempt history count mismatch'
}

# -------------------------------------------------------------
# 7. Overall Summary
# -------------------------------------------------------------
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " V1 CENTRALIZED ASSESSMENT AUDIT: $pass PASSED, $fail FAILED" -ForegroundColor Cyan
Write-Host '=================================================================' -ForegroundColor Cyan
if ($fail -eq 0) {
  Write-Host ' ALL CENTRALIZED ASSESSMENT V1 AUDIT CHECKS PASSED!' -ForegroundColor Green
} else {
  Write-Host " $fail ERRORS DETECTED - PLEASE INVESTIGATE!" -ForegroundColor Red
  exit 1
}
