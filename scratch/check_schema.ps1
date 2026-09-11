$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
}
try {
    $swagger = Invoke-RestMethod -Uri 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/' -Headers $headers -Method Get
    $props = $swagger.definitions.exams.properties.PSObject.Properties.Name
    Write-Host "Exams columns in OpenAPI definition: " ($props -join ', ')
    $hasPrereq = $props -contains 'prerequisite_exam_id'
    $hasClass = $props -contains 'class_id'
    Write-Host "Has prerequisite_exam_id: $hasPrereq"
    Write-Host "Has class_id: $hasClass"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
