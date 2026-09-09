$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

# Test various candidate columns on exams
$candidateCols = @(
    'id', 'program_id', 'subject_id', 'level_id', 'class_id', 
    'exam_type', 'exam_title', 'prerequisite_exam_id', 'time_limit_minutes', 
    'minimum_required_score', 'answer_type', 'exam_status', 'question_order', 
    'retake_allowed', 'max_attempts', 'created_at', 'updated_at', 'deleted_at',
    'order', 'exam_order', 'variant', 'name', 'display_name'
)

$validCols = @()
foreach ($col in $candidateCols) {
    try {
        $res = Invoke-RestMethod -Uri "$baseUrl/exams?select=$col&limit=1" -Headers $headers -Method Get
        $validCols += $col
    } catch {
        # Column not found or query error
    }
}

Write-Host "Confirmed Valid Columns in 'exams' table:" ($validCols -join ', ')
$missingCols = $candidateCols | Where-Object { $validCols -notcontains $_ }
Write-Host "Missing/Unrecognized Columns in 'exams' table:" ($missingCols -join ', ')
