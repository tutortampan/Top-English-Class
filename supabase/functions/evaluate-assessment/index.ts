import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// TYPESCRIPT INTERFACES
// ==========================================

export type ModuleType = 
  | 'VISUAL_PRONOUNS'     
  | 'NARRATIVE_TENSE'     
  | 'CONVERSATIONAL'      
  | 'MULTIPLE_CHOICE'     
  | 'READ_ALOUD'          
  | 'TURN_BASED_ROLEPLAY' 
  | 'SPEAKING_MONOLOGUE'  
  | 'VOCAB_MASTERY';

export interface StudentSubmissionPayload {
  studentId: string;
  assessmentId: string;
  moduleType: ModuleType;
  audioBase64?: string;
  imageBase64?: string;
  selectedOptionId?: string;
}

export interface AIEvaluationResult {
  overallScore: number;
  transcript?: string;
  grammarFeedback?: string;
  pronunciationFeedback?: string;
  fluencyScore?: number;
  vocabularyScore?: number;
  isPassing: boolean;
  rawAIResponse?: string;
}

// ==========================================
// AI PROMPT TEMPLATES
// ==========================================

const PROMPTS: Record<ModuleType, string> = {
  VISUAL_PRONOUNS: `You are an expert ESL examiner. The student is describing the provided image.
Analyze their transcription: "{{transcript}}"
Target Grammar: Demonstrative pronouns (this, that, these, those) and adjectives.
Respond strictly in JSON format: { "isValidDescription": boolean, "grammarScore": 0-100, "targetGrammarUsed": ["this"], "errors": [""], "overallScore": 0-100 }`,
  
  NARRATIVE_TENSE: `You are an expert ESL examiner. Analyze the student's story for past/narrative tense usage. Transcript: "{{transcript}}"`,
  CONVERSATIONAL: `You are an AI conversation partner. Evaluate the student's reply: "{{transcript}}"`,
  MULTIPLE_CHOICE: `Evaluate the selected option.`,
  READ_ALOUD: `Evaluate the pronunciation of the read aloud text. Transcript: "{{transcript}}"`,
  TURN_BASED_ROLEPLAY: `Evaluate the roleplay turn.`,
  
  SPEAKING_MONOLOGUE: `You are an expert ESL examiner. Evaluate the student's spoken audio transcription against the 5 Pillars of speaking performance.
Student Transcription: "{{transcript}}"
Respond strictly in JSON format: { "fluencyScore": 0-100, "pronunciationScore": 0-100, "vocabularyScore": 0-100, "grammarScore": 0-100, "comprehensionScore": 0-100, "overallScore": 0-100, "grammarCorrections": [""], "constructiveFeedback": "" }`,
  
  VOCAB_MASTERY: `Evaluate the student's vocabulary mastery.`
};

// ==========================================
// EDGE FUNCTION HANDLER
// ==========================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const payload: StudentSubmissionPayload = await req.json();

    // 1. Validate Payload
    if (!payload.studentId || !payload.assessmentId || !payload.moduleType) {
      throw new Error("Missing required fields (studentId, assessmentId, moduleType).");
    }

    // 2. Fetch AI Prompt based on module
    const promptTemplate = PROMPTS[payload.moduleType];
    if (!promptTemplate) {
      throw new Error(`Unsupported module type: ${payload.moduleType}`);
    }

    // 3. (Mock) Call AI Provider (e.g. Gemini)
    // Here we would typically send audioBase64 or imageBase64 to the AI API.
    // For scaffolding, we simulate the evaluation.
    
    console.log(`Evaluating module: ${payload.moduleType} for student: ${payload.studentId}`);
    
    // Simulate AI response delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    let aiResult: AIEvaluationResult = {
      overallScore: 85,
      transcript: "This is a simulated transcript from the AI.",
      isPassing: true,
      rawAIResponse: "{}"
    };

    if (payload.moduleType === 'SPEAKING_MONOLOGUE') {
      aiResult = {
        ...aiResult,
        fluencyScore: 80,
        vocabularyScore: 90,
        grammarFeedback: "Good use of articles."
      };
    }

    // 4. Save to student_submissions
    const { data: submission, error: dbError } = await supabaseClient
      .from('student_submissions')
      .insert({
        student_id: payload.studentId,
        assessment_id: payload.assessmentId,
        status: 'EVALUATED',
        overall_score: aiResult.overallScore,
        ai_transcript: aiResult.transcript,
        ai_feedback: aiResult
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 5. Return JSON to Client
    return new Response(JSON.stringify({ success: true, submission }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
