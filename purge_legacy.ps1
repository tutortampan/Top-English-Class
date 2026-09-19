$files = Get-ChildItem -Path js, css, *.html -Include *.js, *.css, *.html -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }

# Helper to safely replace keeping case sensitivity
function Safe-Replace {
    param([string]$Text, [string]$Pattern, [string]$Replacement)
    # Using regex replace with negative lookbehind/lookahead to prevent replacing table names
    # e.g., (?i)(?<!_)(challenge)(?!_definitions|_instances|_attempts)
    # We want to replace "challenge" and "challenges" as words or camelCase
    # But not if it's inside "challenge_definitions", "challenge_instances", etc.
    $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    return $regex.Replace($Text, {
        param($match)
        $val = $match.Value
        if ($val -cmatch "^[A-Z][A-Z]+$") { return $Replacement.ToUpper() }
        if ($val -cmatch "^[A-Z]") { return $Replacement.Substring(0,1).ToUpper() + $Replacement.Substring(1).ToLower() }
        return $Replacement.ToLower()
    })
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content
    
    # Negative lookahead/behind to skip table names (which usually have underscores or are exactly table names)
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(challenges)(?![_a-zA-Z])" -Replacement "assessments"
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(challenge)(?![_a-zA-Z])" -Replacement "assessment"
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(affairs)(?![_a-zA-Z])" -Replacement "admins"
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(affair)(?![_a-zA-Z])" -Replacement "admin"
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(blueprints)(?![_a-zA-Z])" -Replacement "boards"
    $content = Safe-Replace -Text $content -Pattern "(?<![_a-zA-Z])(blueprint)(?![_a-zA-Z])" -Replacement "board"
    
    # Capitalized / CamelCase variations where appropriate
    $content = Safe-Replace -Text $content -Pattern "Challenge(?!_)" -Replacement "Assessment"
    $content = Safe-Replace -Text $content -Pattern "challenge(?!_)" -Replacement "assessment"
    $content = Safe-Replace -Text $content -Pattern "Affair(?!_)" -Replacement "Admin"
    $content = Safe-Replace -Text $content -Pattern "affair(?!_)" -Replacement "admin"
    $content = Safe-Replace -Text $content -Pattern "Blueprint(?!_)" -Replacement "Board"
    $content = Safe-Replace -Text $content -Pattern "blueprint(?!_)" -Replacement "board"

    # Explicitly revert any accidental table replacements (because our naive replace might still hit it if it's adjacent to dots or quotes)
    $content = $content -replace "(?i)assessment_definitions", "challenge_definitions"
    $content = $content -replace "(?i)assessment_instances", "challenge_instances"
    $content = $content -replace "(?i)assessment_attempts", "challenge_attempts"
    $content = $content -replace "(?i)assessment_definition_programs", "challenge_definition_programs"

    if ($content -cne $original) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Purged legacy terminology in: $($file.FullName)"
    }
}
