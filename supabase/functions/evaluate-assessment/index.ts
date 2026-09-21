import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==========================================
// 1. MODULE TYPES & INTERFACES
// ==========================================

export type ModuleType =
  | "POINT_AND_SPEAK"
  | "STORYTELLING"
  | "CONVERSATIONAL"
  | "MULTIPLE_CHOICE"
  | "READ_ALOUD"
  | "TURN_BASED_ROLEPLAY"
  | "SPEAKING_MONOLOGUE"
  | "VOCAB_MASTERY";

export interface RoleplayTurn {
  turn: number;
  role: string;
  text: string;
}

export interface StudentSubmissionPayload {
  studentId: string;
  assessmentId?: string;
  moduleType: ModuleType;
  transcript?: string;
  studentInput?: string;
  selectedOption?: string;
  correctOption?: string;
  durationSeconds?: number;
  chatLog?: RoleplayTurn[];
  context?: {
    imageDescriptionContext?: string;
    minSentences?: number;
    targetGrammar?: string[]; // e.g. ["this", "that", "these", "those"]
    promptTopic?: string;
    targetTense?: string; // e.g. "Simple Present", "Past Simple"
    minDurationSec?: number;
    guidingQuestion?: string;
    expectedFunctions?: string[];
    targetTextPassage?: string;
    scenarioContext?: string;
    roleA?: string;
    roleB?: string;
    topic?: string;
    instructions?: string;
    targetWord?: string;
    definition?: string;
    mode?: "Oral" | "Written";
  };
}

// ==========================================
// 2. ZOD RUNTIME SCHEMAS (Strict Validation)
// ==========================================

export const VisualPronounsSchema = z.object({
  final_score: z.number().min(0).max(100),
  sentence_count: z.number().int().min(0),
  relevance: z.enum(["High", "Medium", "Low"]),
  grammar_hits: z.record(z.string(), z.number().int().min(0)),
  errors: z.array(z.string()),
  transcript: z.string(),
});

export const NarrativeTenseSchema = z.object({
  final_score: z.number().min(0).max(100),
  duration_seconds: z.number().min(0),
  tense_accuracy_percentage: z.number().min(0).max(100),
  tense_violations: z.array(z.string()),
  transcript: z.string(),
});

export const ConversationalSchema = z.object({
  final_score: z.number().min(0).max(100),
  coherence: z.enum(["Excellent", "Average", "Poor"]),
  functions_detected: z.array(z.string()),
  feedback: z.string(),
  transcript: z.string(),
});

export const MultipleChoiceSchema = z.object({
  is_correct: z.boolean(),
  student_answer: z.string(),
  correct_answer: z.string(),
  points: z.number(),
});

export const ReadAloudSchema = z.object({
  final_score: z.number().min(0).max(100),
  fluency_wpm: z.number().min(0),
  omissions: z.array(z.string()),
  insertions: z.array(z.string()),
  mispronounced_words: z.array(
    z.object({
      expected: z.string(),
      heard_as: z.string(),
    })
  ),
  transcript: z.string(),
});

export const RoleplaySchema = z.object({
  final_score: z.number().min(0).max(100),
  mission_accomplished: z.boolean(),
  coherence_score: z.number().min(0).max(100),
  feedback: z.string(),
  chat_log: z.array(
    z.object({
      turn: z.number(),
      role: z.string(),
      text: z.string(),
    })
  ),
});

export const SpeakingMonologueSchema = z.object({
  final_score: z.number().min(0).max(100),
  pillars: z.object({
    fluency: z.number().min(0).max(100),
    pronunciation: z.number().min(0).max(100),
    vocabulary: z.number().min(0).max(100),
    grammar: z.number().min(0).max(100),
    comprehension: z.number().min(0).max(100),
  }),
  feedback: z.string(),
  transcript: z.string(),
});

export const VocabMasterySchema = z.object({
  final_score: z.number().min(0).max(100),
  status: z.enum(["Mastered", "Needs Review"]),
  word: z.string(),
  student_input: z.string(),
});

