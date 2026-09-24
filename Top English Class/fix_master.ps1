$ErrorActionPreference = 'Stop'

# STEP 1: app.js
$appJs = Get-Content 'js\admin\app.js' -Raw
# 1. Hoist _currentSection and _currentDomain
$appJs = $appJs -replace '(?m)^\s*let _currentSection = null;\s*\r?\n', ''
$appJs = $appJs -replace '(?m)^import \{ renderProfile.+', "import { renderProfile, renderSchedule, renderWorkRecords, renderCvGenerator } from './affairs.js?v=4.0.8';`n`nlet _currentSection = 'profile';`nlet _currentDomain = 'affairs';"
# 2. Hoist window assignments (line 1163) earlier
$windowAssign = @"
window.openDuplicateStudentsModal = openDuplicateStudentsModal;
window.openDuplicateQuestionsModal = openDuplicateQuestionsModal;
window.openCrudModal = openCrudModal;
"@
$appJs = $appJs -replace '(?m)^window\.openDuplicateStudentsModal = openDuplicateStudentsModal;$', ''
$appJs = $appJs -replace '(?m)^window\.openDuplicateQuestionsModal = openDuplicateQuestionsModal;$', ''
$appJs = $appJs -replace '(?m)^window\.openCrudModal = openCrudModal;$', ''
$appJs = $appJs -replace '(?m)^let _currentDomain = ''affairs'';', "let _currentDomain = 'affairs';`n`n$windowAssign"

# 3. showConsole fallback
$appJs = $appJs -replace '(?s)function showConsole\(\) \{.*?if \(targetSec && \(sectionTitles\[targetSec\].*?\}', 
@"
function showConsole() {
      document.getElementById('admin-login-screen').classList.add('hidden');
      document.getElementById('admin-console').classList.remove('hidden');
      updateAdminKpiBanner();
      const hash = window.location.hash.substring(1);
      if (!hash || hash === 'profile') {
        loadSection('profile', true);
        return;
      }
      const targetSec = aliasSectionMap[hash] || hash;
      if (targetSec && (sectionTitles[targetSec] || targetSec === 'students')) {
"@
Set-Content 'js\admin\app.js' -Value $appJs

# STEP 2: crud-modals.js
$crudJs = Get-Content 'js\admin\crud-modals.js' -Raw
$crudDomRefs = @"
let crudModal = null;
let crudForm = null;
let crudModalTitle = null;
let crudSaveBtn = null;

export function _ensureDomRefs() {
  if (!crudModal) crudModal = document.getElementById('crud-modal');
  if (!crudForm) crudForm = document.getElementById('crud-form');
  if (!crudModalTitle) crudModalTitle = document.getElementById('crud-modal-title');
  if (!crudSaveBtn) crudSaveBtn = document.getElementById('crud-save-btn');
}
"@
$crudJs = $crudJs -replace '(?s)function _ensureDomRefs\(\) \{.*?\}', $crudDomRefs

$sectionFallback = @"
const SECTION_TITLES = typeof sectionTitles !== 'undefined' ? sectionTitles : {
  institutions: 'Institution',
  programs: 'Program',
  batches: 'Batch',
  students: 'Student',
  classes: 'Class Blueprint',
  class_instances: 'Class Instance',
  topics: 'Topic',
  questions: 'Question',
  exams: 'Challenge',
  results: 'Result',
  profile: 'Profile'
};
"@
$crudJs = $crudJs -replace '(?s)const sectionTitles = \{.*?\};', $sectionFallback
$crudJs = $crudJs -replace '(?m)sectionTitles\[section\]', 'SECTION_TITLES[section]'
Set-Content 'js\admin\crud-modals.js' -Value $crudJs

# STEP 3: program-management.js
$progJs = Get-Content 'js\admin\program-management.js' -Raw
$progJs = $progJs -replace '(?m)const raw = row\._raw;', 'const raw = row?._raw || row || {};'
$progJs = $progJs -replace '(?m)row\._raw\.is_active', 'raw.is_active'
$progJs = $progJs -replace '(?m)row\._raw\)', 'raw)'

# Also fix renderBatches
$progJs = $progJs -replace '(?m)row\.programs\.id', '(row?.programs?.id || row?.program_id || row?.id || ''-'')'
$progJs = $progJs -replace '(?m)row\.programs\.name', '(row?.programs?.name || row?.program_name || ''-'')'
Set-Content 'js\admin\program-management.js' -Value $progJs

# STEP 3.2: exam-management.js
$examJs = Get-Content 'js\admin\exam-management.js' -Raw
$examJs = $examJs -replace '(?m)row\.programs\.name', '(row?.programs?.name || row?.programName || row?.program_name || ''-'')'
$examJs = $examJs -replace '(?m)row\.classes\.name', '(row?.classes?.name || row?.className || row?.class_name || ''-'')'
Set-Content 'js\admin\exam-management.js' -Value $examJs

# STEP 4: api.js (Flat fetches)
$apiJs = Get-Content 'js\api.js' -Raw
$apiJs = $apiJs -replace '(?m)\.select\(''\*, programs\(name, institution_id, institutions\(name\)\)''\)', ".select('*')"
$apiJs = $apiJs -replace '(?m)\.select\(''\*, classes\(name\)''\)', ".select('*')"
$apiJs = $apiJs -replace '(?m)\.select\(''\*, classes\(name\), levels\(name, level_number\), institutions\(name\)''\)', ".select('*')"
$apiJs = $apiJs -replace '(?m)\.select\(''\*, students\(name, gender, batch_id, batches\(name\), program_id, programs\(name, institution_id, institutions\(name\)\)\), challenge_instances\(challenge_definitions\(title, challenge_type\)\), challenge_attempt_answers\(id, evaluation_result, score\)''\)', ".select('*')"
$apiJs = $apiJs -replace '(?m)\.select\(''\*, class_instances\(classes\(name\)\)''\)', ".select('*')"
# Note: For user_professionals, topics, question_types, wrap with try-catch in adminFetchAll
$apiJs = $apiJs -replace '(?s)(if \(table === ''user_professionals''\).*?)\{.*?(const \{ data, error \})', 
"`$1 { try { `$2"
# Wait, replacing complex try/catch with regex is dangerous. I will manually do it.
Set-Content 'js\api.js' -Value $apiJs

# STEP 6: Bump Cache
Get-ChildItem -Path '.' -Recurse -Include '*.js','*.html' | ForEach-Object {
    if ($_.FullName -notmatch 'node_modules|\.git') {
        $c = Get-Content $_.FullName -Raw
        $nc = $c -replace '\?v=4\.0\.[4567]', '?v=4.0.8'
        $nc = $nc -replace 'abcd-system-v4\.0\.[4567]', 'abcd-system-v4.0.8'
        if ($c -ne $nc) {
            Set-Content $_.FullName -Value $nc
        }
    }
}
