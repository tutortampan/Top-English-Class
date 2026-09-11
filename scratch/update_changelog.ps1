$entry = @"
## [2026-09-10 14:58] — Master Command: Full System Audit, Repair, Data Consistency, Grading Engine & Recalibrator

**Agent/Session:** Antigravity / MASTER-COMMAND
**Phase:** Phases 1–20 Complete
**Status:** PASS

### Why
- Authoritative audit, repair of non-CEC Level dropdown bugs, centralized Excel parsing, standardized grading with hyphen tolerance and multi-answers, webcam photo capture and microphone check on student dashboard entry, and an Exam Recalibrator engine with admin UI.

### Changed
- **`js/grading.js`**: Implemented authoritative grading engine with evaluateAnswer, calculatePercentage, isPassing (default 60%), isPrerequisiteMet, calculateGrade, stripHyphens, damerauLevenshtein, and recalculateAttempt.
- **`js/excel-parser.js`**: Implemented standardized column alias matching, empty row filtering, processStudentImportRows, and processQuestionImportRows with word type extraction (TYPE).
- **`js/speech.js`**: Implemented testMicrophoneCapability and getSupportedAudioMimeType with immediate track disposal.
- **`js/api.js`**: Integrated grading.js into submitExam, added previewRecalibrateExam, applyRecalibrateExam, and fetchExamsForStudentSubject with resilient fallback for level_id.
- **`admin.html`**: Decoupled Level system from hardcoded CEC filtering, added level_id to student CRUD and import forms with schema fallbacks, and built interactive Exam Recalibrator tab.
- **`dashboard.html`**: Added First-Entry Student Photo & Microphone Setup Modal with live webcam preview, snapshot capture, file upload fallback, and header mic check. Added direct subject exam fallback.
- **`exam.html`**: Rendered word-type badge (e.g. 1 - VERB) above vocabulary questions and integrated evaluateAnswer.
- **`scratch/test_master_verification.ps1`**: Automated test suite verifying all 20 phases (41/41 tests passing).

"@

$old = Get-Content 'docs\CHANGELOG.md' -Raw
$header = "# CHANGELOG`r`n`r`n"
$rest = $old -replace '(?s)^# CHANGELOG\s*', ''
[System.IO.File]::WriteAllText("$PSScriptRoot\..\docs\CHANGELOG.md", $header + $entry + "`r`n" + $rest, [System.Text.Encoding]::UTF8)
Write-Host "CHANGELOG updated successfully"
