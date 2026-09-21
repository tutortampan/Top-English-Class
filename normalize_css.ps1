$cssFiles = @("css\dashboard.css", "css\admin.css", "css\style.css")
foreach ($file in $cssFiles) {
    if (-not (Test-Path $file)) { continue }
    $content = [System.IO.File]::ReadAllText($file)

    # CSS Classes replacing
    $content = $content -ireplace '\.exam-', '.assessment-'
    $content = $content -ireplace '\.subject-', '.class-'
    $content = $content -ireplace '\.subjects-', '.classes-'
    
    # Text replacements in comments (just to be clean)
    $content = $content -creplace 'Subject cards', 'Class cards'
    $content = $content -creplace 'Subjects Grid', 'Classes Grid'
    $content = $content -creplace 'EXAM PAGE', 'ASSESSMENT PAGE'
    $content = $content -creplace 'Exam Layout', 'Assessment Layout'
    $content = $content -creplace 'Exam Nav', 'Assessment Nav'
    $content = $content -creplace 'Exam nav', 'Assessment nav'
    $content = $content -creplace 'Completed Exams', 'Completed Assessments'

    [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Normalized $file"
}
