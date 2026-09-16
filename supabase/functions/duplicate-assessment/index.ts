import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: user, error: userError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Unauthorized");

    // Verify role (must be teacher or admin)
    const { data: userData } = await supabaseClient.from("users").select("role").eq("id", user.user.id).single();
    if (!userData || (userData.role !== "teacher" && userData.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), { status: 403 });
    }

    const { assessmentId, newProgramId, newBatchId, overrideName } = await req.json();
    if (!assessmentId) throw new Error("assessmentId is required");

    // Fetch existing assessment
    const { data: original, error: fetchError } = await supabaseClient
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .single();

    if (fetchError || !original) throw new Error("Assessment not found");

    // Construct new assessment
    const newAssessment = {
      module_id: original.module_id,
      institution_id: original.institution_id,
      program_id: newProgramId || original.program_id,
      batch_id: newBatchId || original.batch_id,
      name: overrideName || `${original.name} (Copy)`,
      auto_name_override: overrideName ? true : original.auto_name_override,
      available_from: original.available_from,
      available_until: original.available_until,
      time_limit_seconds: original.time_limit_seconds,
      payload: original.payload,
      prerequisite_rules: original.prerequisite_rules
    };

    const { data: duplicated, error: insertError } = await supabaseClient
      .from("assessments")
      .insert(newAssessment)
      .select()
      .single();

    if (insertError) throw insertError;

    // Optional: Log duplication in an audit log
    // ...

    return new Response(
      JSON.stringify({ success: true, duplicatedAssessment: duplicated }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, status: 400 }
    );
  }
});
