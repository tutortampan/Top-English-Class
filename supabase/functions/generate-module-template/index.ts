import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
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

    const url = new URL(req.url);
    const moduleType = url.searchParams.get("moduleType");
    if (!moduleType) throw new Error("moduleType query parameter is required");

    let csvHeader = "";
    let csvSampleData = "";
    let filename = "";

    switch (moduleType) {
      case "VISUAL_PRONOUNS":
        filename = "template_visual_pronouns.csv";
        csvHeader = "Image_URL,Expected_Pronouns,Expected_Adjectives\n";
        csvSampleData = "https://example.com/img1.jpg,this|that|these|those,big|red\n";
        break;
      case "NARRATIVE_TENSE":
        filename = "template_narrative_tense.csv";
        csvHeader = "Prompt_Text,Target_Tense,Min_Word_Count\n";
        csvSampleData = "Tell a story about a time you lost something important.,Past Simple,50\n";
        break;
      case "MULTIPLE_CHOICE":
        filename = "template_multiple_choice.csv";
        csvHeader = "Question,Option_A,Option_B,Option_C,Option_D,Correct_Option\n";
        csvSampleData = "What is the past tense of 'go'?,went,gone,goes,going,Option_A\n";
        break;
      case "VOCAB_MASTERY":
        filename = "template_vocab_mastery.csv";
        csvHeader = "Word,Definition,Audio_Prompt_URL\n";
        csvSampleData = "Resilience,The capacity to recover quickly from difficulties,https://example.com/audio/resilience.mp3\n";
        break;
      default:
        // Generic template for others
        filename = `template_${moduleType.toLowerCase()}.csv`;
        csvHeader = "Configuration_Key,Configuration_Value\n";
        csvSampleData = "Target_Topic,Describe your weekend\n";
        break;
    }

    const csvContent = csvHeader + csvSampleData;

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, status: 400 }
    );
  }
});