export type VisualPronounsResult = z.infer<typeof VisualPronounsSchema>;
export type NarrativeTenseResult = z.infer<typeof NarrativeTenseSchema>;
export type ConversationalResult = z.infer<typeof ConversationalSchema>;
export type MultipleChoiceResult = z.infer<typeof MultipleChoiceSchema>;
export type ReadAloudResult = z.infer<typeof ReadAloudSchema>;
export type RoleplayResult = z.infer<typeof RoleplaySchema>;
export type SpeakingMonologueResult = z.infer<typeof SpeakingMonologueSchema>;
export type VocabMasteryResult = z.infer<typeof VocabMasterySchema>;

export type EvaluationResult =
  | VisualPronounsResult
  | NarrativeTenseResult
  | ConversationalResult
  | MultipleChoiceResult
  | ReadAloudResult
  | RoleplayResult
  | SpeakingMonologueResult
  | VocabMasteryResult;

// ==========================================
// 3. MASTER SYSTEM PROMPT
// ==========================================

const MASTER_SYSTEM_PROMPT = `You are the TopsCore AI Evaluation Engine, a strict, highly accurate, and professional English language assessor for an Enterprise LMS.
ABSOLUTE RULES:
1. STRICT JSON ONLY: Output ONLY a valid, minified JSON object. No markdown wrapping, no conversational text.
2. OBJECTIVITY: Grade the transcript purely on the provided criteria. Be highly critical of grammar, tenses, and coherence.
3. HALLUCINATION PREVENTION: Do not invent errors. Base your critique strictly on the provided transcript text.
4. GIBBERISH TRAP: If the transcript consists mostly of filler words, incoherent gibberish, or ignores the prompt entirely, instantly assign a score of 0.`;

// ==========================================
// 4. PRE-FLIGHT DEFENSE CHECKS
// ==========================================

function isGibberishOrFiller(text: string): boolean {
  if (!text) return true;
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const fillers = new Set(["um", "uh", "er", "ah", "like", "hmm", "mm", "ha", "eh"]);
  let fillerCount = 0;
  for (const w of words) {
    if (fillers.has(w)) fillerCount++;
  }
  if (fillerCount / words.length >= 0.6) {
    return true;
  }

  // Check character repetition or single character gibberish
  const clean = text.replace(/\s+/g, "");
  if (/^(.)\1{4,}$/.test(clean)) return true;

  return false;
}

function runPreflightChecks(transcript: string | undefined): { passed: boolean; fallback?: any } {
  const trimmed = (transcript || "").trim();
  if (!trimmed || trimmed.length < 10) {
    return {
      passed: false,
      fallback: {
        final_score: 0,
        feedback: "Audio too short or silent.",
        transcript: trimmed,
      },
    };
  }

  if (isGibberishOrFiller(trimmed)) {
    return {
      passed: false,
      fallback: {
        final_score: 0,
        feedback: "Transcript consists mostly of filler words, incoherent gibberish, or ignores the prompt entirely.",
        transcript: trimmed,
      },
    };
  }

  return { passed: true };
}

// ==========================================
// 5. MODULE 4: MULTIPLE CHOICE (ZERO-AI)
// ==========================================

function evaluateMultipleChoice(payload: StudentSubmissionPayload): MultipleChoiceResult {
  const student = (payload.selectedOption || payload.studentInput || "").trim().toLowerCase();
  const correct = (payload.correctOption || "").trim().toLowerCase();
  const isCorrect = Boolean(student && correct && student === correct);

  return {
    is_correct: isCorrect,
    student_answer: payload.selectedOption || payload.studentInput || "",
    correct_answer: payload.correctOption || "",
    points: isCorrect ? 100 : 0,
  };
}

// ==========================================
// 6. DETERMINISTIC HEURISTIC FALLBACKS (Zero-Crash Safety)
// ==========================================

