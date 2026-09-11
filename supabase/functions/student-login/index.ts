// TOP ENGLISH CLASS — Edge Function: student-login
// Server verifies: program/class relationship, student membership, active status, PIN hash.
// Never stores or returns plaintext PINs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { programId, classId, studentId, pin } = await req.json();

    if (!programId || !classId || !studentId || !pin) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Never log the PIN
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate class belongs to program
    const { data: classData } = await supabase.from("classes")
      .select("id, program_id, is_active")
      .eq("id", classId)
      .eq("program_id", programId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (!classData) {
      return new Response(JSON.stringify({ error: "Invalid program or class selection." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate student belongs to class and is active
    let query = supabase.from("students")
      .select("id, name, pin_hash, is_active, class_id, program_id, gender, batch_id")
      .eq("id", studentId)
      .eq("class_id", classId)
      .eq("program_id", programId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    const { data: student } = await query.single();

    if (!student) {
      return new Response(JSON.stringify({ error: "Student not found or inactive." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify PIN (compare hashes — never plaintext comparison)
    const pinHash = await sha256(pin);
    if (pinHash !== student.pin_hash) {
      // Log failed attempt (without PIN)
      await supabase.from("audit_logs").insert({
        actor_user_id: student.id,
        actor_role: "student",
        action: "login_failed",
        entity_type: "student",
        entity_id: student.id,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(JSON.stringify({ error: "Invalid PIN. Please try again." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Log successful login
    await supabase.from("audit_logs").insert({
      actor_user_id: student.id,
      actor_role: "student",
      action: "login_success",
      entity_type: "student",
      entity_id: student.id,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    const cleanedName = (student.name || "").replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, "").trim();
    const g = (student.gender || "").trim().toLowerCase();
    const formattedName = (g === "female" || g === "f" || g === "perempuan" || g === "p")
      ? `Miss ${cleanedName}`
      : (g === "male" || g === "m" || g === "laki-laki" || g === "l")
      ? `Mr. ${cleanedName}`
      : cleanedName;

    return new Response(JSON.stringify({
      success: true,
      student_id: student.id,
      student_name: formattedName,
      gender: student.gender || null,
      batch_id: student.batch_id,
      student: {
        id: student.id,
        name: formattedName,
        gender: student.gender || null,
        batch_id: student.batch_id,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
