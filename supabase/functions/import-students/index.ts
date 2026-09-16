// @ts-nocheck
// TOP ENGLISH CLASS â€” Edge Function: import-students
// Server handles bulk imports securely, auto-creates batches, hashes PINs, and audit logs.
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

function formatStudentName(name: string, gender: string | null): string {
  const cleaned = (name || "").replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, "").trim();
  const g = (gender || "").trim().toLowerCase();
  if (g === 'female' || g === 'f' || g === 'perempuan' || g === 'p') return `Miss ${cleaned}`;
  if (g === 'male' || g === 'm' || g === 'laki-laki' || g === 'l') return `Mr. ${cleaned}`;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { students, adminUserId } = await req.json();

    if (!Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "No students provided for import." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let insertedCount = 0;
    let updatedCount = 0;
    let batchMap = new Map(); // programId::batchName -> batch_id

    // 1. Auto-create missing batches
    for (const s of students) {
      if (!s.batchId && s.batchName && s.batchName !== 'â€”' && s.programId) {
        const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
        if (!batchMap.has(key)) {
          // Check if it already exists in DB
          const { data: existingBatch } = await supabase.from("batches")
            .select("id")
            .eq("program_id", s.programId)
            .ilike("name", s.batchName.trim())
            .single();

          if (existingBatch) {
            batchMap.set(key, existingBatch.id);
          } else {
            // Create it
            const { data: newBatch, error: batchErr } = await supabase.from("batches")
              .insert({
                program_id: s.programId,
                name: s.batchName.trim(),
                is_active: true
              }).select("id").single();
            if (!batchErr && newBatch) {
              batchMap.set(key, newBatch.id);
            }
          }
        }
      }
    }

    // 2. Process Students
    for (const s of students) {
      let resolvedBatchId = s.batchId;
      if (!resolvedBatchId && s.batchName && s.batchName !== 'â€”' && s.programId) {
        const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
        resolvedBatchId = batchMap.get(key) || null;
      }

      const formattedName = formatStudentName(s.name, s.gender);
      const isExisting = s.isExisting && s.existingId;
      const targetPin = s.pin || '1234';

      let pinHash = undefined;
      // Only hash if new or if pin is explicitly changed (not exactly '1234' on an existing user where we might want to keep the old one)
      if (!isExisting || targetPin !== '1234') {
        pinHash = await sha256(targetPin);
      }

      if (isExisting) {
        const payload: any = {
          institution_id: s.institutionId,
          program_id: s.programId,
          batch_id: resolvedBatchId || null,
          birth_date: s.birthDate || null,
          gender: s.gender || null,
          name: formattedName,
          is_active: true,
          deleted_at: null,
          updated_at: new Date().toISOString()
        };
        if (pinHash) payload.pin_hash = pinHash;
        
        await supabase.from("students").update(payload).eq("id", s.existingId);
        updatedCount++;
      } else {
        if (!pinHash) pinHash = await sha256('1234');
        const payload = {
          name: formattedName,
          institution_id: s.institutionId,
          program_id: s.programId,
          batch_id: resolvedBatchId || null,
          gender: s.gender || null,
          birth_date: s.birthDate || null,
          pin_hash: pinHash,
          is_active: true
        };
        await supabase.from("students").insert(payload);
        insertedCount++;
      }
    }

    // 3. Audit Log
    if (adminUserId) {
      await supabase.from("audit_logs").insert({
        actor_user_id: adminUserId,
        actor_role: "admin",
        action: "import_students",
        entity_type: "students",
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
      message: `Successfully inserted ${insertedCount} and updated ${updatedCount} students.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("import-students error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
