// TOP ENGLISH CLASS — Edge Function: submit-exam (Assessment V1)
// Server-authoritative scoring, grading, best score resolution, and usage logging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// Damerau-Levenshtein & Normalization
// ============================================================
function damerauLevenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
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

function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[-\s]/g, " ")
    .replace(/[^\w\s']/g, "")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bdon't\b/g, "do not");
}

function parseValidAnswers(row: any): string[] {
  let list: string[] = [];
  if (Array.isArray(row.accepted_answers_snapshot) && row.accepted_answers_snapshot.length > 0) {
    list = row.accepted_answers_snapshot.map((s: any) => String(s));
  } else if (typeof row.accepted_answers_snapshot === "string") {
    list = row.accepted_answers_snapshot.split(/[;/|]/);
  } else if (row.correct_answer_snapshot) {
    list = String(row.correct_answer_snapshot).split(/[;/|]/);
  }
  return list.map(s => s.trim()).filter(Boolean);
}

function evaluateStudentAnswer(studentAnswer: string, validAnswers: string[]): { result: string; score: number; is_correct: boolean; similarity_score: number } {
  const normalizedStudent = normalizeText(studentAnswer);
  if (!normalizedStudent) {
    return { result: "incorrect", score: 0.0, is_correct: false, similarity_score: 0 };
  }

  let bestResult = "incorrect";
  let bestScore = 0.0;
  let bestSimilarity = 0.0;

  for (const valid of validAnswers) {
    const normalizedCorrect = normalizeText(valid);
    if (!normalizedCorrect) continue;

    if (normalizedStudent === normalizedCorrect) {
      return { result: "correct", score: 1.0, is_correct: true, similarity_score: 1.0 };
    }

    // Hyphen tolerance match (e.g. checkin vs check-in)
    if (normalizedStudent.replace(/[-\s]/g, '') === normalizedCorrect.replace(/[-\s]/g, '')) {
      return { result: "correct", score: 1.0, is_correct: true, similarity_score: 1.0 };
    }

    const dist = damerauLevenshtein(normalizedStudent, normalizedCorrect);
    const maxLen = Math.max(normalizedStudent.length, normalizedCorrect.length);
    const minLen = Math.min(normalizedStudent.length, normalizedCorrect.length);
    const similarity = maxLen > 0 ? (maxLen - dist) / maxLen : 0;

    if (similarity > bestSimilarity) bestSimilarity = similarity;

    // Tolerance: safeguard short words: length <= 2 requires exact match; length 3 allows dist 1; length >= 4 allows dist <= 2
    const isAllowedTypo = (minLen >= 4 && dist <= 2) || (minLen === 3 && dist === 1);
    if (isAllowedTypo && bestScore < 0.5) {
      bestResult = "minor_spelling_error";
      bestScore = 0.5;
    }
  }

  return {
    result: bestResult,
    score: bestScore,
    is_correct: bestScore === 1.0,
    similarity_score: Math.round(bestSimilarity * 1000) / 1000
  };
}

