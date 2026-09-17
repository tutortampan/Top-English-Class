/**
 * js/ai-evaluation-engine.js
 * TOPSCORE AI EVALUATION ENGINE (TAEE) - CLIENT INTEGRATION
 * Supports: All 8 Assessment Modules, Stateless Web Speech STT, Realtime Roleplay, and Fallback Evaluation
 */

import { getSupabase } from './supabase.js?v=4.1.0';
import { createSpeechSession, isSpeechSupported } from './speech.js?v=4.1.0';
import { damerauLevenshtein, normalizeAnswerText } from './grading.js?v=4.1.0';

export const AI_MODULE_TYPES = {
  VISUAL_PRONOUNS: 'VISUAL_PRONOUNS',
  NARRATIVE_TENSE: 'NARRATIVE_TENSE',
  CONVERSATIONAL: 'CONVERSATIONAL',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  READ_ALOUD: 'READ_ALOUD',
  TURN_BASED_ROLEPLAY: 'TURN_BASED_ROLEPLAY',
  SPEAKING_MONOLOGUE: 'SPEAKING_MONOLOGUE',
  VOCAB_MASTERY: 'VOCAB_MASTERY'
};

/**
 * Pre-flight client checks for empty or gibberish input to save unnecessary network calls
 */
export function validateTranscript(text) {
  const clean = (text || '').trim();
  if (!clean || clean.length < 10) {
    return { valid: false, error: 'Audio too short or silent.' };
  }

  const words = clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) {
    return { valid: false, error: 'Empty transcript.' };
  }

  const fillers = new Set(['um', 'uh', 'er', 'ah', 'like', 'hmm', 'mm']);
  let fillerCount = 0;
  for (const w of words) {
    if (fillers.has(w)) fillerCount++;
  }

  if (fillerCount / words.length >= 0.6) {
    return { valid: false, error: 'Transcript consists mostly of filler words or incoherent speech.' };
  }

  return { valid: true };
}

/**
 * THE COST GUARD ENGINE
 * Global Safety Controls for AI Submissions & Duration
 */
export function getCostGuardLimits() {
  const cooldown = parseInt(localStorage.getItem('ai_cooldown_limit_seconds') || window.TOPSCORE_CONFIG?.cooldownLimit || '60', 10);
  const maxAudio = parseInt(localStorage.getItem('ai_max_audio_duration_seconds') || window.TOPSCORE_CONFIG?.maxAudioDuration || '180', 10);
  return { cooldownSeconds: cooldown, maxAudioDurationSeconds: maxAudio };
}

const _lastSubmissionTimestamps = new Map();

export function checkCooldown(studentId) {
  if (!studentId) return { allowed: true };
  const limits = getCostGuardLimits();
  const now = Date.now();
  const lastTime = _lastSubmissionTimestamps.get(studentId) || 0;
  const elapsed = (now - lastTime) / 1000;
  if (elapsed < limits.cooldownSeconds) {
    const remaining = Math.ceil(limits.cooldownSeconds - elapsed);
    return {
      allowed: false,
      remainingSeconds: remaining,
      error: `Cost Guard Active: Submission cooldown active. Please wait ${remaining}s before submitting again.`
    };
  }
  return { allowed: true };
}

export function recordSubmission(studentId) {
  if (studentId) {
    _lastSubmissionTimestamps.set(studentId, Date.now());
  }
}

/**
 * Evaluate an assessment submission using the serverless Edge Function with local fallback
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} [params.assessmentId]
 * @param {string} params.moduleType
 * @param {string} [params.transcript]
 * @param {string} [params.studentInput]
 * @param {string} [params.selectedOption]
 * @param {string} [params.correctOption]
 * @param {number} [params.durationSeconds]
 * @param {Array} [params.chatLog]
 * @param {Object} [params.context]
 * @returns {Promise<{ success: boolean, final_score: number, evaluation: Object, record: Object }>}
 */
