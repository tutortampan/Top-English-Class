$root = 'D:\Tutor Tampan\Top Class Web Builder\Top English Class'
$pass = 0; $fail = 0

function OK   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:pass++ }
function FAIL ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:fail++ }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " MASTER SYSTEM AUDIT & INTEGRATION VERIFICATION (Phase 18) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check grading.js exports and functions
Write-Host "`n[1] GRADING ENGINE (js/grading.js)" -ForegroundColor Magenta
$gradingContent = Get-Content "$root\js\grading.js" -Raw
$gradingExports = @(
  'normalizeWrittenAnswer', 'stripHyphens', 'damerauLevenshtein', 
  'parseCorrectAnswers', 'evaluateAnswer', 'calculatePercentage', 
  'isPassing', 'isPrerequisiteMet', 'calculateGrade', 'recalculateAttempt'
)
foreach ($fn in $gradingExports) {
  if ($gradingContent -match "export\s+(async\s+)?function\s+$fn\b") {
    OK "Function $fn exported"
  } else {
    FAIL "Function $fn MISSING from js/grading.js"
  }
}

# 2. Check excel-parser.js exports
Write-Host "`n[2] EXCEL PARSER (js/excel-parser.js)" -ForegroundColor Magenta
$parserContent = Get-Content "$root\js\excel-parser.js" -Raw
$parserExports = @(
  'normalizeHeaderKey', 'matchCanonicalHeader', 'parseExcelWorkbook', 
  'processStudentImportRows', 'processQuestionImportRows'
)
foreach ($fn in $parserExports) {
  if ($parserContent -match "export\s+(async\s+)?function\s+$fn\b") {
    OK "Function $fn exported"
  } else {
    FAIL "Function $fn MISSING from js/excel-parser.js"
  }
}

# 3. Check speech.js capability detection
Write-Host "`n[3] MICROPHONE & SPEECH (js/speech.js)" -ForegroundColor Magenta
$speechContent = Get-Content "$root\js\speech.js" -Raw
$speechExports = @('testMicrophoneCapability', 'getSupportedAudioMimeType', 'createSpeechSession', 'isSpeechSupported')
foreach ($fn in $speechExports) {
  if ($speechContent -match "export\s+(async\s+)?function\s+$fn\b") {
    OK "Function $fn exported"
  } else {
    FAIL "Function $fn MISSING from js/speech.js"
  }
}
if ($speechContent -match "stream\.getTracks\(\)\.forEach\(track\s*=>\s*\{\s*track\.stop\(\);") {
  OK "Microphone stream clean track disposal confirmed in speech.js"
} else {
  FAIL "Microphone stream clean track disposal MISSING in speech.js"
}

# 4. Check api.js integration
Write-Host "`n[4] API RECALIBRATOR & FETCH METHODS (js/api.js)" -ForegroundColor Magenta
$apiContent = Get-Content "$root\js\api.js" -Raw
$apiExports = @(
  'previewRecalibrateExam', 'applyRecalibrateExam', 
  'fetchExamsForStudentSubject', 'fetchExamsForStudentLevel',
  'uploadStudentPhoto', 'updateStudentGender'
)
foreach ($fn in $apiExports) {
  if ($apiContent -match "export\s+(async\s+)?function\s+$fn\b") {
    OK "Function $fn exported in api.js"
  } else {
    FAIL "Function $fn MISSING in api.js"
  }
}
if ($apiContent -match "import\s*\{[^}]*evaluateAnswer[^}]*\}\s*from\s*'./grading.js'") {
  OK "api.js imports evaluateAnswer from grading.js"
} else {
  FAIL "api.js DOES NOT import evaluateAnswer from grading.js"
}

# 5. Check admin.html Level & Recalibrator UI
Write-Host "`n[5] ADMIN CONSOLE (admin.html)" -ForegroundColor Magenta
$adminContent = Get-Content "$root\admin.html" -Raw
if ($adminContent -match "recalibrator") {
  OK "Recalibrator section registered in navigation"
} else {
  FAIL "Recalibrator section MISSING from admin.html navigation"
}
if ($adminContent -match "renderRecalibrator") {
  OK "renderRecalibrator function present in admin.html"
} else {
  FAIL "renderRecalibrator function MISSING in admin.html"
}
if ($adminContent -match "import-student-level") {
  OK "import-student-level selector present in student import"
} else {
  FAIL "import-student-level selector MISSING in student import"
}
if ($adminContent -match "_dbHasLevelId") {
  OK "Resilient _dbHasLevelId fallback present for student import"
} else {
  FAIL "_dbHasLevelId fallback MISSING in student import"
}

# 6. Check exam.html Word Type display & grading integration
Write-Host "`n[6] EXAM RUNNER (exam.html)" -ForegroundColor Magenta
$examContent = Get-Content "$root\exam.html" -Raw
if ($examContent -match "word-type-badge") {
  OK "Word-type-badge element and logic present in exam.html"
} else {
  FAIL "Word-type-badge element MISSING in exam.html"
}
if ($examContent -match "evaluateAnswer") {
  OK "Grading engine evaluateAnswer used in exam.html"
} else {
  FAIL "evaluateAnswer NOT found in exam.html"
}

# 7. Check dashboard.html Photo & Microphone Onboarding
Write-Host "`n[7] STUDENT DASHBOARD (dashboard.html)" -ForegroundColor Magenta
$dashContent = Get-Content "$root\dashboard.html" -Raw
$dashElements = @('photo-setup-modal', 'webcam-stream', 'btn-snap-photo', 'header-mic-btn', 'btn-confirm-photo-setup')
foreach ($el in $dashElements) {
  if ($dashContent -match "id=""$el""") {
    OK "Element id='$el' present in dashboard.html"
  } else {
    FAIL "Element id='$el' MISSING from dashboard.html"
  }
}
if ($dashContent -match "checkMicrophoneOnEntry") {
  OK "checkMicrophoneOnEntry logic present in dashboard.html"
} else {
  FAIL "checkMicrophoneOnEntry MISSING in dashboard.html"
}
if ($dashContent -match "checkAndPromptPhoto") {
  OK "checkAndPromptPhoto logic present in dashboard.html"
} else {
  FAIL "checkAndPromptPhoto MISSING in dashboard.html"
}
if ($dashContent -match "fetchExamsForStudentSubject") {
  OK "fetchExamsForStudentSubject subject-level fallback integrated in dashboard.html"
} else {
  FAIL "fetchExamsForStudentSubject NOT called in dashboard.html"
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " AUDIT SUMMARY: $pass PASSED, $fail FAILED" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
if ($fail -eq 0) {
  Write-Host " ALL MASTER AUDIT VERIFICATIONS PASSED!" -ForegroundColor Green
} else {
  Write-Host " $fail ERRORS DETECTED - PLEASE INVESTIGATE!" -ForegroundColor Red
}
