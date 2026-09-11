$content = Get-Content "js/supabase.js" -Raw
if ($content -match "_initPromise" -and $content -match "createClient") {
    Write-Host "SUCCESS: js/supabase.js implements singleton promise lock!" -ForegroundColor Green
} else {
    Write-Host "ERROR: js/supabase.js does not implement singleton promise lock!" -ForegroundColor Red
}
