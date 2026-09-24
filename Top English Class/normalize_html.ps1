$htmlFiles = @("assessment.html", "dashboard.html")
foreach ($file in $htmlFiles) {
    if (-not (Test-Path $file)) { continue }
    $content = [System.IO.File]::ReadAllText($file)

    # CSS Classes and IDs
    $content = $content -creplace 'ASSESSMENT-page', 'assessment-page'
    $content = $content -creplace 'ASSESSMENT-topbar', 'assessment-topbar'
    $content = $content -creplace 'ASSESSMENT-title-bar', 'assessment-title-bar'
    $content = $content -creplace 'ASSESSMENT-name-display', 'assessment-name-display'
    $content = $content -creplace 'ASSESSMENT-meta-display', 'assessment-meta-display'
    $content = $content -creplace 'ASSESSMENT-sync-status', 'assessment-sync-status'
    $content = $content -creplace 'ASSESSMENT-timer', 'assessment-timer'
    $content = $content -creplace 'ASSESSMENT-progress', 'assessment-progress'
    $content = $content -creplace 'ASSESSMENT-body', 'assessment-body'
    $content = $content -creplace 'ASSESSMENT-main', 'assessment-main'
    $content = $content -creplace 'ASSESSMENT-nav', 'assessment-nav'
    $content = $content -creplace 'ASSESSMENT-name', 'assessment-name'
    $content = $content -creplace 'ASSESSMENT-meta', 'assessment-meta'
    $content = $content -creplace 'ASSESSMENT-status', 'assessment-status'
    $content = $content -creplace 'submit-ASSESSMENT-btn', 'submit-assessment-btn'
    
    $content = $content -creplace 'Class-card', 'class-card'
    $content = $content -creplace 'Class-icon', 'class-icon'
    $content = $content -creplace 'Class-name', 'class-name'
    $content = $content -creplace 'Classes-section', 'classes-section'
    $content = $content -creplace 'Classes-grid', 'classes-grid'
    $content = $content -creplace 'Classes-heading', 'classes-heading'
    $content = $content -creplace 'overview-Classes-count', 'overview-classes-count'
    $content = $content -creplace 'level-modal-Class', 'level-modal-class'
    
    # JS Variables
    $content = $content -creplace 'ASSESSMENTData', 'assessmentData'
    $content = $content -creplace 'ASSESSMENTDisplayName', 'assessmentDisplayName'
    $content = $content -creplace 'ASSESSMENTId', 'assessmentId'
    $content = $content -creplace 'ASSESSMENT_type', 'assessment_type'
    $content = $content -creplace 'ASSESSMENT_title', 'assessment_title'
    $content = $content -creplace 'ASSESSMENTSections', 'assessmentSections'
    $content = $content -creplace 'isASSESSMENTActive', 'isAssessmentActive'
    $content = $content -creplace 'bootASSESSMENT', 'bootAssessment'
    $content = $content -creplace 'submitASSESSMENT', 'submitAssessment'
    
    $content = $content -creplace 'ClassName', 'className'
    $content = $content -creplace 'ClassIcons', 'classIcons'
    $content = $content -creplace 'ClassEl', 'classEl'
    $content = $content -creplace 'openClassModal', 'openClassModal'
    $content = $content -creplace 'Classes\?', 'classes?'
    $content = $content -creplace '\.Classes\b', '.classes'

    [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Normalized $file"
}