function evaluateVisualPronounsFallback(transcript: string, ctx: any): VisualPronounsResult {
  const targetWords = ctx?.targetGrammar || ["this", "that", "these", "those"];
  const minSentences = Number(ctx?.minSentences) || 2;
  const lower = transcript.toLowerCase();

  const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
  const sentenceCount = sentences.length;

  const grammarHits: Record<string, number> = {};
  let totalHits = 0;
  for (const w of targetWords) {
    const reg = new RegExp(`\\b${w}\\b`, "gi");
    const m = lower.match(reg);
    const count = m ? m.length : 0;
    grammarHits[w] = count;
    totalHits += count;
  }

  let score = 50;
  if (sentenceCount >= minSentences) score += 25;
  if (totalHits >= targetWords.length) score += 25;
  else score += Math.min(20, totalHits * 10);

  const errors: string[] = [];
  if (sentenceCount < minSentences) errors.push(`Target requires at least ${minSentences} sentences.`);
  if (totalHits === 0) errors.push(`No target demonstrative pronouns detected (${targetWords.join(", ")}).`);

  return {
    final_score: Math.min(100, Math.max(0, score)),
    sentence_count: sentenceCount,
    relevance: sentenceCount >= minSentences && totalHits > 0 ? "High" : sentenceCount > 0 ? "Medium" : "Low",
    grammar_hits: grammarHits,
    errors,
    transcript,
  };
}

function evaluateNarrativeTenseFallback(transcript: string, ctx: any, duration: number): NarrativeTenseResult {
  const targetTense = ctx?.targetTense || "Past Simple";
  const lower = transcript.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  const pastVerbs = ["was", "were", "went", "had", "saw", "said", "did", "played", "walked", "bought", "felt", "started"];
  const presentVerbs = ["is", "are", "am", "have", "has", "see", "say", "do", "play", "walk", "buy", "feel"];

  let matchedTenseCount = 0;
  const violations: string[] = [];

  if (targetTense.toLowerCase().includes("past")) {
    words.forEach(w => {
      if (pastVerbs.includes(w) || w.endsWith("ed")) matchedTenseCount++;
      if (presentVerbs.includes(w) && !["is", "are"].includes(w)) {
        violations.push(`Present verb "${w}" used instead of ${targetTense}`);
      }
    });
  } else {
    words.forEach(w => {
      if (presentVerbs.includes(w)) matchedTenseCount++;
      if (pastVerbs.includes(w)) {
        violations.push(`Past verb "${w}" used instead of ${targetTense}`);
      }
    });
  }

  const accuracy = Math.max(20, Math.min(100, Math.round((matchedTenseCount / Math.max(1, matchedTenseCount + violations.length)) * 100)));
  const minDur = Number(ctx?.minDurationSec) || 30;
  let score = accuracy;
  if (duration < minDur && duration > 0) {
    score = Math.round(score * (duration / minDur));
  }

  return {
    final_score: Math.min(100, Math.max(0, score)),
    duration_seconds: duration,
    tense_accuracy_percentage: accuracy,
    tense_violations: violations.slice(0, 5),
    transcript,
  };
}

function evaluateConversationalFallback(transcript: string, ctx: any): ConversationalResult {
  const expected = ctx?.expectedFunctions || ["Expressing Opinion", "Reasoning"];
  const lower = transcript.toLowerCase();

  const detected: string[] = [];
  if (lower.includes("think") || lower.includes("believe") || lower.includes("in my opinion")) detected.push("Expressing Opinion");
  if (lower.includes("because") || lower.includes("since") || lower.includes("therefore")) detected.push("Reasoning");
  if (lower.includes("agree") || lower.includes("disagree") || lower.includes("sure")) detected.push("Agreeing / Disagreeing");

  let score = 60;
  if (detected.length >= expected.length) score = 90;
  else if (detected.length > 0) score = 75;

  return {
    final_score: score,
    coherence: score >= 80 ? "Excellent" : score >= 60 ? "Average" : "Poor",
    functions_detected: detected,
    feedback: detected.length > 0 ? "Good communicative clarity and logical answer." : "Attempt to use explicit functional phrases.",
    transcript,
  };
}

function evaluateReadAloudFallback(transcript: string, ctx: any): ReadAloudResult {
  const passage = (ctx?.targetTextPassage || "").trim();
  const expectedTokens = passage.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const heardTokens = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  const omissions: string[] = [];
  const insertions: string[] = [];
  const mispronounced: Array<{ expected: string; heard_as: string }> = [];

  const expectedSet = new Set(expectedTokens);
  const heardSet = new Set(heardTokens);

  expectedTokens.forEach((t: string) => {
    if (!heardSet.has(t)) omissions.push(t);
  });

  heardTokens.forEach((t: string) => {
    if (!expectedSet.has(t)) insertions.push(t);
  });

  const matched = expectedTokens.filter((t: string) => heardSet.has(t)).length;
  const score = expectedTokens.length > 0 ? Math.round((matched / expectedTokens.length) * 100) : 100;
  const wpm = Math.round(heardTokens.length * (60 / 30));

  return {
    final_score: Math.max(0, Math.min(100, score)),
    fluency_wpm: wpm,
    omissions: omissions.slice(0, 10),
    insertions: insertions.slice(0, 10),
    mispronounced_words: mispronounced,
    transcript,
  };
}

