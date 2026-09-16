$entry = @"
## [2026-09-16 12:03 UTC] — Fix and Refine Maintenance Scripts (fix_mojibake, build_clean_challenges, check_encoding)

**Agent/Session:** Antigravity
**Phase:** Maintenance — Script Fixes
**Status:** PASS

### Why
- The maintenance scripts `fix_mojibake.ps1` and `check_encoding.ps1` contained literal "mojibake" strings which broke PowerShell syntax parsing when the script files were saved/read under non-UTF8 encodings. 
- `build_clean_challenges.ps1` threw an exception because `[System.Text.Encoding]::UTF8WithoutBOM` is not a valid static property in PowerShell 5.1 / .NET Framework.

### Changed
- **`scratch/fix_mojibake.ps1`**: Rewritten using robust byte sequence constructions (e.g., `$([char]0x00E2)$([char]0x20AC)...`) to ensure the file is impervious to encoding corruption. Replaced invalid UTF8 encoding with safe `New-Object System.Text.UTF8Encoding `$false`.
- **`scratch/build_clean_challenges.ps1`**: Fixed `ArgumentNullException` by properly initializing `$utf8NoBom`.
- **`scratch/check_encoding.ps1`**: Rewrote the regex to use standard unicode escapes (`\u00E2\u20AC...`) avoiding syntax breaking.
- Ran all three scripts on the JS directory, which successfully identified and repaired 8 files containing Mojibake characters.

### Files
- `scratch/fix_mojibake.ps1`
- `scratch/build_clean_challenges.ps1`
- `scratch/check_encoding.ps1`
- `js/admin/*.js` (various files repaired by the script)
- `docs/CURRENT_STATE.md`

### Tests
- `check_encoding.ps1` parses correctly and correctly outputs the 8 files with issues.
- `build_clean_challenges.ps1` runs without `ArgumentNullException`.
- `fix_mojibake.ps1` correctly fixes the 8 files, and running `check_encoding.ps1` afterwards yields `0` encoding issues found.

### Next Action
- Present changes to user.

"@

$old = Get-Content "$PSScriptRoot\..\docs\CHANGELOG.md" -Raw
$header = "# CHANGELOG`r`n`r`n"
$rest = $old -replace '(?s)^# CHANGELOG\s*', ''
[System.IO.File]::WriteAllText("$PSScriptRoot\..\docs\CHANGELOG.md", $header + $entry + "`r`n" + $rest, [System.Text.Encoding]::UTF8)
Write-Host "CHANGELOG updated successfully"
