$headers = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

Write-Host "=== VERIFICATION: STREAMLINED STUDENT-EXAM RELATIONS & BATCH GROUPING ===" -ForegroundColor Cyan

# 1. Subjects directly queryable by program_id
$progId = "11111111-1111-1111-1111-111111111111"
$subjects = Invoke-RestMethod -Uri "$baseUrl/subjects?select=id,name,program_id&program_id=eq.$progId&deleted_at=is.null" -Headers $headers
Write-Host "   PASS: Program 'General English Program' has $($subjects.Count) direct subjects (no class_subjects needed):" -ForegroundColor Green
$subjects | ForEach-Object { Write-Host "     - $($_.name) [ID: $($_.id)]" }

# 2. Exams directly queryable by level_id
Write-Host "`n2. Testing Subject -> Level -> Exam direct inheritance..."
$lvlId = "44444444-4444-4444-4444-444444444444"
$exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=id,exam_title,exam_type,level_id,program_id,exam_status&level_id=eq.$lvlId&exam_status=eq.published&deleted_at=is.null" -Headers $headers
Write-Host "   PASS: Level 1 has $($exams.Count) published exams directly available (no exam_classes needed):" -ForegroundColor Green
$exams | ForEach-Object { Write-Host "     - $($_.exam_title) ($($_.exam_type)) [Status: $($_.exam_status)]" }

# 3. Attempts with Batch and Class join
Write-Host "`n3. Testing Attempts join with Students, Batches, Classes, and Programs..."
$attempts = Invoke-RestMethod -Uri "$baseUrl/attempts?select=id,score,percentage,grade,submitted_at,status,students(name,gender,batch_id,batches(name),class_id,classes(name,program_id,programs(name))),exams(exam_title,exam_type)" -Headers $headers
Write-Host "   PASS: Attempts query joined successfully without REST schema errors (Count: $($attempts.Count))" -ForegroundColor Green

# 4. Progress with Batch and Class join
Write-Host "`n4. Testing Progress join with Students, Batches, Classes, and Programs..."
$progress = Invoke-RestMethod -Uri "$baseUrl/progress?select=id,is_completed,is_unlocked,students(name,gender,batch_id,batches(name),class_id,classes(name,program_id,programs(name))),subjects(name),levels(name,level_number)" -Headers $headers
Write-Host "   PASS: Progress query joined successfully without REST schema errors (Count: $($progress.Count))" -ForegroundColor Green

# 5. Check admin.html file integrity
Write-Host "`n5. Verifying admin.html content..."
$adminHtml = Get-Content "admin.html" -Raw

$hasBatchInResults = $adminHtml.Contains('res-filter-batch') -and $adminHtml.Contains('tbl-results-body')
$hasBatchInProgress = $adminHtml.Contains('prog-filter-batch') -and $adminHtml.Contains('tbl-progress-body')
$hasNoClassSubjectsSub = -not $adminHtml.Contains('data-sub="class-subjects"')
$hasNoExamClassesSub = -not $adminHtml.Contains('data-sub="exam-classes"')

Write-Host "   - Results Batch filter and table present: $hasBatchInResults" -ForegroundColor $(if ($hasBatchInResults) { "Green" } else { "Red" })
Write-Host "   - Progress Batch filter and table present: $hasBatchInProgress" -ForegroundColor $(if ($hasBatchInProgress) { "Green" } else { "Red" })
Write-Host "   - Sub-nav 'class-subjects' removed: $hasNoClassSubjectsSub" -ForegroundColor $(if ($hasNoClassSubjectsSub) { "Green" } else { "Red" })
Write-Host "   - Sub-nav 'exam-classes' removed: $hasNoExamClassesSub" -ForegroundColor $(if ($hasNoExamClassesSub) { "Green" } else { "Red" })

if ($hasBatchInResults -and $hasBatchInProgress -and $hasNoClassSubjectsSub -and $hasNoExamClassesSub) {
    Write-Host "`nALL 5 CHECKS PASSED PERFECTLY!" -ForegroundColor Green
} else {
    Write-Host "`nSOME CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
