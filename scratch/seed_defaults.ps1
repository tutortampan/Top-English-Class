$global:h = @{
    "apikey" = "sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Authorization" = "Bearer sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}
$global:baseUrl = "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1"

function Ensure-Program($name) {
    $existing = Invoke-RestMethod -Uri "$($global:baseUrl)/programs?name=eq.$([Uri]::EscapeDataString($name))&select=*" -Headers $global:h -Method Get
    if ($existing -and $existing.Count -gt 0) {
        $p = $existing[0]
        if ($p.deleted_at) {
            Invoke-RestMethod -Uri "$($global:baseUrl)/programs?id=eq.$($p.id)" -Headers $global:h -Method Patch -Body '{"deleted_at":null,"is_active":true}'
            Write-Host "Restored Program: $name ($($p.id))"
        } else {
            Write-Host "Program already active: $name ($($p.id))"
        }
        return $p.id
    } else {
        $body = @{ name = $name; is_active = $true } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "$($global:baseUrl)/programs" -Headers $global:h -Method Post -Body $body
        Write-Host "Created Program: $name ($($created[0].id))"
        return $created[0].id
    }
}

function Ensure-Class($progId, $className) {
    $existing = Invoke-RestMethod -Uri "$($global:baseUrl)/classes?program_id=eq.$progId&name=eq.$([Uri]::EscapeDataString($className))&select=*" -Headers $global:h -Method Get
    if ($existing -and $existing.Count -gt 0) {
        $c = $existing[0]
        if ($c.deleted_at) {
            Invoke-RestMethod -Uri "$($global:baseUrl)/classes?id=eq.$($c.id)" -Headers $global:h -Method Patch -Body '{"deleted_at":null,"is_active":true}'
            Write-Host "Restored Class: $className ($($c.id))"
        } else {
            Write-Host "Class already active: $className ($($c.id))"
        }
        return $c.id
    } else {
        $body = @{ program_id = $progId; name = $className; is_active = $true } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "$($global:baseUrl)/classes" -Headers $global:h -Method Post -Body $body
        Write-Host "Created Class: $className ($($created[0].id))"
        return $created[0].id
    }
}

function Ensure-Subject($progId, $subjName) {
    $existing = Invoke-RestMethod -Uri "$($global:baseUrl)/subjects?program_id=eq.$progId&name=eq.$([Uri]::EscapeDataString($subjName))&select=*" -Headers $global:h -Method Get
    if ($existing -and $existing.Count -gt 0) {
        $s = $existing[0]
        if ($s.deleted_at) {
            Invoke-RestMethod -Uri "$($global:baseUrl)/subjects?id=eq.$($s.id)" -Headers $global:h -Method Patch -Body '{"deleted_at":null,"is_active":true}'
            Write-Host "Restored Subject: $subjName ($($s.id))"
        } else {
            Write-Host "Subject already active: $subjName ($($s.id))"
        }
        return $s.id
    } else {
        $body = @{ program_id = $progId; name = $subjName; is_active = $true } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "$($global:baseUrl)/subjects" -Headers $global:h -Method Post -Body $body
        Write-Host "Created Subject: $subjName ($($created[0].id))"
        return $created[0].id
    }
}

Write-Host "=== SEEDING DEFAULT PROGRAMS, CLASSES, AND SUBJECTS ==="

# 1. CEC
$cecId = Ensure-Program "CEC"
Ensure-Class $cecId "Camp"
Ensure-Subject $cecId "Vocabularies"

# If CEC has "Vocabulary" (singular), let's rename or keep both
$oldVocab = Invoke-RestMethod -Uri "$($global:baseUrl)/subjects?program_id=eq.$cecId&name=eq.Vocabulary&select=*" -Headers $global:h -Method Get
if ($oldVocab -and $oldVocab.Count -gt 0) {
    Invoke-RestMethod -Uri "$($global:baseUrl)/subjects?id=eq.$($oldVocab[0].id)" -Headers $global:h -Method Patch -Body '{"name":"Vocabularies"}'
    Write-Host "Updated CEC 'Vocabulary' to 'Vocabularies'"
}

# 2. Sheraton
$sheratonId = Ensure-Program "Sheraton"
Ensure-Class $sheratonId "Morning"
Ensure-Class $sheratonId "Afternoon"
Ensure-Subject $sheratonId "Vocabularies"

# 3. Tamata
$tamataId = Ensure-Program "Tamata"
Ensure-Class $tamataId "Hospitality"
Ensure-Subject $tamataId "Vocabularies"

Write-Host "=== SEEDING COMPLETE ==="
