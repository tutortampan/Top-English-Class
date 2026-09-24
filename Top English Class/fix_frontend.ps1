# 1. Update app.js
$appJs = Get-Content 'js\admin\app.js' -Raw
$appJs = $appJs -replace '(?m)^import \{ renderProfile', "import { DataGrid } from './datagrid.js';`nwindow.DataGrid = DataGrid;`nimport { renderProfile"
$appJs = $appJs -replace '(?m)^    const sectionTitles', 'export const sectionTitles'
Set-Content 'js\admin\app.js' -Value $appJs

# 2. Update crud-modals.js
$crudJs = Get-Content 'js\admin\crud-modals.js' -Raw
$crudJs = $crudJs -replace '(?m)^import \{ adminInsert', "import { sectionTitles } from './app.js';`nimport { adminInsert"
Set-Content 'js\admin\crud-modals.js' -Value $crudJs

# 3. Bump version strings
Get-ChildItem -Path 'js' -Recurse -Filter '*.js' | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace '\?v=4\.0\.[456]', '?v=4.0.7'
    if ($content -ne $newContent) {
        Set-Content $_.FullName -Value $newContent
    }
}
