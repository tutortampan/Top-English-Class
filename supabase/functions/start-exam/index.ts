// TOP ENGLISH CLASS — Edge Function: start-exam
// Server-authoritative exam start. Creates or resumes an attempt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { student_id, exam_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Validate exam is published
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("*, levels(level_number, subject_id)")
      .eq("id", exam_id)
      .eq("exam_status", "published")
      .is("deleted_at", null)
      .single();

    if (examErr || !exam) {
      return new Response(JSON.stringify({ error: "Exam not available." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Check student is in an eligible class for this exam
    const { data: examClass } = await supabase
      .from("exam_classes")
      .select("class_id")
      .eq("exam_id", exam_id);

    const { data: student } = await supabase
      .from("students")
      .select("id, class_id, is_active")
      .eq("id", student_id)
      .is("deleted_at", null)
      .single();

    if (!student || !student.is_active) {
      return new Response(JSON.stringify({ error: "Student not found or inactive." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const eligibleClassIds = (examClass || []).map((ec: any) => ec.class_id);
    if (!eligibleClassIds.includes(student.class_id)) {
      return new Response(JSON.stringify({ error: "Student not eligible for this exam." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Check for existing in-progress attempt (resume)
    const { data: existing } = await supabase
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .eq("exam_id", exam_id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Check if expired
      if (new Date() > new Date(existing.expected_end_at)) {
        await supabase.from("attempts").update({ status: "expired", submitted_at: new Date().toISOString() }).eq("id", existing.id);
        return new Response(JSON.stringify({ error: "Previous attempt has expired." }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      // Resume existing attempt
      let { data: answers } = await supabase.from("attempt_answers").select("*").eq("attempt_id", existing.id);
      if (!answers || answers.length === 0) {
        const { data: questions } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", exam_id)
          .is("deleted_at", null)
          .order("question_order");

        if (questions && questions.length > 0) {
          const answerRows = questions.map((q: any, idx: number) => ({
            attempt_id: existing.id,
            question_id: q.id,
            question_snapshot: {
              question_text: q.question_text,
              answer_type: q.answer_type || exam.answer_type || "written",
              correct_answer: q.correct_answer || "",
              options_json: q.options_json,
              question_order: q.question_order ?? (idx + 1)
            },
            options_snapshot: q.options_json,
            correct_answer_snapshot: q.correct_answer || "",
            student_answer: null,
            score: 0
          }));
          await supabase.from("attempt_answers").insert(answerRows);
          const { data: refetched } = await supabase.from("attempt_answers").select("*").eq("attempt_id", existing.id);
          answers = refetched;
        }
      }

      if (answers && answers.length > 0) {
        answers.sort((a: any, b: any) => {
          const orderA = a.question_snapshot?.question_order;
          const orderB = b.question_snapshot?.question_order;
          if (orderA != null && orderB != null) return orderA - orderB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      }

      return new Response(JSON.stringify({ attempt: existing, answers: answers || [], resumed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Check attempt limits
    if (exam.max_attempts) {
      const { count } = await supabase
        .from("attempts")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student_id)
        .eq("exam_id", exam_id)
        .in("status", ["submitted", "auto_submitted"]);

      if ((count || 0) >= exam.max_attempts) {
        return new Response(JSON.stringify({ error: "Maximum attempts reached." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 5. Create new attempt
    const startedAt = new Date();
    const expectedEndAt = new Date(startedAt.getTime() + exam.time_limit_minutes * 60 * 1000);

    const { data: attempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert({
        student_id,
        exam_id,
        started_at: startedAt.toISOString(),
        expected_end_at: expectedEndAt.toISOString(),
        status: "in_progress",
      })
      .select()
      .single();

    if (attemptErr) throw attemptErr;

    // 6. Create answer snapshots from questions
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("exam_id", exam_id)
      .is("deleted_at", null)
      .order("question_order");

    const answerRows = (questions || []).map((q: any) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      question_snapshot: {
        id: q.id,
        question_order: q.question_order,
        question_text: q.question_text,
        answer_type: q.answer_type,
      },
      options_snapshot: q.options_json,
      correct_answer_snapshot: q.correct_answer,
    }));

    await supabase.from("attempt_answers").insert(answerRows);

    return new Response(JSON.stringify({ attempt, answers: answerRows, resumed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
