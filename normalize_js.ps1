$apiFile = "js\api.js"
$content = [System.IO.File]::ReadAllText($apiFile)
$content = $content -creplace '\.from\(''Assessments''\)', '.from(''assessments'')'
$content = $content -creplace '\.from\("Assessments"\)', '.from("assessments")'
$content = $content -creplace '\bAssessments\b', 'assessments'
$content = $content -creplace '\bASSESSMENT\b', 'assessment'
$content = $content -creplace 'assessmentObj', 'assessmentObj'
[System.IO.File]::WriteAllText($apiFile, $content, [System.Text.Encoding]::UTF8)
Write-Host "Normalized api.js"

$importFile = "js\admin\imports-exports.js"
$content2 = [System.IO.File]::ReadAllText($importFile)
$content2 = $content2 -creplace 'export-Assessment-select', 'export-assessment-select'
$content2 = $content2 -creplace 'preview-Assessment-type-badge', 'preview-assessment-type-badge'
$content2 = $content2 -creplace '\bAssessment Type:', 'Assessment Type:'
$content2 = $content2 -creplace '\bAssessments\b', 'assessments'
$content2 = $content2 -creplace 'Select Assessment to Export', 'Select Assessment to Export'
[System.IO.File]::WriteAllText($importFile, $content2, [System.Text.Encoding]::UTF8)
Write-Host "Normalized imports-exports.js"
