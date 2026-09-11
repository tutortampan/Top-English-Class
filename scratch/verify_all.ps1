Write-Host "=== VERIFICATION TEST SUITE ==="

# 1. Test HTTP Server
try {
    $res = Invoke-WebRequest -Uri "http://localhost:8080/admin.html" -UseBasicParsing
    Write-Host "1. Local Web Server: PASS (Status Code $($res.StatusCode), $($res.RawContentLength) bytes)"
} catch {
    Write-Host "1. Local Web Server: FAIL ($($_.Exception.Message))"
}

# 2. Test Supabase Master Data
$h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
}
$baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

$progs = Invoke-RestMethod -Uri "$baseUrl/programs?select=id,name,is_active&deleted_at=is.null" -Headers $h
Write-Host "2. Active Programs in Supabase:"
$progs | ForEach-Object { Write-Host "   - $($_.name) (ID: $($_.id))" }

$classes = Invoke-RestMethod -Uri "$baseUrl/classes?select=id,name,program_id,programs(name)&deleted_at=is.null" -Headers $h
Write-Host "3. Active Classes in Supabase:"
$classes | ForEach-Object { Write-Host "   - $($_.name) [Program: $($_.programs.name)]" }

$subjects = Invoke-RestMethod -Uri "$baseUrl/subjects?select=id,name,program_id,programs(name)&deleted_at=is.null" -Headers $h
Write-Host "4. Active Subjects in Supabase:"
$subjects | ForEach-Object { Write-Host "   - $($_.name) [Program: $($_.programs.name)]" }

# 5. Check Levels Form Structure in admin.html
$adminContent = Get-Content "admin.html" -Raw
$levelsFormMatch = [regex]::Match($adminContent, '(?s)levels:\s*\[(.*?)\]\s*,')
if ($levelsFormMatch.Success) {
    Write-Host "5. Levels Form Definition in admin.html:"
    $fieldMatches = [regex]::Matches($levelsFormMatch.Groups[1].Value, "id:\s*'([^']+)'")
    $fields = @()
    foreach ($fm in $fieldMatches) { $fields += $fm.Groups[1].Value }
    Write-Host "   Field Order: $($fields -join ' -> ')"
    $expectedOrder = "program_id -> class_id -> subject_id -> level_number -> name -> is_active"
    if (($fields -join ' -> ') -eq $expectedOrder) {
        Write-Host "   Hierarchy Check: PASS (Strictly matches $expectedOrder)"
    } else {
        Write-Host "   Hierarchy Check: FAIL (Expected $expectedOrder)"
    }
} else {
    Write-Host "5. Levels Form: NOT FOUND"
}

# 6. Check Table Columns in renderLevels
if ($adminContent -match '<th class="text-left">Program</th>\s*<th class="text-left">Class</th>\s*<th class="text-left">Subject</th>\s*<th class="text-center">Level #</th>\s*<th class="text-left">Level Name</th>') {
    Write-Host "6. Levels Table Headers: PASS (Program, Class, Subject, Level #, Level Name)"
} else {
    Write-Host "6. Levels Table Headers: FAIL"
}

Write-Host "=== VERIFICATION FINISHED ==="