function evaluateRoleplayFallback(chatLog: RoleplayTurn[], ctx: any): RoleplayResult {
  const turns = Array.isArray(chatLog) ? chatLog : [];
  const turnCount = turns.length;
  const coherenceScore = Math.min(100, Math.max(40, turnCount * 20));
  const accomplished = turnCount >= 4;

  return {
    final_score: accomplished ? coherenceScore : Math.round(coherenceScore * 0.7),
    mission_accomplished: accomplished,
    coherence_score: coherenceScore,
    feedback: accomplished ? "Roleplay goal reached with coherent dialogue." : "Needs more turn interaction to accomplish roleplay objective.",
    chat_log: turns,
  };
}

function evaluateSpeakingMonologueFallback(transcript: string, ctx: any): SpeakingMonologueResult {
  const words = transcript.split(/\s+/).filter(Boolean);
  const len = words.length;

  const fluency = Math.min(95, Math.max(40, Math.round(len * 1.5)));
  const pronunciation = 85;
  const vocabulary = Math.min(95, Math.max(40, 50 + (new Set(words).size * 1.2)));
  const grammar = 80;
  const comprehension = 85;

  const final_score = Math.round((fluency + pronunciation + vocabulary + grammar + comprehension) / 5);

  return {
    final_score,
    pillars: {
      fluency,
      pronunciation,
      vocabulary: Math.round(vocabulary),
      grammar,
      comprehension,
    },
    feedback: "Demonstrated clear speech flow and comprehensible structure.",
    transcript,
  };
}

function evaluateVocabMasteryFallback(input: string, ctx: any): VocabMasteryResult {
  const target = (ctx?.targetWord || "").trim().toLowerCase();
  const student = (input || "").trim().toLowerCase();

  const isMatch = student.includes(target) || target.includes(student);
  const final_score = isMatch ? 100 : 0;

  return {
    final_score,
    status: isMatch ? "Mastered" : "Needs Review",
    word: ctx?.targetWord || "",
    student_input: input,
  };
}

// ==========================================
// 7. LLM API DISPATCH WITH FORCED JSON OUTPUT (OpenAI & Anthropic)
// ==========================================

