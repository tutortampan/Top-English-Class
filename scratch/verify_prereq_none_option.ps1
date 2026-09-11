# Verify Prerequisite Exam Option "None" in admin.html
Write-Host "=== VERIFYING PREREQUISITE 'NONE' OPTION ==="

$html = Get-Content -Path "admin.html" -Raw

# 1. Check Field Definition
$hasField = $html.Contains("id: 'prerequisite_exam_id'")
Write-Host "1. Prerequisite Field Configured: $(if ($hasField) {'PASS'} else {'FAIL'})"

# 2. Check Initial Select Creation (Not Disabled!)
$hasInitEnabled = $html.Contains("if (f.id === 'prerequisite_exam_id')") -and $html.Contains("sel.disabled = false;")
Write-Host "2. Selector Initialized as Enabled: $(if ($hasInitEnabled) {'PASS'} else {'FAIL'})"

# 3. Check Prereq Select Population Logic with 'None'
$hasPopulation = $html.Contains("prereqSelect.disabled = false;") -and $html.Contains(">None</option>")
Write-Host "3. Dynamic Dropdown Populates 'None' as Selectable Option: $(if ($hasPopulation) {'PASS'} else {'FAIL'})"

# 4. Check Form Payload Extraction for null value
$hasPayload = $html.Contains("else payload[f.id] = el.value || null;")
Write-Host "4. 'None' (Empty Value) Extracts as null in Payload: $(if ($hasPayload) {'PASS'} else {'FAIL'})"

# 5. Check Resilient Save Handler for 'prerequisite_exam_id' in payload
$hasResilientUpdate = $html.Contains("'prerequisite_exam_id' in payloadToSave")
Write-Host "5. Resilient Handler Safely Retries if Column Missing: $(if ($hasResilientUpdate) {'PASS'} else {'FAIL'})"

# 6. Check Student Dashboard respects null Prerequisite
$dashHtml = Get-Content -Path "dashboard.html" -Raw
$hasDashCheck = $dashHtml.Contains("if (exam.prerequisite_exam_id)")
Write-Host "6. Student Dashboard Ignores Prerequisite if None (null): $(if ($hasDashCheck) {'PASS'} else {'FAIL'})"

# 7. Check Exam Hub Table formatting
$hasTableBadge = $html.Contains("const prereqExam = r.prerequisite_exam_id && examMap[r.prerequisite_exam_id];")
Write-Host "7. Table Only Shows Prerequisite Badge if Present: $(if ($hasTableBadge) {'PASS'} else {'FAIL'})"

Write-Host "=== ALL CHECKS COMPLETED ==="
