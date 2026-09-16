$content = Get-Content -Raw -Encoding UTF8 'js/api.js'

$replacement = @'
export async function startChallengeAttempt(studentId, challengeInstanceId) {
  const sb = await getSupabase();

  // 1. Fetch Challenge Instance and Definition Details
  const { data: instData, error: instErr } = await sb.from('challenge_instances')
    .select('*, challenge_definitions(*)')
    .eq('id', challengeInstanceId)
    .single();

  if (instErr || !instData) throw new Error('Challenge instance not found.');
  const definition = instData.challenge_definitions;

  // 2. Determine max attempts
  const maxAttempts = instData.max_attempts || definition.default_max_attempts || 1;

  // 3. Check existing attempts
  const { data: existAtt, error: existErr } = await sb.from('challenge_attempts')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('challenge_instance_id', challengeInstanceId)
    .order('created_at', { ascending: false });

  if (!existErr && existAtt && existAtt.length > 0) {
    const inProgress = existAtt.find(a => a.status === 'IN_PROGRESS');
    if (inProgress) {
      return { attemptId: inProgress.id, status: 'RESUMED' }; // Resume existing
    }
    if (existAtt.length >= maxAttempts) {
      throw new Error(`Maximum attempts (${maxAttempts}) reached for this challenge.`);
    }
  }

  // 4. Create new attempt
  const duration = instData.working_duration_minutes || definition.working_duration_minutes || 60;
  const now = new Date();
  const deadline = new Date(now.getTime() + duration * 60000);

  const { data: newAtt, error: attErr } = await sb.from('challenge_attempts')
    .insert({
      student_id: studentId,
      challenge_instance_id: challengeInstanceId,
      status: 'IN_PROGRESS',
      expected_end_at: deadline.toISOString(),
      score: 0,
      percentage: 0
    })
    .select()
    .single();

  if (attErr) throw attErr;

  // 5. Build snapshots from definitions
  const { data: defQuestions, error: qErr } = await sb.from('challenge_definition_questions')
    .select('question_id, questions(question_text, topic_id, word_type, correct_answer, topics(name))')
    .eq('challenge_definition_id', definition.id);

  if (qErr) throw qErr;

  const answerInserts = (defQuestions || []).map(dq => {
    const q = dq.questions;
    let acceptedAnswers = [];
    if (q.correct_answer) {
      acceptedAnswers = q.correct_answer.split(/[\/;]/).map(s => s.trim()).filter(Boolean);
    }

    return {
      challenge_attempt_id: newAtt.id,
      question_id: dq.question_id,
      question_snapshot: JSON.stringify(q),
      topic_snapshot: q.topics?.name || '',
      word_type_snapshot: q.word_type || '',
      accepted_answers_snapshot: JSON.stringify(acceptedAnswers),
      correct_answer_snapshot: q.correct_answer || '',
      student_answer: '',
      is_correct: false,
      score: 0,
      evaluation_result: null
    };
  });

  if (answerInserts.length > 0) {
    const { error: insErr } = await sb.from('challenge_attempt_answers').insert(answerInserts);
    if (insErr) throw insErr;
  }

  return { attemptId: newAtt.id, status: 'STARTED' };
}

export async function submitChallengeAttempt(attemptId, answersMap, options = {}) {
  const sb = await getSupabase();

  // 1. Fetch the attempt to ensure it's valid and not already submitted
  const { data: att, error: attErr } = await sb.from('challenge_attempts')
    .select('*, challenge_instances(*)')
    .eq('id', attemptId)
    .single();

  if (attErr || !att) throw new Error('Attempt not found.');
  if (att.status !== 'IN_PROGRESS') throw new Error(`Attempt already ${att.status}`);

  // 2. Fetch all pre-existing challenge_attempt_answers to evaluate
  const { data: attemptAnswers, error: fetchErr } = await sb.from('challenge_attempt_answers')
    .select('*')
    .eq('challenge_attempt_id', attemptId);

  if (fetchErr) throw fetchErr;

  let totalPoints = 0;
  let correctCount = 0;
  let maxPoints = attemptAnswers?.length || 1; // prevent div by zero

  const evalTasks = [];

  for (const a of (attemptAnswers || [])) {
    // Determine the student answer provided in answersMap
    // answersMap could be keyed by question_id or answer_id. We'll check both.
    let studentAns = answersMap[a.question_id] || answersMap[a.id];
    
    // If it's an object from UI (like in some versions), extract value
    if (studentAns && typeof studentAns === 'object') {
      studentAns = studentAns.student_answer || studentAns.answerText || '';
    } else if (studentAns === undefined || studentAns === null) {
      studentAns = '';
    }

    // Default to Incorrect
    let isCorrect = false;
    let evalResult = 'incorrect';
    let similarityScore = 0;
    let score = 0;

    let accepted = [];
    try {
      if (a.accepted_answers_snapshot) {
        if (typeof a.accepted_answers_snapshot === 'string') {
          accepted = JSON.parse(a.accepted_answers_snapshot);
        } else {
          accepted = a.accepted_answers_snapshot;
        }
      }
    } catch(e) {}

    const cleanInput = (str) => (str || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanStudent = cleanInput(studentAns);

    if (cleanStudent) {
      for (const validAns of accepted) {
        const cleanValid = cleanInput(validAns);
        if (cleanValid && cleanValid === cleanStudent) {
          isCorrect = true;
          evalResult = 'correct';
          similarityScore = 1.0;
          score = 1;
          break;
        }
      }
    }

    if (isCorrect) {
      totalPoints += 1;
      correctCount += 1;
    }

    evalTasks.push(
      sb.from('challenge_attempt_answers')
        .update({
          student_answer: studentAns,
          is_correct: isCorrect,
          evaluation_result: evalResult,
          similarity_score: similarityScore,
          score: score,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', a.id)
    );
  }

  // Await all answer evaluations
  if (evalTasks.length > 0) {
    await Promise.all(evalTasks);
  }

  const percentage = Math.round((totalPoints / maxPoints) * 100);

  // 3. Update Attempt Status
  const { data: updatedAtt, error: upErr } = await sb.from('challenge_attempts')
    .update({
      status: options.isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED',
      score: totalPoints,
      percentage: percentage,
      submitted_at: new Date().toISOString()
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (upErr) throw upErr;
  return updatedAtt;
}
'@

$content = $content -replace '(?s)export async function startChallengeAttempt\(.*?\n\}\s*export async function submitChallengeAttempt\(.*?\n\}', $replacement
[IO.File]::WriteAllText('js/api.js', $content, [System.Text.Encoding]::UTF8)