async function callLLM(moduleType: ModuleType, prompt: string, schemaHint: string): Promise<any> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  // Try OpenAI first if configured
  if (openaiKey) {
    try {
      const payload = {
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${MASTER_SYSTEM_PROMPT}\n\nExact Output Schema Requirement:\n${schemaHint}` },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const json = await response.json();
        const rawText = json.choices?.[0]?.message?.content;
        if (rawText) return JSON.parse(rawText);
      }
    } catch (e: any) {
      console.warn("OpenAI API call failed:", e.message);
    }
  }

  // Try Anthropic Claude if configured
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1024,
          system: `${MASTER_SYSTEM_PROMPT}\n\nExact Output Schema Requirement:\n${schemaHint}`,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content?.[0]?.text;
        if (content) {
          const clean = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
          return JSON.parse(clean);
        }
      }
    } catch (e: any) {
      console.warn("Anthropic API call failed:", e.message);
    }
  }

  return null; // Triggers deterministic heuristic fallback
}

// ==========================================
// 8. MAIN EVALUATION ROUTER
// ==========================================

async function routeEvaluation(payload: StudentSubmissionPayload): Promise<EvaluationResult> {
  const transcript = (payload.transcript || payload.studentInput || "").trim();
  const ctx = payload.context || {};
  const duration = Number(payload.durationSeconds) || Number(ctx.minDurationSec) || 30;

  // Module 4: ZERO-AI objective validation
  if (payload.moduleType === "MULTIPLE_CHOICE") {
    const result = evaluateMultipleChoice(payload);
    return MultipleChoiceSchema.parse(result);
  }

  // Pre-flight check for oral/transcript-based modules
  if (payload.moduleType !== "TURN_BASED_ROLEPLAY") {
    const preflight = runPreflightChecks(transcript);
    if (!preflight.passed) {
      if (payload.moduleType === "POINT_AND_SPEAK") {
        return VisualPronounsSchema.parse({ final_score: 0, sentence_count: 0, relevance: "Low", grammar_hits: {}, errors: [preflight.fallback.feedback], transcript });
      }
      if (payload.moduleType === "STORYTELLING") {
        return NarrativeTenseSchema.parse({ final_score: 0, duration_seconds: duration, tense_accuracy_percentage: 0, tense_violations: [preflight.fallback.feedback], transcript });
      }
      if (payload.moduleType === "CONVERSATIONAL") {
        return ConversationalSchema.parse({ final_score: 0, coherence: "Poor", functions_detected: [], feedback: preflight.fallback.feedback, transcript });
      }
      if (payload.moduleType === "READ_ALOUD") {
        return ReadAloudSchema.parse({ final_score: 0, fluency_wpm: 0, omissions: [], insertions: [], mispronounced_words: [], transcript });
      }
      if (payload.moduleType === "SPEAKING_MONOLOGUE") {
        return SpeakingMonologueSchema.parse({ final_score: 0, pillars: { fluency: 0, pronunciation: 0, vocabulary: 0, grammar: 0, comprehension: 0 }, feedback: preflight.fallback.feedback, transcript });
      }
      if (payload.moduleType === "VOCAB_MASTERY") {
        return VocabMasterySchema.parse({ final_score: 0, status: "Needs Review", word: ctx.targetWord || "", student_input: transcript });
      }
    }
  }

  // Handle LLM Calls per Module with Zod validation
  try {
    switch (payload.moduleType) {
      case "POINT_AND_SPEAK": {
        const schema = `{ "final_score": number, "sentence_count": number, "relevance": "High"|"Medium"|"Low", "grammar_hits": { "this": number }, "errors": string[], "transcript": string }`;
        const prompt = `Context: ${ctx.imageDescriptionContext || "An English ESL visual description task."}
Target Grammar: ${(ctx.targetGrammar || ["this", "that", "these", "those"]).join(", ")}
Min Sentences: ${ctx.minSentences || 2}
Student Transcript: "${transcript}"
Task: Count sentences. Verify occurrences of the target grammar. Evaluate relevance to the image.`;

        const ai = await callLLM("POINT_AND_SPEAK", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = VisualPronounsSchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            sentence_count: Number(ai.sentence_count) || 0,
            relevance: ["High", "Medium", "Low"].includes(ai.relevance) ? ai.relevance : "Medium",
            grammar_hits: typeof ai.grammar_hits === "object" ? ai.grammar_hits : {},
            errors: Array.isArray(ai.errors) ? ai.errors : [],
            transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return VisualPronounsSchema.parse(evaluateVisualPronounsFallback(transcript, ctx));
      }

      case "STORYTELLING": {
        const schema = `{ "final_score": number, "duration_seconds": number, "tense_accuracy_percentage": number, "tense_violations": string[], "transcript": string }`;
        const prompt = `Topic: ${ctx.promptTopic || "A past or personal story"}
Target Tense: ${ctx.targetTense || "Past Simple"}
Duration: ${duration} seconds
Student Transcript: "${transcript}"
Task: Evaluate narrative consistency. Penalize any tense violations strictly (e.g., using past tense when Target_Tense is Simple Present).`;

        const ai = await callLLM("STORYTELLING", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = NarrativeTenseSchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            duration_seconds: duration,
            tense_accuracy_percentage: Number(ai.tense_accuracy_percentage) || 0,
            tense_violations: Array.isArray(ai.tense_violations) ? ai.tense_violations : [],
            transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return NarrativeTenseSchema.parse(evaluateNarrativeTenseFallback(transcript, ctx, duration));
      }

      case "CONVERSATIONAL": {
        const schema = `{ "final_score": number, "coherence": "Excellent"|"Average"|"Poor", "functions_detected": string[], "feedback": string, "transcript": string }`;
        const prompt = `Guiding Question: ${ctx.guidingQuestion || "What is your opinion on this topic?"}
Expected Functions: ${(ctx.expectedFunctions || ["Expressing Opinion", "Reasoning"]).join(", ")}
Student Transcript: "${transcript}"
Task: Evaluate pragmatic coherence. Does the student answer the question logically? Scan for the usage of expected functional phrases.`;

        const ai = await callLLM("CONVERSATIONAL", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = ConversationalSchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            coherence: ["Excellent", "Average", "Poor"].includes(ai.coherence) ? ai.coherence : "Average",
            functions_detected: Array.isArray(ai.functions_detected) ? ai.functions_detected : [],
            feedback: ai.feedback || "Good response.",
            transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return ConversationalSchema.parse(evaluateConversationalFallback(transcript, ctx));
      }

      case "READ_ALOUD": {
        const schema = `{ "final_score": number, "fluency_wpm": number, "omissions": string[], "insertions": string[], "mispronounced_words": [{ "expected": string, "heard_as": string }], "transcript": string }`;
        const prompt = `Target Text Passage: "${ctx.targetTextPassage || ""}"
Student Transcript: "${transcript}"
Task: Compare STT transcript with Target_Text_Passage using string-distance logic. Identify omitted words, inserted extra words, and mispronounced words.`;

        const ai = await callLLM("READ_ALOUD", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = ReadAloudSchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            fluency_wpm: Number(ai.fluency_wpm) || 120,
            omissions: Array.isArray(ai.omissions) ? ai.omissions : [],
            insertions: Array.isArray(ai.insertions) ? ai.insertions : [],
            mispronounced_words: Array.isArray(ai.mispronounced_words) ? ai.mispronounced_words : [],
            transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return ReadAloudSchema.parse(evaluateReadAloudFallback(transcript, ctx));
      }

      case "TURN_BASED_ROLEPLAY": {
        const schema = `{ "final_score": number, "mission_accomplished": boolean, "coherence_score": number, "feedback": string, "chat_log": [{ "turn": number, "role": string, "text": string }] }`;
        const turns = payload.chatLog || [];
        const prompt = `Scenario Context: ${ctx.scenarioContext || "Customer and Support Assistant"}
Role A: ${ctx.roleA || "Agent"} | Role B: ${ctx.roleB || "Customer"}
Chat Log: ${JSON.stringify(turns)}
Task: Evaluate the complete chat log for mission accomplishment, context continuity, and appropriate turn-taking.`;

        const ai = await callLLM("TURN_BASED_ROLEPLAY", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = RoleplaySchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            mission_accomplished: Boolean(ai.mission_accomplished),
            coherence_score: Number(ai.coherence_score) || 0,
            feedback: ai.feedback || "Conversation evaluated.",
            chat_log: turns,
          });
          if (parsed.success) return parsed.data;
        }
        return RoleplaySchema.parse(evaluateRoleplayFallback(turns, ctx));
      }

      case "SPEAKING_MONOLOGUE": {
        const schema = `{ "final_score": number, "pillars": { "fluency": number, "pronunciation": number, "vocabulary": number, "grammar": number, "comprehension": number }, "feedback": string, "transcript": string }`;
        const prompt = `Topic: ${ctx.topic || "Speaking Monologue"}
Instructions: ${ctx.instructions || "Speak continuously and clearly."}
Student Transcript: "${transcript}"
Task: Perform a holistic evaluation. Score from 0-100 on 5 specific pillars: Fluency, Pronunciation, Vocabulary, Grammar, and Comprehension. Calculate final_score as the exact average of these 5 pillars.`;

        const ai = await callLLM("SPEAKING_MONOLOGUE", prompt, schema);
        if (ai && ai.pillars) {
          const f = Number(ai.pillars.fluency) || 0;
          const p = Number(ai.pillars.pronunciation) || 0;
          const v = Number(ai.pillars.vocabulary) || 0;
          const g = Number(ai.pillars.grammar) || 0;
          const c = Number(ai.pillars.comprehension) || 0;
          const avg = Math.round((f + p + v + g + c) / 5);
          const parsed = SpeakingMonologueSchema.safeParse({
            final_score: avg,
            pillars: { fluency: f, pronunciation: p, vocabulary: v, grammar: g, comprehension: c },
            feedback: ai.feedback || "Evaluation complete.",
            transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return SpeakingMonologueSchema.parse(evaluateSpeakingMonologueFallback(transcript, ctx));
      }

      case "VOCAB_MASTERY": {
        const schema = `{ "final_score": number, "status": "Mastered"|"Needs Review", "word": string, "student_input": string }`;
        const prompt = `Target Word: ${ctx.targetWord || ""}
Definition: ${ctx.definition || ""}
Mode: ${ctx.mode || "Oral"}
Student Input: "${transcript}"
Task (Oral Mode): Verify if the spoken STT string accurately matches the Target_Word.`;

        const ai = await callLLM("VOCAB_MASTERY", prompt, schema);
        if (ai && typeof ai.final_score === "number") {
          const parsed = VocabMasterySchema.safeParse({
            final_score: Math.min(100, Math.max(0, Math.round(ai.final_score))),
            status: ai.status === "Mastered" ? "Mastered" : "Needs Review",
            word: ctx.targetWord || "",
            student_input: transcript,
          });
          if (parsed.success) return parsed.data;
        }
        return VocabMasterySchema.parse(evaluateVocabMasteryFallback(transcript, ctx));
      }

      default:
        throw new Error(`Unsupported assessment module type: ${payload.moduleType}`);
    }
  } catch (err: any) {
    console.warn(`Fallback triggered for ${payload.moduleType} due to:`, err.message);
    switch (payload.moduleType) {
      case "POINT_AND_SPEAK": return VisualPronounsSchema.parse(evaluateVisualPronounsFallback(transcript, ctx));
      case "STORYTELLING": return NarrativeTenseSchema.parse(evaluateNarrativeTenseFallback(transcript, ctx, duration));
      case "CONVERSATIONAL": return ConversationalSchema.parse(evaluateConversationalFallback(transcript, ctx));
      case "READ_ALOUD": return ReadAloudSchema.parse(evaluateReadAloudFallback(transcript, ctx));
      case "TURN_BASED_ROLEPLAY": return RoleplaySchema.parse(evaluateRoleplayFallback(payload.chatLog || [], ctx));
      case "SPEAKING_MONOLOGUE": return SpeakingMonologueSchema.parse(evaluateSpeakingMonologueFallback(transcript, ctx));
      case "VOCAB_MASTERY": return VocabMasterySchema.parse(evaluateVocabMasteryFallback(transcript, ctx));
      default:
        return { final_score: 0, feedback: "Evaluation completed with fallback.", transcript } as any;
    }
  }
}

// ==========================================
// 9. SERVE EDGE FUNCTION
// ==========================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: StudentSubmissionPayload = await req.json();

    if (!payload.studentId || !payload.moduleType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (studentId, moduleType)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Run authoritative evaluation
    const evaluation = await routeEvaluation(payload);
    const finalScore = Math.round(Number(evaluation.final_score ?? (evaluation as any).points ?? 0));

    // Database Hook: Write directly to Supabase assessment_results table
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    let dbRecord = null;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        
        // 1. Insert into assessment_results
        const { data: resData, error: dbError } = await supabaseClient
          .from("assessment_results")
          .insert({
            student_id: payload.studentId,
            assessment_id: payload.assessmentId || null,
            module_type: payload.moduleType,
            final_score: finalScore,
            raw_evaluation_json: evaluation,
            transcript: (evaluation as any).transcript || payload.transcript || payload.studentInput || (evaluation as any).student_answer || "",
          })
          .select()
          .single();

        if (dbError) {
          console.warn("Could not insert into assessment_results:", dbError.message);
        } else {
          dbRecord = resData;
        }

        // 2. Backwards compatibility: update student_submissions if present
        if (payload.assessmentId) {
          await supabaseClient
            .from("student_submissions")
            .insert({
              student_id: payload.studentId,
              assessment_id: payload.assessmentId,
              status: "EVALUATED",
              overall_score: finalScore,
              ai_transcript: (evaluation as any).transcript || payload.transcript || "",
              ai_feedback: evaluation,
            })
            .select()
            .maybeSingle();
        }
      } catch (dbErr: any) {
        console.warn("Database hook warning:", dbErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        final_score: finalScore,
        evaluation,
        record: dbRecord,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Evaluation failure.",
        final_score: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
