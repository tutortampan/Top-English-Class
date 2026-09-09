$headers = @{
    'apikey' = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Authorization' = 'Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4'
    'Prefer' = 'return=representation'
}
$baseUrl = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1'

Write-Host "=== SUPABASE POSTGREST LIVE AUDIT ==="

# 1. Programs
try {
    $progs = Invoke-RestMethod -Uri "$baseUrl/programs?select=*" -Headers $headers -Method Get
    Write-Host "Programs count: $($progs.Count)"
    foreach ($p in $progs) { Write-Host " - [$($p.id)] $($p.name) (active: $($p.is_active))" }
} catch { Write-Host "Error fetching programs: $($_.Exception.Message)" }

# 2. Classes
try {
    $classes = Invoke-RestMethod -Uri "$baseUrl/classes?select=*" -Headers $headers -Method Get
    Write-Host "Classes count: $($classes.Count)"
    foreach ($c in $classes) { Write-Host " - [$($c.id)] $($c.name) (prog: $($c.program_id))" }
} catch { Write-Host "Error fetching classes: $($_.Exception.Message)" }

# 3. Subjects
try {
    $subjs = Invoke-RestMethod -Uri "$baseUrl/subjects?select=*" -Headers $headers -Method Get
    Write-Host "Subjects count: $($subjs.Count)"
    foreach ($s in $subjs) { Write-Host " - [$($s.id)] $($s.name) (prog: $($s.program_id))" }
} catch { Write-Host "Error fetching subjects: $($_.Exception.Message)" }

# 4. Levels
try {
    $levels = Invoke-RestMethod -Uri "$baseUrl/levels?select=*" -Headers $headers -Method Get
    Write-Host "Levels count: $($levels.Count)"
    if ($levels.Count -gt 0) {
        Write-Host "Level columns: $(($levels[0].PSObject.Properties.Name) -join ', ')"
        foreach ($l in $levels) { Write-Host " - [$($l.id)] number: $($l.level_number), name: $($l.name), subj: $($l.subject_id), class: $($l.class_id)" }
    }
} catch { Write-Host "Error fetching levels: $($_.Exception.Message)" }

# 5. Exams
try {
    $exams = Invoke-RestMethod -Uri "$baseUrl/exams?select=*" -Headers $headers -Method Get
    Write-Host "Exams count: $($exams.Count)"
    if ($exams.Count -gt 0) {
        Write-Host "Exam columns: $(($exams[0].PSObject.Properties.Name) -join ', ')"
        foreach ($e in $exams) { Write-Host " - [$($e.id)] title: $($e.exam_title), type: $($e.exam_type), status: $($e.exam_status)" }
    } else {
        Write-Host "Exams table is currently empty."
    }
} catch { Write-Host "Error fetching exams: $($_.Exception.Message)" }
