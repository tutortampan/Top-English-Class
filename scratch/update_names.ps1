$api = Get-Content js/api.js -Raw
$api = $api -replace 'export function formatStudentName\(name, gender\) \{', 'export function cleanStudentName(name) { if (!name) return ''''; return String(name).trim().replace(/^(mr\.\?|miss\.\?|mrs\.\?|ms\.\?)\s+/i, '''').trim(); }

export function formatStudentDisplayName(name, gender) {'
$api = $api -replace 'name: formatStudentName\(', 'name: cleanStudentName('
$api = $api -replace 'studentObj\.name = formatStudentName\(studentObj\.name, studentObj\.gender\);', 'studentObj.name = cleanStudentName(studentObj.name);'
$api = $api -replace 'student\.name = formatStudentName\(student\.name, g\);', 'student.name = cleanStudentName(student.name);'
$api = $api -replace 'formattedName: formatStudentName\(''Student'', g\)', 'formattedName: formatStudentDisplayName(''Student'', g)'
$api = $api -replace 'const formattedName = formatStudentName\(rawClean, g\);', 'const formattedName = cleanStudentName(rawClean);'
$api = $api -replace 'formatStudentName\(attempt\.students\.name, attempt\.students\.gender\)', 'formatStudentDisplayName(attempt.students.name, attempt.students.gender)'
Set-Content js/api.js -Value $api

$admin = Get-Content admin.html -Raw
$admin = $admin -replace 'formatStudentName', 'formatStudentDisplayName'
$admin = $admin -replace 'payload\.name = formatStudentDisplayName\(payload\.name, payload\.gender\);', 'payload.name = cleanStudentName(payload.name);'
$admin = $admin -replace '\(formatStudentDisplayName\(s\.name, s\.gender\) \|\| ''''\)\.toLowerCase\(\)\.trim\(\) === \(payload\.name \|\| ''''\)\.toLowerCase\(\)\.trim\(\)', '(cleanStudentName(s.name) || '''').toLowerCase().trim() === (payload.name || '''').toLowerCase().trim()'
$admin = $admin -replace 'fetchBatches, formatStudentDisplayName', 'fetchBatches, formatStudentDisplayName, cleanStudentName'
Set-Content admin.html -Value $admin

$dash = Get-Content dashboard.html -Raw
$dash = $dash -replace 'formatStudentName', 'formatStudentDisplayName'
Set-Content dashboard.html -Value $dash

$index = Get-Content index.html -Raw
$index = $index -replace 'formatStudentName', 'formatStudentDisplayName'
Set-Content index.html -Value $index

Write-Host "Replaced!"