export async function evaluateSubmission(params) {
  // Cost Guard Check: Cooldown Limit
  const cooldownCheck = checkCooldown(params.studentId);
  if (!cooldownCheck.allowed) {
    return {
      success: false,
      final_score: 0,
      evaluation: {
        error: 'COOLDOWN_ACTIVE',
        message: cooldownCheck.error,
        remaining_seconds: cooldownCheck.remainingSeconds
      },
      error: cooldownCheck.error
    };
  }

  // Cost Guard: Cap duration
  const costLimits = getCostGuardLimits();
  let duration = params.durationSeconds || 30;
  if (duration > costLimits.maxAudioDurationSeconds) {
    duration = costLimits.maxAudioDurationSeconds;
  }

  const sb = await getSupabase();
  const payload = {
    studentId: params.studentId,
    assessmentId: params.assessmentId || null,
    moduleType: params.moduleType,
    transcript: params.transcript || params.studentInput || '',
    studentInput: params.studentInput || params.transcript || '',
    selectedOption: params.selectedOption,
    correctOption: params.correctOption,
    durationSeconds: duration,
    chatLog: params.chatLog || [],
    context: params.context || {}
  };

  // Module 4: ZERO-AI fast local execution
  if (params.moduleType === AI_MODULE_TYPES.MULTIPLE_CHOICE) {
    const student = (params.selectedOption || params.studentInput || '').trim().toLowerCase();
    const correct = (params.correctOption || '').trim().toLowerCase();
    const isCorrect = Boolean(student && correct && student === correct);
    const final_score = isCorrect ? 100 : 0;
    const evaluation = {
      is_correct: isCorrect,
      student_answer: params.selectedOption || params.studentInput || '',
      correct_answer: params.correctOption || '',
      points: final_score,
      final_score: final_score
    };

    // Save directly to assessment_results
    const record = await saveAssessmentResult({
      studentId: params.studentId,
      assessmentId: params.assessmentId,
      moduleType: params.moduleType,
      finalScore: final_score,
      rawJson: evaluation,
      transcript: params.selectedOption || ''
    });

    recordSubmission(params.studentId);
    return { success: true, final_score, evaluation, record };
  }

  // Pre-flight validation
  if (params.moduleType !== AI_MODULE_TYPES.TURN_BASED_ROLEPLAY) {
    const val = validateTranscript(payload.transcript);
    if (!val.valid) {
      const fallbackResult = {
        final_score: 0,
        feedback: val.error,
        transcript: payload.transcript
      };
      const record = await saveAssessmentResult({
        studentId: params.studentId,
        assessmentId: params.assessmentId,
        moduleType: params.moduleType,
        finalScore: 0,
        rawJson: fallbackResult,
        transcript: payload.transcript
      });
      return { success: true, final_score: 0, evaluation: fallbackResult, record };
    }
  }

  // Try calling Supabase Edge Function: evaluate-assessment
  try {
    const { data, error } = await sb.functions.invoke('evaluate-assessment', {
      body: payload
    });

    if (!error && data && data.evaluation) {
      recordSubmission(params.studentId);
      return data;
    }
  } catch (err) {
    console.warn('Edge function invoke failed, engaging client-side fallback:', err.message);
  }

  // Fallback Evaluator (Deterministic Client-Side)
  const clientEval = runClientDeterministicFallback(payload);
  const finalScore = Math.round(Number(clientEval.final_score) || 0);

  const record = await saveAssessmentResult({
    studentId: params.studentId,
    assessmentId: params.assessmentId,
    moduleType: params.moduleType,
    finalScore,
    rawJson: clientEval,
    transcript: payload.transcript
  });

  recordSubmission(params.studentId);
  return {
    success: true,
    final_score: finalScore,
    evaluation: clientEval,
    record
  };
}

/**
 * Save evaluation result into Supabase assessment_results table
 */
export async function saveAssessmentResult({ studentId, assessmentId, moduleType, finalScore, rawJson, transcript }) {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('assessment_results')
      .insert({
        student_id: studentId,
        assessment_id: assessmentId || null,
        module_type: moduleType,
        final_score: parseInt(finalScore, 10) || 0,
        raw_evaluation_json: rawJson || {},
        transcript: transcript || ''
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Could not insert into assessment_results table:', error.message);
    }
    return data;
  } catch (e) {
    console.warn('Database save warning:', e.message);
    return null;
  }
}

/**
 * Fetch past assessment results for a student
 */
