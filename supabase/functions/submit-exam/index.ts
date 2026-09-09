// TOP ENGLISH CLASS — Edge Function: submit-exam
// Server-authoritative scoring, grading, and level progression calculation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// Damerau-Levenshtein Edit Distance (written answer tolerance)
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
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s']/g, "")
    .replace(/\bi'm\b/g, "i am");
}

function evaluateWritten(studentAnswer: string, correctAnswer: string): { result: string; score: number } {
  const s = normalizeText(studentAnswer);
  const c = normalizeText(correctAnswer);
  if (s === c) return { result: "correct", score: 1.0 };
  const dist = damerauLevenshtein(s, c);
  if (dist <= 2) return { result: "minor_spelling_error", score: 0.5 };
  return { result: "incorrect", score: 0.0 };
}

function evaluateExact(studentAnswer: string, correctAnswer: string): { result: string; score: number } {
  const s = normalizeText(studentAnswer);
  const c = normalizeText(correctAnswer);
  if (s === c) return { result: "correct", score: 1.0 };
  return { result: "incorrect", score: 0.0 };
}

// ============================================================
// Authoritative Grade Calculation (AGENTS.md §2.10)
// ============================================================
function calculateGrade(pct: number): string {
  if (pct === 100) return "S";
  if (pct >= 91) return "A";
  if (pct >= 71) return "B";
  if (pct >= 51) return "C";
  if (pct >= 31) return "D";
  if (pct >= 11) return "E";
  return "F";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attempt_id, answers } = await req.json();
    // answers: [{ attempt_answer_id, student_answer }]

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load attempt
    const { data: attempt, error: attErr } = await supabase
      .from("attempts")
      .select("*, exams(time_limit_minutes, minimum_required_score, answer_type)")
      .eq("id", attempt_id)
      .single();

    if (attErr || !attempt) throw new Error("Attempt not found.");
    if (!["in_progress"].includes(attempt.status)) {
      return new Response(JSON.stringify({ error: "Attempt already submitted." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const now = new Date();
    const expired = now > new Date(attempt.expected_end_at);
    const finalStatus = expired ? "auto_submitted" : "submitted";

    // Load answer rows
    const { data: answerRows } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attempt_id);

    if (!answerRows) throw new Error("No answer rows found.");

    // Build map of submitted answers
    const submittedMap: Record<string, string> = {};
    for (const a of (answers || [])) {
      submittedMap[a.attempt_answer_id] = a.student_answer || "";
    }

    let totalScore = 0;
    const totalQuestions = answerRows.length;

    const updates = answerRows.map((row: any) => {
      const studentAnswer = submittedMap[row.id] || "";
      const answerType = row.question_snapshot?.answer_type || attempt.exams?.answer_type;
      let evaluation: { result: string; score: number };

      if (answerType === "written") {
        evaluation = evaluateWritten(studentAnswer, row.correct_answer_snapshot);
      } else {
        evaluation = evaluateExact(studentAnswer, row.correct_answer_snapshot);
      }

      totalScore += evaluation.score;
      return {
        id: row.id,
        student_answer: studentAnswer,
        evaluation_result: evaluation.result,
        score: evaluation.score,
      };
    });

    // Update each answer row
    for (const upd of updates) {
      await supabase
        .from("attempt_answers")
        .update({
          student_answer: upd.student_answer,
          evaluation_result: upd.evaluation_result,
          score: upd.score,
        })
        .eq("id", upd.id);
    }

    // Calculate percentage and grade
    const percentage = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;
    const grade = calculateGrade(Math.round(percentage));

    // Update attempt
    await supabase.from("attempts").update({
      submitted_at: now.toISOString(),
      status: finalStatus,
      score: totalScore,
      percentage: percentage,
      grade,
      effective_score: percentage,
    }).eq("id", attempt_id);

    // Update progression
    await updateProgression(supabase, attempt.student_id, attempt.exam_id);

    return new Response(JSON.stringify({
      attempt_id,
      status: finalStatus,
      score: totalScore,
      total_questions: totalQuestions,
      percentage: percentage.toFixed(2),
      grade,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function updateProgression(supabase: any, studentId: string, examId: string) {
  try {
    // Get exam details
    const { data: exam } = await supabase.from("exams").select("subject_id, level_id, minimum_required_score").eq("id", examId).single();
    if (!exam) return;

    // Get all exams in this level
    const { data: levelExams } = await supabase.from("exams")
      .select("id, minimum_required_score")
      .eq("level_id", exam.level_id)
      .eq("exam_status", "published")
      .is("deleted_at", null);

    if (!levelExams?.length) return;

    // Get student's highest scores per exam
    let allPassed = true;
    for (const lExam of levelExams) {
      const { data: bestAttempt } = await supabase
        .from("attempts")
        .select("percentage")
        .eq("student_id", studentId)
        .eq("exam_id", lExam.id)
        .in("status", ["submitted", "auto_submitted"])
        .order("percentage", { ascending: false })
        .limit(1)
        .single();

      if (!bestAttempt || bestAttempt.percentage < (lExam.minimum_required_score || 60)) {
        allPassed = false;
        break;
      }
    }

    // Update current level completion
    await supabase.from("progress").upsert({
      student_id: studentId,
      subject_id: exam.subject_id,
      level_id: exam.level_id,
      is_unlocked: true,
      is_completed: allPassed,
      completed_at: allPassed ? new Date().toISOString() : null,
    }, { onConflict: "student_id,subject_id,level_id" });

    // If passed, unlock next level
    if (allPassed) {
      const { data: currentLevel } = await supabase.from("levels").select("level_number").eq("id", exam.level_id).single();
      if (!currentLevel) return;

      const { data: nextLevel } = await supabase.from("levels")
        .select("id")
        .eq("subject_id", exam.subject_id)
        .eq("level_number", currentLevel.level_number + 1)
        .single();

      if (nextLevel) {
        await supabase.from("progress").upsert({
          student_id: studentId,
          subject_id: exam.subject_id,
          level_id: nextLevel.id,
          is_unlocked: true,
          unlocked_at: new Date().toISOString(),
        }, { onConflict: "student_id,subject_id,level_id" });
      }
    }
  } catch (err) {
    console.error("Progression update error:", err);
  }
}
