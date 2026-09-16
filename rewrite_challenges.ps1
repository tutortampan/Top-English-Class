$content = Get-Content -Raw -Encoding UTF8 'js/admin/challenges-management.js'

$content = $content -replace "adminFetchAll\('attempts', '.*?\'\)", "adminFetchAll('challenge_attempts', '*, students(name, gender, batch_id, batches(name), program_id, programs(name, institution_id, institutions(name))), challenge_instances(challenge_definitions(title, challenge_type)), challenge_attempt_answers(id, evaluation_result, score)')"

$content = $content -replace "r\.exam_id ===", "r.challenge_instances?.challenge_definitions?.id ==="
$content = $content -replace "a\.exams\?\.exam_title", "a.challenge_instances?.challenge_definitions?.title"
$content = $content -replace "a\.exams\?\.exam_type", "a.challenge_instances?.challenge_definitions?.challenge_type"
$content = $content -replace "a\.attempt_answers", "a.challenge_attempt_answers"

[IO.File]::WriteAllText('js/admin/challenges-management.js', $content, [System.Text.Encoding]::UTF8)