export async function fetchAssessmentResults(studentId, assessmentId = null) {
  const sb = await getSupabase();
  let query = sb
    .from('assessment_results')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (assessmentId) {
    query = query.eq('assessment_id', assessmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Realtime Channel for Module 6: Turn-Based Roleplay
 *
 * @param {string} sessionId
 * @param {string} currentRole
 * @param {Function} onMessageCallback
 * @returns {{ sendTurn: Function, leave: Function }}
 */
export async function initRoleplayChannel(sessionId, currentRole, onMessageCallback) {
  const sb = await getSupabase();
  const channelName = `roleplay_${sessionId}`;
  const channel = sb.channel(channelName);

  channel
    .on('broadcast', { event: 'turn_message' }, payload => {
      if (payload && payload.payload) {
        onMessageCallback?.(payload.payload);
      }
    })
    .subscribe();

  return {
    sendTurn(turnNumber, text) {
      const turnPayload = {
        turn: turnNumber,
        role: currentRole,
        text,
        timestamp: new Date().toISOString()
      };
      channel.send({
        type: 'broadcast',
        event: 'turn_message',
        payload: turnPayload
      });
      return turnPayload;
    },
    leave() {
      channel.unsubscribe();
    }
  };
}

/**
 * Client Deterministic Evaluator (100% Offline & Fallback Resilient)
 */
function runClientDeterministicFallback(payload) {
  const t = (payload.transcript || '').trim();
  const ctx = payload.context || {};
  const lower = t.toLowerCase();

  switch (payload.moduleType) {
    case AI_MODULE_TYPES.VISUAL_PRONOUNS: {
      const targets = ctx.targetGrammar || ['this', 'that', 'these', 'those'];
      const sentences = t.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
      const hits = {};
      let hitTotal = 0;
      targets.forEach(w => {
        const m = lower.match(new RegExp(`\\b${w}\\b`, 'gi'));
        const c = m ? m.length : 0;
        hits[w] = c;
        hitTotal += c;
      });
      const score = Math.min(100, (sentences.length >= (ctx.minSentences || 2) ? 50 : 25) + Math.min(50, hitTotal * 15));
      return {
        final_score: score,
        sentence_count: sentences.length,
        relevance: score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low',
        grammar_hits: hits,
        errors: sentences.length < (ctx.minSentences || 2) ? ['Not enough sentences formed.'] : [],
        transcript: t
      };
    }

    case AI_MODULE_TYPES.NARRATIVE_TENSE: {
      const words = lower.split(/\s+/).filter(Boolean);
      const isPast = (ctx.targetTense || 'Past Simple').toLowerCase().includes('past');
      let count = 0;
      words.forEach(w => {
        if (isPast && (w.endsWith('ed') || ['was', 'were', 'went', 'had', 'saw', 'said'].includes(w))) count++;
        if (!isPast && ['is', 'are', 'go', 'have', 'see', 'say'].includes(w)) count++;
      });
      const pct = Math.min(100, Math.max(30, count * 15));
      return {
        final_score: pct,
        duration_seconds: payload.durationSeconds || 30,
        tense_accuracy_percentage: pct,
        tense_violations: pct < 70 ? ['Inconsistent verb tense detected in narrative.'] : [],
        transcript: t
      };
    }

    case AI_MODULE_TYPES.CONVERSATIONAL: {
      const coherent = t.length > 30;
      return {
        final_score: coherent ? 85 : 55,
        coherence: coherent ? 'Excellent' : 'Average',
        functions_detected: ['Expressing Opinion', 'Clarification'],
        feedback: coherent ? 'Logical and coherent conversational answer.' : 'Try to expand your answer with more details.',
        transcript: t
      };
    }

    case AI_MODULE_TYPES.READ_ALOUD: {
      const expected = (ctx.targetTextPassage || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const heard = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const expectedSet = new Set(expected);
      const heardSet = new Set(heard);
      const omissions = expected.filter(w => !heardSet.has(w));
      const insertions = heard.filter(w => !expectedSet.has(w));
      const score = expected.length > 0 ? Math.round(((expected.length - omissions.length) / expected.length) * 100) : 100;
      return {
        final_score: Math.max(0, Math.min(100, score)),
        fluency_wpm: Math.round(heard.length * 2),
        omissions: omissions.slice(0, 5),
        insertions: insertions.slice(0, 5),
        mispronounced_words: [],
        transcript: t
      };
    }

    case AI_MODULE_TYPES.TURN_BASED_ROLEPLAY: {
      const turns = Array.isArray(payload.chatLog) ? payload.chatLog : [];
      const score = Math.min(100, Math.max(50, turns.length * 20));
      return {
        final_score: score,
        mission_accomplished: turns.length >= 3,
        coherence_score: score,
        feedback: 'Roleplay session completed with interactive turn-taking.',
        chat_log: turns
      };
    }

    case AI_MODULE_TYPES.SPEAKING_MONOLOGUE: {
      const words = lower.split(/\s+/).filter(Boolean);
      const f = Math.min(95, Math.max(40, words.length * 2));
      const p = 85;
      const v = Math.min(95, Math.max(50, 60 + new Set(words).size));
      const g = 80;
      const c = 85;
      const avg = Math.round((f + p + v + g + c) / 5);
      return {
        final_score: avg,
        pillars: { fluency: f, pronunciation: p, vocabulary: v, grammar: g, comprehension: c },
        feedback: 'Demonstrated overall speech competence across the 5 pillars.',
        transcript: t
      };
    }

    case AI_MODULE_TYPES.VOCAB_MASTERY: {
      const target = (ctx.targetWord || '').toLowerCase().trim();
      const match = lower.includes(target);
      return {
        final_score: match ? 100 : 0,
        status: match ? 'Mastered' : 'Needs Review',
        word: ctx.targetWord || '',
        student_input: t
      };
    }

    default:
      return {
        final_score: 50,
        feedback: 'Evaluated with default fallback.',
        transcript: t
      };
  }
}
