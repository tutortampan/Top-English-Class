$appJs = Get-Content 'js\admin\app.js' -Raw
$appJs = $appJs -replace "(?m)^import \{ renderProfile", "import { DataGrid } from './datagrid.js';`nwindow.DataGrid = DataGrid;`nimport { renderProfile"
Set-Content 'js\admin\app.js' -Value $appJs

$crudJs = Get-Content 'js\admin\crud-modals.js' -Raw
# Remove the bad import if it exists (I added it in earlier steps but this file wasn't reverted since I only checkout out app.js)
$crudJs = $crudJs -replace "(?m)^import \{ sectionTitles \} from '\./app\.js';`n", ""

# Add local sectionTitles to crud-modals.js
$sectionTitlesStr = @"
const sectionTitles = {
      profile: 'My Profile', schedule: 'Personal Schedule', work_records: 'Work Records', cv_generator: 'CV Generator',
      institutions: 'Institutions', programs: 'Programs', batches: 'Batches', students: 'Students Roster', 'import-students': 'Import Students', 'progress-view': 'Student Progress',
      subjects: 'Classes (Subjects)', classes: 'Classes', class_instances: 'Class Instances', levels: 'Levels', topics: 'Question Groups & Topics', questions: 'Central Question Bank', question_types: 'Validation Dictionary', 'import-questions': 'Import Questions', 'export-questions': 'Export Questions',
      exams: 'All Challenges', challenge_definitions: 'Challenge Definitions', challenge_instances: 'Challenge Instances', assignments: 'Assignments & Rosters', results: 'Challenge Results', recalibrator: 'Recalibration Engine',
      audit: 'Activity & Audit Logs', settings: 'System Settings', recycle: 'Recycle Bin', health: 'Data Health & Diagnostics'
};
"@

$crudJs = $crudJs -replace "(?m)^function escapeHtml", "$sectionTitlesStr`n`nfunction escapeHtml"
Set-Content 'js\admin\crud-modals.js' -Value $crudJs

# Bump versions
Get-ChildItem -Path 'js' -Recurse -Filter '*.js' | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace '\?v=4\.0\.[456]', '?v=4.0.7'
    if ($content -ne $newContent) {
        Set-Content $_.FullName -Value $newContent
    }
}
