// @ts-nocheck
// TOP ENGLISH CLASS — Edge Function: start-exam (Assessment V1)
// Server-authoritative assessment start. Creates or resumes an attempt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const student_id = payload.student_id;
    const assessment_id = payload.assessment_id || payload.exam_id;

    if (!student_id || !assessment_id) {
      return new Response(JSON.stringify({ error: "Missing student_id or assessment_id." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch Student Details
    const { data: student } = await supabase
      .from("students")
      .select("id, institution_id, program_id, batch_id, is_active")
      .eq("id", student_id)
      .is("deleted_at", null)
      .single();

    if (!student || !student.is_active) {
      return new Response(JSON.stringify({ error: "Student not found or inactive." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch Assessment Details (Try assessments table first, fallback to exams)
    let assessment: any = null;
    const { data: asmData, error: asmErr } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessment_id)
      .is("deleted_at", null)
      .single();

    if (!asmErr && asmData) {
      assessment = asmData;
    } else {
      const { data: exData, error: exErr } = await supabase
        .from("exams")
        .select("*")
        .eq("id", assessment_id)
        .is("deleted_at", null)
        .single();
      if (!exErr && exData) {
        assessment = {
          ...exData,
          title: exData.title || exData.exam_title,
          assessment_type: exData.assessment_type || 'EVALUATION',
          working_duration_minutes: exData.working_duration_minutes || exData.time_limit_minutes || 60,
          status: (exData.exam_status || 'draft').toUpperCase()
        };
      }
    }

    if (!assessment) {
      return new Response(JSON.stringify({ error: "Assessment not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const currentStatus = String(assessment.status || '').toUpperCase();
    if (currentStatus !== 'PUBLISHED' && currentStatus !== 'ACTIVE') {
      return new Response(JSON.stringify({ error: "Assessment is not available (not published)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Check Eligibility / Access Rules
    let isEligible = false;
    let assignmentWindow: { start: string | null; end: string | null } = { start: null, end: null };

    // Check assignments table
    const { data: assignments } = await supabase
      .from("assignments")
      .select("*")
      .eq("assessment_id", assessment_id)
      .eq("status", "active");

    if (assignments && assignments.length > 0) {
      const studentMatch = assignments.find(a => a.assignment_type === 'STUDENT' && a.student_id === student_id);
      const batchMatch = assignments.find(a => a.assignment_type === 'BATCH' && a.batch_id === student.batch_id);

      const activeAssignment = studentMatch || batchMatch;
      if (activeAssignment) {
        isEligible = true;
        assignmentWindow = {
          start: activeAssignment.availability_start,
          end: activeAssignment.availability_end
        };
      }
    }

    // Fallback: Check assessment_programs or exam_programs or exam_access
    if (!isEligible) {
      const { data: progMatch } = await supabase
        .from("assessment_programs")
        .select("*")
        .eq("assessment_id", assessment_id)
        .eq("program_id", student.program_id);

      if (progMatch && progMatch.length > 0) {
        isEligible = true;
      } else {
        const { data: exProgMatch } = await supabase
          .from("exam_programs")
          .select("*")
          .eq("exam_id", assessment_id)
          .eq("program_id", student.program_id);
        if (exProgMatch && exProgMatch.length > 0) isEligible = true;
      }
    }

    // Fallback 2: If no explicit assignment rules exist yet, allow if institution matches
    if (!isEligible && (!assignments || assignments.length === 0)) {
      if (!assessment.institution_id || assessment.institution_id === student.institution_id) {
        isEligible = true;
      }
    }

    if (!isEligible) {
      return new Response(JSON.stringify({ error: "Student not eligible for this assessment." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Check Availability Window
    const now = new Date();
    const effectiveStart = assignmentWindow.start || assessment.availability_start;
    const effectiveEnd = assignmentWindow.end || assessment.availability_end;

    if (effectiveStart && now < new Date(effectiveStart)) {
      return new Response(JSON.stringify({ error: "This assessment is not yet available." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (effectiveEnd && now > new Date(effectiveEnd)) {
      return new Response(JSON.stringify({ error: "This assessment is no longer available." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Check Prerequisite Assessment
    const prereqId = assessment.prerequisite_assessment_id || assessment.prerequisite_exam_id;
    if (prereqId) {
      const { data: prereqAttempts } = await supabase
        .from("attempts")
        .select("effective_score, percentage, status")
        .eq("student_id", student_id)
        .or(`assessment_id.eq.${prereqId},exam_id.eq.${prereqId}`)
        .in("status", ["submitted", "auto_submitted", "evaluated", "SUBMITTED", "AUTO_SUBMITTED", "EVALUATED"]);

      const reqScore = assessment.prerequisite_min_score || 60;
      const hasPassed = prereqAttempts && prereqAttempts.some((a: any) => (a.effective_score || a.percentage || 0) >= reqScore);

      if (!hasPassed) {
        return new Response(JSON.stringify({ error: `Prerequisite not completed. You must score at least ${reqScore}% on the prerequisite assessment.` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 6. Check for existing in-progress attempt (Resume)
    const { data: existing } = await supabase
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .or(`assessment_id.eq.${assessment_id},exam_id.eq.${assessment_id}`)
      .in("status", ["in_progress", "IN_PROGRESS"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const deadline = new Date(existing.expires_at || existing.expected_end_at);
      if (now > deadline) {
        await supabase.from("attempts")
          .update({ status: "expired", submitted_at: now.toISOString() })
          .eq("id", existing.id);

        return new Response(JSON.stringify({ error: "Previous attempt has expired." }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fetch saved answers for this attempt (strip answer keys for client)
      const { data: rawAnswers } = await supabase
        .from("attempt_answers")
        .select("id, question_id, question_snapshot, topic_snapshot, word_type_snapshot, student_answer, score")
        .eq("attempt_id", existing.id)
        .order("created_at");

      return new Response(JSON.stringify({
        attempt: existing,
        answers: rawAnswers || [],
        resumed: true,
        assessment: {
          id: assessment.id,
          title: assessment.title,
          assessment_type: assessment.assessment_type,
          working_duration_minutes: assessment.working_duration_minutes
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 7. Check Attempt Limits
    if (assessment.max_attempts) {
      const { count } = await supabase
        .from("attempts")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student_id)
        .or(`assessment_id.eq.${assessment_id},exam_id.eq.${assessment_id}`)
        .in("status", ["submitted", "auto_submitted", "evaluated", "SUBMITTED", "AUTO_SUBMITTED", "EVALUATED"]);

      if ((count || 0) >= assessment.max_attempts) {
        return new Response(JSON.stringify({ error: "Maximum attempts reached for this assessment." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 8. Fetch Assessment Questions (from frozen snapshot assessment_questions)
    let { data: snapQuestions } = await supabase
      .from("assessment_questions")
      .select("*")
      .eq("assessment_id", assessment_id)
      .order("display_order");

    // Fallback to legacy questions if snapshot not populated yet
    if (!snapQuestions || snapQuestions.length === 0) {
      const { data: legacyQ } = await supabase
        .from("questions")
        .select("*")
        .eq("assessment_id", assessment_id)
        .is("deleted_at", null);
      if (legacyQ && legacyQ.length > 0) {
        snapQuestions = legacyQ.map((q: any, idx: number) => ({
          question_id: q.id,
          question_text_snapshot: q.question_text,
          accepted_answers_snapshot: q.accepted_answers || [q.correct_answer],
          topic_snapshot: 'General',
          word_type_snapshot: q.word_type || null,
          display_order: idx + 1
        }));
      }
    }

    if (!snapQuestions || snapQuestions.length === 0) {
      return new Response(JSON.stringify({ error: "Assessment has no questions available." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Randomize order if configured
    if (assessment.question_order === 'RANDOM') {
      snapQuestions.sort(() => Math.random() - 0.5);
    }

    // 9. Create New Attempt
    const durationMinutes = assessment.working_duration_minutes || assessment.time_limit_minutes || 60;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const attemptPayload: any = {
      student_id,
      started_at: now.toISOString(),
      status: "in_progress",
      score: 0,
      percentage: 0,
      total_questions: snapQuestions.length
    };

    // Include both column variants for seamless database schema compatibility
    attemptPayload.assessment_id = assessment_id;
    attemptPayload.expires_at = expiresAt.toISOString();
    attemptPayload.expected_end_at = expiresAt.toISOString();

    const { data: newAttempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert(attemptPayload)
      .select()
      .single();

    if (attemptErr) throw attemptErr;

    // 10. Populate attempt_answers
    const answerInserts = snapQuestions.map((sq: any) => ({
      attempt_id: newAttempt.id,
      question_id: sq.question_id || null,
      question_snapshot: {
        question_text: sq.question_text_snapshot,
        word_type: sq.word_type_snapshot,
        topic: sq.topic_snapshot,
        display_order: sq.display_order
      },
      topic_snapshot: sq.topic_snapshot,
      word_type_snapshot: sq.word_type_snapshot,
      accepted_answers_snapshot: sq.accepted_answers_snapshot,
      correct_answer_snapshot: Array.isArray(sq.accepted_answers_snapshot) ? sq.accepted_answers_snapshot.join(';') : String(sq.accepted_answers_snapshot || ''),
      student_answer: null,
      score: 0
    }));

    const { data: insertedAnswers, error: insAnsErr } = await supabase
      .from("attempt_answers")
      .insert(answerInserts)
      .select("id, question_id, question_snapshot, topic_snapshot, word_type_snapshot, student_answer, score");

    if (insAnsErr) throw insAnsErr;

    // Return to client WITHOUT exposing accepted_answers_snapshot
    return new Response(JSON.stringify({
      attempt: newAttempt,
      answers: insertedAnswers || [],
      resumed: false,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        assessment_type: assessment.assessment_type,
        working_duration_minutes: durationMinutes
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("start-exam error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
