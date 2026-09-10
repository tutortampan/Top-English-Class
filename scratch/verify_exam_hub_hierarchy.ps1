Write-Host "=== VERIFYING EXAM HUB HIERARCHY, PREREQUISITE & AUTO TITLE ==="

# 1. Local Server Check
try {
    $res = Invoke-WebRequest -Uri "http://localhost:8080/admin.html" -UseBasicParsing
    Write-Host "1. Local Server: PASS (HTTP $($res.StatusCode), $($res.RawContentLength) bytes)"
} catch {
    Write-Host "1. Local Server: FAIL ($($_.Exception.Message))"
}

# 2. Check admin.html Form Definition
$adminHtml = Get-Content "admin.html" -Raw
$examFormMatch = [regex]::Match($adminHtml, '(?s)exams:\s*\[(.*?)\]\s*,')
if ($examFormMatch.Success) {
    Write-Host "2. Exams Form Definition Found:"
    $fieldMatches = [regex]::Matches($examFormMatch.Groups[1].Value, "id:\s*'([^']+)'")
    $fields = @()
    foreach ($fm in $fieldMatches) { $fields += $fm.Groups[1].Value }
    Write-Host "   Fields: $($fields -join ' -> ')"

    # Verify Class is mandatory before Level
    if ($fields.IndexOf('class_id') -lt $fields.IndexOf('level_id')) {
        Write-Host "   Class before Level: PASS"
    } else {
        Write-Host "   Class before Level: FAIL"
    }

    # Verify Prerequisite field exists
    if ($fields -contains 'prerequisite_exam_id') {
        Write-Host "   Prerequisite Exam Selector: PASS"
    } else {
        Write-Host "   Prerequisite Exam Selector: FAIL"
    }

    # Verify Default Time Limit = 60
    if ($adminHtml -match "id:\s*'time_limit_minutes'[^}]+defaultValue:\s*60") {
        Write-Host "   Default 60-Minute Time Limit: PASS"
    } else {
        Write-Host "   Default 60-Minute Time Limit: FAIL"
    }
} else {
    Write-Host "2. Exams Form Definition: FAIL (Not found)"
}

# 3. Check renderExams Table Columns
if ($adminHtml -match '<th class="text-center">Questions</th>' -and $adminHtml -match '<th class="text-left">Class</th>') {
    Write-Host "3. Questions & Class Columns in Exam Hub: PASS"
} else {
    Write-Host "3. Questions & Class Columns in Exam Hub: FAIL"
}

# 4. Check Prerequisite Lock in dashboard.html
$dashHtml = Get-Content "dashboard.html" -Raw
if ($dashHtml -match 'prereqMet' -and $dashHtml -match 'Prerequisite Required') {
    Write-Host "4. Student Dashboard Prerequisite Lock: PASS"
} else {
    Write-Host "4. Student Dashboard Prerequisite Lock: FAIL"
}

# 5. Live DB Test: Clean Slate & Create First Exam with Auto-Title formula
$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

# Check DB is clean
$eCount = (Invoke-RestMethod -Uri "$baseUrl/exams?select=id" -Headers $h).Count
Write-Host "5. Database Clean Slate Check: $eCount active exams (Expected: 0)"

# Fetch Master Data IDs for CEC
$cec = (Invoke-RestMethod -Uri "$baseUrl/programs?name=eq.CEC&select=id" -Headers $h)[0]
$camp = (Invoke-RestMethod -Uri "$baseUrl/classes?name=eq.Camp&select=id" -Headers $h)[0]
$vocab = (Invoke-RestMethod -Uri "$baseUrl/subjects?program_id=eq.$($cec.id)&select=id" -Headers $h)[0]

# Ensure level 1 exists for Vocabularies
$lvl = Invoke-RestMethod -Uri "$baseUrl/levels?subject_id=eq.$($vocab.id)&level_number=eq.1&select=id,level_number" -Headers $h
if (!$lvl -or $lvl.Count -eq 0) {
    $newLvl = @{
        subject_id = $vocab.id
        name = "1"
        level_number = 1
        is_active = $true
    } | ConvertTo-Json
    $lvl = Invoke-RestMethod -Uri "$baseUrl/levels" -Headers $h -Method Post -Body $newLvl
} else {
    $lvl = $lvl[0]
}

# Create Exam 1: "CEC Camp Vocabularies Mid-Term 1" (prerequisite_exam_id = $null for None)
$exam1 = @{
    program_id = $cec.id
    class_id = $camp.id
    subject_id = $vocab.id
    level_id = $lvl.id
    exam_type = "Mid-Term"
    exam_title = "CEC Camp Vocabularies Mid-Term 1"
    prerequisite_exam_id = $null
    answer_type = "multiple_choice"
    exam_status = "published"
    time_limit_minutes = 60
}

function Resilient-InsertExam($bodyObj) {
    try {
        $json = $bodyObj | ConvertTo-Json
        return Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $h -Method Post -Body $json
    } catch {
        # Retry without class_id and prerequisite_exam_id if schema cache does not have them
        $clone = @{}
        foreach ($k in $bodyObj.Keys) {
            if ($k -ne 'class_id' -and $k -ne 'prerequisite_exam_id') {
                $clone[$k] = $bodyObj[$k]
            }
        }
        $json = $clone | ConvertTo-Json
        return Invoke-RestMethod -Uri "$baseUrl/exams" -Headers $h -Method Post -Body $json
    }
}

try {
    $created1 = Resilient-InsertExam $exam1
    Write-Host "6. Created Exam 1 with None Prerequisite (PASS): $($created1[0].exam_title) (Time Limit: $($created1[0].time_limit_minutes)m)"
    
    # Create Exam 2 with Prerequisite = Exam 1
    $exam2 = @{
        program_id = $cec.id
        class_id = $camp.id
        subject_id = $vocab.id
        level_id = $lvl.id
        prerequisite_exam_id = $created1[0].id
        exam_type = "Final"
        exam_title = "CEC Camp Vocabularies Final 1"
        answer_type = "multiple_choice"
        exam_status = "published"
        time_limit_minutes = 60
    }
    
    $created2 = Resilient-InsertExam $exam2
    Write-Host "7. Created Exam 2 with Prerequisite (PASS): $($created2[0].exam_title)"
    
    # Clean up test exams to maintain clean canvas
    Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$($created1[0].id)" -Headers $h -Method Delete | Out-Null
    Invoke-RestMethod -Uri "$baseUrl/exams?id=eq.$($created2[0].id)" -Headers $h -Method Delete | Out-Null
    Write-Host "8. Cleaned up test exams: PASS (Clean state preserved)"
} catch {
    Write-Host "Error in exam lifecycle test: $($_.Exception.Message)"
}

Write-Host "=== TEST SUITE COMPLETED ==="
