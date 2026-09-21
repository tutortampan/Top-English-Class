// @ts-nocheck
// TOP ENGLISH CLASS — Edge Function: import-questions
// Handles bulk question import: inserts new questions and updates existing ones.
// Processes in parallel chunks for speed, with per-row error isolation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 20; // Questions per parallel chunk

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { questions, AssessmentId, adminUserId } = await req.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions provided for import." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!AssessmentId) {
      return new Response(JSON.stringify({ error: "AssessmentId is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let insertedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Fetch existing questions for this Assessment to determine insert vs update
    const { data: existingRows } = await supabase
      .from("questions")
      .select("id, question_order")
      .eq("Assessment_id", AssessmentId)
      .is("deleted_at", null);

    const existingOrderMap = new Map<number, string>(
      (existingRows || []).map((r: any) => [Number(r.question_order), r.id])
    );

    // Process in parallel chunks
    const chunks = chunkArray(questions, CHUNK_SIZE);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (q: any) => {
        const orderNum = Number(q.order);
        const payload: any = {
          Assessment_id:        AssessmentId,
          question_order: orderNum,
          question_text:  String(q.questionText ?? "").trim(),
          correct_answer: String(q.correctAnswer ?? "").trim(),
          answer_type:    q.answerType ?? "written",
          options_json:   q.optionsJson ?? null,
          metadata:       q.metadata ?? {},
          updated_at:     new Date().toISOString(),
        };

        const existingId = existingOrderMap.get(orderNum);
        if (existingId) {
          // Update existing question at this order position
          const { error } = await supabase
            .from("questions")
            .update(payload)
            .eq("id", existingId);
          if (error) {
            errors.push(`Order ${orderNum}: ${error.message}`);
          } else {
            updatedCount++;
          }
        } else {
          // Insert new question
          const { error } = await supabase
            .from("questions")
            .insert(payload);
          if (error) {
            errors.push(`Order ${orderNum}: ${error.message}`);
          } else {
            insertedCount++;
          }
        }
      }));
    }

    // Audit Log
    if (adminUserId) {
      await supabase.from("audit_logs").insert({
        actor_user_id: adminUserId,
        actor_role:    "admin",
        action:        "import_questions",
        entity_type:   "questions",
        entity_id:     null,
        old_value:     null,
        new_value:     JSON.stringify({ AssessmentId, insertedCount, updatedCount, errors: errors.length }),
        ip_address:    req.headers.get("x-forwarded-for") || "unknown",
        user_agent:    req.headers.get("user-agent") || "unknown",
      });
    }

    const response: any = {
      success: true,
      insertedCount,
      updatedCount,
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} questions.`,
    };
    if (errors.length > 0) {
      response.warnings = errors;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("import-questions error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
