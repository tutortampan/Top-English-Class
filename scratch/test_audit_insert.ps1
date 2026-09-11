$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

$auditEntry = @{
    actor_role = "admin"
    action = "exam_metadata"
    entity_type = "exam"
    new_value = @{
        prerequisite_exam_id = "00000000-0000-0000-0000-000000000001"
        exam_order = "1"
        class_id = "d4c6d85a-44b7-4121-acae-28f7b9e70dcd"
    }
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$baseUrl/audit_logs" -Headers $headers -Method Post -Body $auditEntry
    Write-Host "audit_logs INSERT SUCCESS!" ($res | ConvertTo-Json)
    
    # Cleanup test entry
    Invoke-RestMethod -Uri "$baseUrl/audit_logs?id=eq.$($res[0].id)" -Headers $headers -Method Delete | Out-Null
    Write-Host "audit_logs cleaned up successfully!"
} catch {
    Write-Host "audit_logs error: $($_.Exception.Message)"
}
