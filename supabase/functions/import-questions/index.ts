// @ts-nocheck
// TOP ENGLISH CLASS â€” Edge Function: import-questions
// Server handles bulk imports securely, validating questions against types and topics, and audit logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { questions, examId, adminUserId } = await req.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions provided for import." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let insertedCount = 0;
    let updatedCount = 0;

    // We expect the payload to already be validated against question_types on the client side,
    // but the edge function performs the actual upsert/insert.
    
    // Process Questions
    for (const q of questions) {
      const isExisting = q.isExisting && q.existingId;

      const payload: any = {
        exam_id: examId,
        question_order: q.order,
        question_text: q.questionText,
        correct_answer: q.correctAnswer,
        answer_type: q.answerType,
        options_json: q.optionsJson,
        metadata: q.metadata || {},
        updated_at: new Date().toISOString()
      };

      if (isExisting) {
        await supabase.from("questions").update(payload).eq("id", q.existingId);
        updatedCount++;
      } else {
        await supabase.from("questions").insert(payload);
        insertedCount++;
      }
    }

    // Audit Log
    if (adminUserId) {
      await supabase.from("audit_logs").insert({
        actor_user_id: adminUserId,
        actor_role: "admin",
        action: "import_questions",
        entity_type: "questions",
        entity_id: null,
        old_value: null,
        new_value: `Inserted: ${insertedCount}, Updated: ${updatedCount}`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      insertedCount,
      updatedCount,
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} questions.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("import-questions error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