function calculateGrade(pct: number): string {
  if (pct === 100) return "S";
  if (pct >= 91) return "A";
  if (pct >= 71) return "B";
  if (pct >= 51) return "C";
  if (pct >= 31) return "D";
  if (pct >= 11) return "E";
  return "F";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attempt_id, answers, status: clientStatus } = await req.json();

    if (!attempt_id) {
      return new Response(JSON.stringify({ error: "Missing attempt_id." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Load Attempt
    const { data: attempt, error: attErr } = await supabase
      .from("attempts")
      .select("*")
      .eq("id", attempt_id)
      .single();

    if (attErr || !attempt) throw new Error("Attempt not found.");

    const currentStatus = String(attempt.status || '').toLowerCase();
    if (!["in_progress"].includes(currentStatus)) {
      return new Response(JSON.stringify({ error: "Attempt has already been submitted or closed." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const now = new Date();
    const deadline = new Date(attempt.expires_at || attempt.expected_end_at);
    const isExpired = now > deadline;
    let finalStatus = isExpired ? "auto_submitted" : (clientStatus || "submitted");

    // 2. Load Existing Attempt Answers
    const { data: answerRows, error: ansErr } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attempt_id);

    if (ansErr || !answerRows || answerRows.length === 0) {
      throw new Error("No questions found for this attempt.");
    }

    // 3. Map Submitted Answers
    const submittedMap: Record<string, string> = {};
    if (Array.isArray(answers)) {
      for (const a of answers) {
        if (a && a.attempt_answer_id) submittedMap[a.attempt_answer_id] = a.student_answer || "";
      }
    } else if (answers && typeof answers === "object") {
      for (const [k, v] of Object.entries(answers)) {
        submittedMap[k] = String(v || "");
      }
    }

    let totalScore = 0;
    let correctCount = 0;
    const totalQuestions = answerRows.length;
    const historyInserts: any[] = [];

    // 4. Evaluate Each Question
    for (const row of answerRows) {
      const studentAnswer = submittedMap[row.id] ?? row.student_answer ?? "";
      const validAnswers = parseValidAnswers(row);
      const evalRes = evaluateStudentAnswer(studentAnswer, validAnswers);

      totalScore += evalRes.score;
      if (evalRes.is_correct) correctCount++;

      await supabase
        .from("attempt_answers")
        .update({
          student_answer: studentAnswer,
          evaluation_result: evalRes.result,
          score: evalRes.score,
          is_correct: evalRes.is_correct,
          similarity_score: evalRes.similarity_score,
          answered_at: now.toISOString()
        })
        .eq("id", row.id);

      if (row.question_id) {
        historyInserts.push({
          question_id: row.question_id,
          assessment_id: attempt.assessment_id || attempt.exam_id,
          attempt_id: attempt.id,
          student_id: attempt.student_id,
          used_at: now.toISOString(),
          topic_name: row.topic_snapshot || "General"
        });
      }
    }

    // 5. Calculate Percentage and Grade
    const percentage = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;
    const roundedPct = Math.round(percentage * 100) / 100;
    const grade = calculateGrade(Math.round(percentage));

    // 6. Update Attempt
    const { data: updatedAttempt, error: updErr } = await supabase
      .from("attempts")
      .update({
        submitted_at: now.toISOString(),
        status: finalStatus,
        score: totalScore,
        correct_count: correctCount,
        total_questions: totalQuestions,
        percentage: roundedPct,
        grade,
        effective_score: roundedPct
      })
      .eq("id", attempt_id)
      .select()
      .single();

    if (updErr) throw updErr;

    // 7. Resolve Best Score across attempts for this student & assessment
    const targetAssessmentId = attempt.assessment_id || attempt.exam_id;
    const { data: allAttempts } = await supabase
      .from("attempts")
      .select("id, effective_score, percentage, created_at")
      .eq("student_id", attempt.student_id)
      .or(`assessment_id.eq.${targetAssessmentId},exam_id.eq.${targetAssessmentId}`)
      .in("status", ["submitted", "auto_submitted", "evaluated", "SUBMITTED", "AUTO_SUBMITTED", "EVALUATED"])
      .order("effective_score", { ascending: false })
      .order("percentage", { ascending: false })
      .order("created_at", { ascending: false });

    if (allAttempts && allAttempts.length > 0) {
      const bestId = allAttempts[0].id;
      for (const a of allAttempts) {
        await supabase
          .from("attempts")
          .update({ is_best_score: a.id === bestId })
          .eq("id", a.id);
      }
    }

    // 8. Record Usage History (Non-blocking)
    if (historyInserts.length > 0) {
      supabase.from("question_usage_history").insert(historyInserts).then();
    }

    return new Response(JSON.stringify({
      attempt_id,
      status: finalStatus,
      score: totalScore,
      correct_count: correctCount,
      total_questions: totalQuestions,
      percentage: roundedPct.toFixed(2),
      grade
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("submit-exam error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
