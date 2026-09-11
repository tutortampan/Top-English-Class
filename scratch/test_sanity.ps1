# Check for basic sanity in dashboard.html and admin.html
$dash = Get-Content 'dashboard.html' -Raw
$admin = Get-Content 'admin.html' -Raw

Write-Host "Checking dashboard.html banner & completed exams section..."
if ($dash -match 'id="banner-avatar-container"' -and $dash -match 'id="stat-overall-grade-badge"' -and $dash -match 'id="stat-overall-score"' -and $dash -match 'class="completed-exams-section"' -and $dash -match 'id="completed-exams-container"' -and $dash -match 'id="bottom-stat-total-exams"' -and $dash -match 'renderCompletedExamsBottom') {
    Write-Host "✅ dashboard.html contains all banner elements and completed exams bottom section."
} else {
    Write-Host "❌ dashboard.html is missing some elements."
}

Write-Host "Checking admin.html..."
if ($admin -match 'openStudentProfile' -and $admin -match 'btn-prev-student' -and $admin -match 'btn-next-student' -and $admin -match 'EXAMS COMPLETED' -and $admin -match 'CORRECT ANSWERS') {
    Write-Host "✅ admin.html contains openStudentProfile, navigation, and KPI sections."
} else {
    Write-Host "❌ admin.html is missing elements."
}
