$lines = Get-Content 'C:\Users\ASUS\.gemini\antigravity-ide\brain\7e00d467-4169-403c-91e7-8b0c497a97fb\.system_generated\logs\transcript.jsonl'
foreach ($line in $lines) {
    $obj = $line | ConvertFrom-Json
    if ($obj.type -eq 'USER_INPUT') {
        Write-Host "=== USER INPUT (step $($obj.step_index)) ==="
        Write-Host $obj.content
    }
}
