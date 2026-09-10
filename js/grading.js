// TOP ENGLISH CLASS — Authoritative Centralized Grading & Vocabulary Engine
// Phases 9, 10, 11, 15, 16

/**
 * Standard Damerau-Levenshtein Edit Distance
 */
export function damerauLevenshtein(a, b) {
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[la][lb];
}

/**
 * Normalize answer text:
 * - trim
 * - lowercase
 * - collapse multiple whitespace to single space
 * - normalize contractions (e.g. i'm -> i am)
 */
export function normalizeAnswerText(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '') // preserve letters, digits, spaces, hyphens, apostrophes
    .replace(/\bi'm\b/g, 'i am');
}

/**
 * Strip hyphens for hyphen tolerance comparison:
 * e.g. "check-in" -> "checkin", "part-time" -> "parttime"
 */
export function stripHyphens(text) {
  return String(text ?? '').replace(/-/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse correct answers from raw string supporting ; and | delimiters.
 * e.g. "run;jog|sprint" -> ["run", "jog", "sprint"]
 */
export function parseCorrectAnswers(rawAnswer) {
  if (rawAnswer === null || rawAnswer === undefined) return [];
  if (Array.isArray(rawAnswer)) return rawAnswer.map(s => String(s).trim()).filter(Boolean);
  return String(rawAnswer)
    .split(/[;|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Single Authoritative Answer Evaluation (Written, Speech, Dropdown, Multiple Choice)
 * Evaluates student answer against raw correct answer snapshot.
 *
 * @param {string} studentAnswer
 * @param {string|string[]} rawCorrectAnswer
 * @param {string} answerType ('written' | 'speech_to_text' | 'dropdown' | 'multiple_choice')
 * @returns {{ result: 'correct'|'minor_spelling_error'|'incorrect', score: number, matchedAnswer: string }}
 */
export function evaluateAnswer(studentAnswer, rawCorrectAnswer, answerType = 'written') {
  const normStudent = normalizeAnswerText(studentAnswer);
  const possibleAnswers = parseCorrectAnswers(rawCorrectAnswer);

  if (possibleAnswers.length === 0) {
    // If no correct answer was defined in DB
    return { result: normStudent ? 'correct' : 'incorrect', score: normStudent ? 1.0 : 0.0, matchedAnswer: '' };
  }

  if (!normStudent) {
    return { result: 'incorrect', score: 0.0, matchedAnswer: possibleAnswers[0] };
  }

  let bestResult = { result: 'incorrect', score: 0.0, matchedAnswer: possibleAnswers[0] };

  for (const opt of possibleAnswers) {
    const normOpt = normalizeAnswerText(opt);

    // 1. Direct Exact Match (Normalized)
    if (normStudent === normOpt) {
      return { result: 'correct', score: 1.0, matchedAnswer: opt };
    }

    // 2. Hyphen Tolerance Match (Phase 11)
    // When student omits or adds hyphens (e.g. checkin vs check-in), it is NOT a spelling error.
    if (stripHyphens(normStudent) === stripHyphens(normOpt)) {
      return { result: 'correct', score: 1.0, matchedAnswer: opt };
    }

    // 3. Written or Speech tolerance: Damerau-Levenshtein distance <= 2 -> minor_spelling_error
    if (answerType === 'written' || answerType === 'speech_to_text') {
      const dist = damerauLevenshtein(normStudent, normOpt);
      if (dist <= 2 && bestResult.score < 0.5) {
        bestResult = { result: 'minor_spelling_error', score: 0.5, matchedAnswer: opt };
      }
    }
  }

  return bestResult;
}

/**
 * Centralized Percentage Calculation
 */
export function calculatePercentage(score, totalPoints) {
  const tot = Number(totalPoints) || 0;
  const sc = Number(score) || 0;
  if (tot <= 0) return 0;
  const pct = (sc / tot) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Authoritative Passing Score Engine (Phase 9)
 * percentage >= configuredPassingPercentage
 */
export function isPassing(percentage, passingThreshold = 60) {
  const pct = Number(percentage) || 0;
  const threshold = Number(passingThreshold) || 60;
  return pct >= threshold;
}

/**
 * Authoritative Prerequisite Engine (Phase 10)
 */
export function isPrerequisiteMet(studentBestPercentage, requiredPercentage = 60) {
  if (studentBestPercentage === null || studentBestPercentage === undefined) return false;
  const best = Number(studentBestPercentage) || 0;
  const req = Number(requiredPercentage) || 60;
  return best >= req;
}

/**
 * Centralized Grade Engine (AGENTS.md §2.10)
 */
export function calculateGrade(percentage) {
  const pct = Math.round(Number(percentage) || 0);
  if (pct >= 100) return 'S';
  if (pct >= 91) return 'A';
  if (pct >= 71) return 'B';
  if (pct >= 51) return 'C';
  if (pct >= 31) return 'D';
  if (pct >= 11) return 'E';
  return 'F';
}

/** Alias for normalizeAnswerText */
export function normalizeWrittenAnswer(text) {
  return normalizeAnswerText(text);
}

/**
 * Authoritative Recalculate Attempt (Phases 15 & 16)
 * @param {Array<{student_answer, correct_answer, answer_type}>} answers
 * @param {number} passingThreshold
 */
export function recalculateAttempt(answers, passingThreshold = 60) {
  let totalScore = 0;
  const totalQuestions = answers.length;
  const evaluatedAnswers = answers.map(ans => {
    const evalRes = evaluateAnswer(ans.student_answer, ans.correct_answer, ans.answer_type);
    totalScore += evalRes.score;
    return {
      ...ans,
      score: evalRes.score,
      evaluation_result: evalRes.evaluation_result
    };
  });
  const percentage = calculatePercentage(totalScore, totalQuestions);
  const grade = calculateGrade(percentage);
  const passed = isPassing(percentage, passingThreshold);
  return {
    score: totalScore,
    totalQuestions,
    percentage,
    grade,
    isPassing: passed,
    answers: evaluatedAnswers
  };
}

