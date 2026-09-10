Write-Host "================================================================"
Write-Host " VERIFICATION: EXAM RESTRICTIONS, AUTO-SUBMIT & ANTI-TRANSLATE"
Write-Host "================================================================"

$examHtml = Get-Content "exam.html" -Raw
$css = Get-Content "css/dashboard.css" -Raw
$apiJs = Get-Content "js/api.js" -Raw

$errors = 0

# 1. Fullscreen removal check
if ($examHtml -match "requestFullscreen" -or $examHtml -match "enterFullscreen") {
    Write-Host "[FAIL] Fullscreen command still exists in exam.html!" -ForegroundColor Red
    $errors++
} else {
    Write-Host "[PASS] Fullscreen switch is completely removed from exam.html" -ForegroundColor Green
}

# 2. Anti-translation check
if ($examHtml -match 'translate="no"' -and $examHtml -match 'class="notranslate"' -and $examHtml -match 'name="google" content="notranslate"') {
    Write-Host "[PASS] Anti-translation attributes and meta tags are present in exam.html" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing anti-translation tags in exam.html!" -ForegroundColor Red
    $errors++
}

# 3. Contextmenu suppression & Translation Observer check
if ($examHtml -match "contextmenu" -and $examHtml -match "translationObserver") {
    Write-Host "[PASS] Context menu blocked on questions & translation observer active" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Context menu or translation observer missing in exam.html!" -ForegroundColor Red
    $errors++
}

# 4. Tab switch, window blur, and Return/Back button restrictions
if ($examHtml -match "visibilitychange" -and $examHtml -match "blur" -and $examHtml -match "popstate") {
    Write-Host "[PASS] Tab switch, window blur (other app), and Back/Return button protections active" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing event listeners for tab switch, blur, or popstate!" -ForegroundColor Red
    $errors++
}

# 5. Forced closing / page close auto-submit check
if ($examHtml -match "submitOnPageExit" -and $examHtml -match "pagehide" -and $examHtml -match "beforeunload" -and $examHtml -match "keepalive: true") {
    Write-Host "[PASS] Forced closing of page/browser triggers background auto-submit with keepalive" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing submitOnPageExit with keepalive in exam.html!" -ForegroundColor Red
    $errors++
}

# 6. Countdown reaches zero auto-submit check
if ($examHtml -match "onExpire" -and $examHtml -match "autoSubmit") {
    Write-Host "[PASS] Countdown reaching zero automatically submits exam" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing autoSubmit on timer expiration!" -ForegroundColor Red
    $errors++
}

# 7. CSS protection check
if ($css -match "user-select: none" -and $css -match "\.notranslate") {
    Write-Host "[PASS] CSS contains non-selectable question text and notranslate rules" -ForegroundColor Green
} else {
    Write-Host "[FAIL] CSS missing user-select or notranslate rules!" -ForegroundColor Red
    $errors++
}

# 8. js/api.js submitExam status support
if ($apiJs -match "targetStatus = options\?\.status" -and $apiJs -match "item\.attempt_answer_id") {
    Write-Host "[PASS] js/api.js submitExam handles array payloads and custom status (auto_submitted)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] js/api.js submitExam not properly updated!" -ForegroundColor Red
    $errors++
}

Write-Host "================================================================"
if ($errors -eq 0) {
    Write-Host "ALL VERIFICATION CHECKS PASSED (0 ERRORS)" -ForegroundColor Green
} else {
    Write-Host "FAILED: $errors error(s) detected." -ForegroundColor Red
}
Write-Host "================================================================"
