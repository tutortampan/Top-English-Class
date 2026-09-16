// TOPS CORE — API Module
// All server calls are centralized here.
import { getSupabase, SUPABASE_URL, callEdgeFunction } from './supabase.js';
import { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens } from './grading.js';

export { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens };

// ============================================================
// AUTH / LOGIN
// ============================================================

// Mock data for development / offline / demo environment
const MOCK_INSTITUTIONS = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'General English Program' },
  { id: '11111111-1111-1111-1111-222222222222', name: 'Academic English Program' }
];

const MOCK_PROGRAMS = [
  { id: '22222222-2222-2222-2222-222222222222', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Class A' },
  { id: '22222222-2222-2222-2222-333333333333', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Class B' }
];

/**
 * Clean student name by stripping pre-existing honorific titles.
 */
export function cleanStudentName(name) {
  if (!name) return '';
  let cleaned = String(name).trim().replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, '').trim();
  
  // Apply Proper Capitalization (Title Case)
  cleaned = cleaned.toLowerCase().split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
  
  return cleaned;
}

/**
 * Format student name with honorific title: Miss for female, Mr. for male.
 * Strips pre-existing titles to avoid duplication.
 */
export function formatStudentName(name, gender) {
  const clean = cleanStudentName(name);
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'f' || g === 'perempuan' || g === 'p') return `Miss ${clean}`;
  if (g === 'male' || g === 'm' || g === 'laki-laki' || g === 'l') return `Mr. ${clean}`;
  return clean;
}

/**
 * Convert numeric level to letter (1 -> A, 2 -> B, ..., 26 -> Z, 27 -> AA, etc.)
 */
export function toLevelLetter(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n < 1) return num ? String(num) : 'A';
  let result = '';
  let curr = n;
  while (curr > 0) {
    let remainder = (curr - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    curr = Math.floor((curr - 1) / 26);
  }
  return result;
}

const MOCK_BATCHES = [
  { id: 'bbbbbbbb-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-A' },
  { id: 'bbbbbbbb-1111-1111-1111-111111111112', program_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-B' },
  { id: 'bbbbbbbb-2222-2222-2222-111111111111', program_id: '22222222-2222-2222-2222-333333333333', name: 'Batch 2026-A' }
];

const MOCK_STUDENTS = [
  { id: '55555555-5555-5555-5555-555555555555', institution_id: '11111111-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'John Doe', gender: 'male', is_active: true, pin_hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4' }, // PIN: 1234
  { id: '55555555-5555-5555-5555-666666666666', institution_id: '11111111-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'Jane Smith', gender: 'female', is_active: true, pin_hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4' }
];


async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isPlaceholderUrl() {
  return !SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT');
}

// Lightweight in-memory TTL cache to streamline data fetching and eliminate redundant roundtrips
const _apiCache = new Map();
const DEFAULT_CACHE_TTL = 60 * 1000; // 60 seconds

export function clearApiCache(prefix = null) {
  if (!prefix) {
    _apiCache.clear();
  } else {
    for (const key of _apiCache.keys()) {
      if (key.startsWith(prefix)) _apiCache.delete(key);
    }
  }
}

async function withCache(key, fetcher, ttl = DEFAULT_CACHE_TTL) {
  const cached = _apiCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.timestamp < ttl)) {
    return Array.isArray(cached.data) ? [...cached.data] : { ...cached.data };
  }
  const data = await fetcher();
  _apiCache.set(key, { data, timestamp: now });
  return Array.isArray(data) ? [...data] : { ...data };
}

export async function testSupabaseConnection() {
  if (isPlaceholderUrl()) return { connected: false, error: 'Placeholder URL' };
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('institutions').select('id').limit(1);
    return { connected: !error, error };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

/** Fetch all active institutions for login step 1 (alphabetical order) */
export async function fetchInstitutions(forceRefresh = false) {
  if (forceRefresh) clearApiCache('institutions');
  return withCache('institutions', async () => {
    let list = MOCK_INSTITUTIONS;
    if (!isPlaceholderUrl()) {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.from('institutions')
          .select('id, name')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name');
        if (error) throw error;
        if (data && data.length) list = data;
      } catch (e) {
        console.warn('Supabase fetch failed, falling back to mock data:', e.message);
      }
    }
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });
}

/** Fetch all active programs for an institution (alphabetical order) */
export async function fetchPrograms(institutionId, forceRefresh = false) {
  const cacheKey = `programs_${institutionId}`;
  if (forceRefresh) clearApiCache(cacheKey);
  return withCache(cacheKey, async () => {
    let list = MOCK_PROGRAMS.filter(c => c.institution_id === institutionId);
    if (!isPlaceholderUrl()) {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.from('programs')
          .select('id, name, institution_id')
          .eq('institution_id', institutionId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name');
        if (error) throw error;
        if (data && data.length) {
          list = data;
        }
      } catch (e) {
        console.warn('Supabase fetch programs failed, falling back to mock data:', e.message);
      }
    }
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });
}

/** Fetch all active batches for a class (alphabetical order) */
export async function fetchBatches(programId, forceRefresh = false) {
  const cacheKey = `batches_${programId}`;
  if (forceRefresh) clearApiCache(cacheKey);
  return withCache(cacheKey, async () => {
    let list = MOCK_BATCHES.filter(b => b.program_id === programId);
    if (!isPlaceholderUrl()) {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.from('batches')
          .select('id, name, program_id')
          .eq('program_id', programId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name');
        if (error) throw error;
        if (data && data.length) list = data;
      } catch (e) {
        console.warn('Supabase fetch batches failed, falling back to mock data:', e.message);
      }
    }
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });
}

/** Fetch students by class and optional batch — formatted with Miss/Mr. titles in alphabetical order */
export async function fetchStudentsByProgram(programId, batchId = null) {
  let list = MOCK_STUDENTS.filter(s => s.program_id === programId && (!batchId || s.batch_id === batchId));
  if (!isPlaceholderUrl()) {
    try {
      const sb = await getSupabase();
      let query = sb.from('students')
        .select('id, name, gender, program_id, batch_id')
        .eq('program_id', programId)
        .eq('is_active', true)
        .is('deleted_at', null);
      if (batchId) {
        query = query.eq('batch_id', batchId);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      if (data && data.length) list = data;
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to mock data:', e.message);
    }
  }
  return list.map(s => ({
    ...s,
    name: formatStudentName(s.name, s.gender)
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/** Verify student PIN — calls Edge Function, falls back to direct DB check if not deployed */
export async function verifyStudentLogin({ institutionId, programId, batchId, studentId, pin }) {
  if (isPlaceholderUrl()) {
    const student = MOCK_STUDENTS.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');
    const pinHash = await sha256(pin);
    if (student.pin_hash !== pinHash) throw new Error('Invalid PIN. Please try again.');
    return {
      success: true,
      student: {
        id: student.id,
        name: formatStudentName(student.name, student.gender),
        gender: student.gender,
        batch_id: student.batch_id
      }
    };
  }

  // Try Edge Function first (server-authoritative path)
  try {
    const edgeRes = await callEdgeFunction('student-login', { institutionId, programId, batchId, studentId, pin });
    if (edgeRes) {
      const studentObj = edgeRes.student || {
        id: edgeRes.student_id,
        name: edgeRes.student_name,
        gender: edgeRes.gender || null,
        batch_id: edgeRes.batch_id || null
      };
      studentObj.name = formatStudentName(studentObj.name, studentObj.gender);
      edgeRes.student = studentObj;
      return edgeRes;
    }
  } catch (edgeFnError) {
    // Edge Function not deployed yet — fall back to direct DB verification
    console.warn('Edge Function student-login unavailable, using direct DB fallback:', edgeFnError.message);
  }

  // Direct DB fallback: verify student exists, is active, and PIN matches
  try {
    const sb = await getSupabase();
    const { data: student, error } = await sb
      .from('students')
      .select('id, name, gender, pin_hash, is_active, program_id, institution_id, batch_id')
      .eq('id', studentId)
      .single();

    if (error || !student) throw new Error('Student not found.');
    if (!student.is_active) throw new Error('This student account is inactive.');
    if (student.program_id !== programId) throw new Error('Student does not belong to the selected class.');
    if (student.institution_id !== institutionId) throw new Error('Student does not belong to the selected program.');
    if (batchId && student.batch_id && student.batch_id !== batchId) {
      throw new Error('Student does not belong to the selected batch.');
    }

    const pinHash = await sha256(pin);
    if (student.pin_hash !== pinHash) throw new Error('Invalid PIN. Please try again.');

    return {
      success: true,
      student: {
        id: student.id,
        name: formatStudentName(student.name, student.gender),
        gender: student.gender,
        batch_id: student.batch_id
      }
    };
  } catch (dbError) {
    throw dbError;
  }
}

/** Change student PIN */
export async function updateStudentPin(studentId, oldPin, newPin) {
  if (!newPin || newPin.length < 4) throw new Error('PIN baru minimal harus 4 digit.');

  const sb = await getSupabase();
  const { data: student, error } = await sb
    .from('students')
    .select('pin_hash')
    .eq('id', studentId)
    .single();

  if (error || !student) throw new Error('Student data not found.');

  const oldPinHash = await sha256(oldPin);
  if (student.pin_hash && student.pin_hash !== oldPinHash) {
    throw new Error('The old PIN you entered is incorrect.');
  }

  const newPinHash = await sha256(newPin);
  const { error: updateErr } = await sb
    .from('students')
    .update({ pin_hash: newPinHash, updated_at: new Date().toISOString() })
    .eq('id', studentId);

  if (updateErr) throw updateErr;
  return { success: true };
}

/** Update Student Gender (and synchronize honorific title) */
export async function updateStudentGender(studentId, gender) {
  const g = (gender || '').toLowerCase().trim();
  if (g !== 'male' && g !== 'female') {
    throw new Error('Invalid gender selection. Choose Male or Female.');
  }

  if (isPlaceholderUrl()) {
    const student = MOCK_STUDENTS.find(s => s.id === studentId);
    if (student) {
      student.gender = g;
      student.name = formatStudentName(student.name, g);
      return { success: true, gender: g, formattedName: student.name };
    }
    return { success: true, gender: g, formattedName: formatStudentName('Student', g) };
  }

  const sb = await getSupabase();
  const { data: st, error: fetchErr } = await sb
    .from('students')
    .select('name')
    .eq('id', studentId)
    .single();

  if (fetchErr) throw fetchErr;

  const rawClean = cleanStudentName(st?.name);
  const formattedName = formatStudentName(rawClean, g);

  const { error } = await sb
    .from('students')
    .update({
      gender: g,
      name: formattedName,
      updated_at: new Date().toISOString()
    })
    .eq('id', studentId);

  if (error) throw error;
  return { success: true, gender: g, formattedName };
}

/** Update Student Birthday */
export async function updateStudentBirthday(studentId, birthDate) {
  if (!birthDate) throw new Error('Birth date is required');
  if (isPlaceholderUrl()) return { success: true };

  const sb = await getSupabase();
  const { error } = await sb
    .from('students')
    .update({ 
      birth_date: birthDate,
      updated_at: new Date().toISOString() 
    })
    .eq('id', studentId);
  
  if (error) throw error;
  return { success: true };
}

/** Upload/Update Student Photo (photo_url & photo_status) */
export async function uploadStudentPhoto(studentId, photoBase64OrUrl) {
  const sb = await getSupabase();
  const { error } = await sb
    .from('students')
    .update({ 
      photo_url: photoBase64OrUrl, 
      photo_status: 'set',
      updated_at: new Date().toISOString() 
    })
    .eq('id', studentId);

  if (error) throw error;
  return { success: true };
}



// ============================================================
// STUDENT DASHBOARD
// ============================================================

/** Fetch subjects accessible by the student (directly by institution_id or class) */
export async function fetchStudentClasses(programId, institutionId) {
  const sb = await getSupabase();
  // 1. Check for global subjects first or fallback
  try {
    const { data: globalSubjs, error: gErr } = await sb.from('classes')
      .select('id, name, code, description')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    if (!gErr && globalSubjs && globalSubjs.length > 0) return globalSubjs;
  } catch (e) {
    console.warn('Global subjects query note:', e.message);
  }

  // 2. Direct program lookup (legacy)
  if (institutionId) {
    const { data, error } = await sb.from('classes')
      .select('id, name')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    if (!error && data && data.length > 0) return data;
  }
  // 3. Class lookup to resolve institution_id (legacy)
  if (programId) {
    const { data: cls } = await sb.from('programs')
      .select('institution_id')
      .eq('id', programId)
      .single();
    if (cls?.institution_id) {
      const { data, error } = await sb.from('classes')
        .select('id, name')
        .eq('institution_id', cls.institution_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (!error && data && data.length > 0) return data;
    }
  }
  return [];
}

/** Fetch levels for a subject */
export async function fetchLevels(subjectId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('levels')
    .select('id, name, level_number')
    .eq('class_id', subjectId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('level_number');
  if (error) throw error;
  return data;
}

/** Fetch student progress */
export async function fetchStudentProgress(studentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('progress')
    .select('*')
    .eq('student_id', studentId);
  if (error) throw error;
  return data;
}

/** Fetch published exams available for a specific level */
export async function fetchExamsForStudentLevel(programId, levelId, institutionId) {
  const sb = await getSupabase();
  let query = sb.from('exams')
    .select('*')
    
    .eq('exam_status', 'published')
    .is('deleted_at', null)
    .order('exam_title');

  if (institutionId) {
    query = query.eq('institution_id', institutionId);
  }

  let examsList = [];
  try {
    const { data, error } = await query;
    if (!error && data) examsList = data;
  } catch {
    // fallback
  }

  if (!examsList.length) {
    try {
      const { data: directExams } = await sb.from('exams')
        .select('*')
        
        .eq('exam_status', 'published')
        .is('deleted_at', null)
        .order('exam_title');
      examsList = directExams || [];
    } catch {
      examsList = [];
    }
  }

  // Hydrate prerequisite_exam_id & exam_order if missing
  if (examsList.length > 0) {
    try {
      const { data: logs } = await sb.from('audit_logs')
        .select('entity_id, new_value, created_at')
        .eq('entity_type', 'exam')
        .eq('action', 'exam_metadata');
      if (logs && logs.length > 0) {
        examsList.forEach(ex => {
          const m = logs.filter(l => l.entity_id === ex.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (m.length > 0 && m[0].new_value) {
            if (!ex.prerequisite_exam_id && m[0].new_value.prerequisite_exam_id) {
              ex.prerequisite_exam_id = m[0].new_value.prerequisite_exam_id;
            }
            if (!ex.exam_order && m[0].new_value.exam_order) {
              ex.exam_order = m[0].new_value.exam_order;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Student exam metadata hydration warning:', e.message);
    }
  }
  return examsList;
}

/** Fetch published exams available for a specific subject (when no levels are defined or level is optional) */
export async function fetchExamsForStudentClass(programId, subjectId, institutionId) {
  const sb = await getSupabase();
  let query = sb.from('exams')
    .select('*')
    .eq('class_id', subjectId)
    .eq('exam_status', 'published')
    .is('deleted_at', null)
    .order('exam_title');

  if (institutionId) {
    query = query.eq('institution_id', institutionId);
  }

  let examsList = [];
  try {
    const { data, error } = await query;
    if (!error && data) examsList = data;
  } catch {
    // fallback
  }

  if (!examsList.length) {
    try {
      const { data: directExams } = await sb.from('exams')
        .select('*')
        .eq('class_id', subjectId)
        .eq('exam_status', 'published')
        .is('deleted_at', null)
        .order('exam_title');
      examsList = directExams || [];
    } catch {
      examsList = [];
    }
  }

  // Hydrate prerequisite_exam_id & exam_order if missing
  if (examsList.length > 0) {
    try {
      const { data: logs } = await sb.from('audit_logs')
        .select('entity_id, new_value, created_at')
        .eq('entity_type', 'exam')
        .eq('action', 'exam_metadata');
      if (logs && logs.length > 0) {
        examsList.forEach(ex => {
          const m = logs.filter(l => l.entity_id === ex.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (m.length > 0 && m[0].new_value) {
            if (!ex.prerequisite_exam_id && m[0].new_value.prerequisite_exam_id) {
              ex.prerequisite_exam_id = m[0].new_value.prerequisite_exam_id;
            }
            if (!ex.exam_order && m[0].new_value.exam_order) {
              ex.exam_order = m[0].new_value.exam_order;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Student exam metadata hydration warning:', e.message);
    }
  }
  return examsList;
}


/** Fetch all submitted attempts for a student across all exams */
export async function fetchAllStudentAttempts(studentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('attempts')
    .select('id, exam_id, score, percentage, grade, submitted_at, exams(exam_title, exam_type, classes(name))')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Fetch student's attempts for an exam (to show best score / attempt count) */
export async function fetchStudentAttemptsForExam(studentId, examId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('attempts')
    .select('id, status, score, percentage, grade, submitted_at')
    .eq('student_id', studentId)
    .eq('exam_id', examId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('percentage', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// EXAM EXECUTION
// ============================================================

/** Start or resume an exam — calls Edge Function with direct DB fallback */
export async function startExam(studentId, examId) {
  try {
    return await callEdgeFunction('start-exam', { student_id: studentId, exam_id: examId });
  } catch (edgeErr) {
    console.warn('Edge Function start-exam failed/unavailable, using client DB fallback:', edgeErr.message);
  }

  const sb = await getSupabase();

  // 1. Fetch assessment / exam details (try assessments table first, fallback to exams)
  let exam = null;
  const { data: asmData, error: asmErr } = await sb.from('challenge_definitions').select('*').eq('id', examId).single();
  if (!asmErr && asmData) {
    exam = {
      ...asmData,
      exam_title: asmData.title || asmData.exam_title,
      time_limit_minutes: asmData.working_duration_minutes || asmData.time_limit_minutes || 60,
      exam_type: asmData.challenge_definition_type || asmData.exam_type || 'EVALUATION'
    };
  } else {
    const { data: exData, error: exErr } = await sb.from('exams').select('*').eq('id', examId).single();
    if (exErr || !exData) throw new Error('Assessment not found.');
    exam = exData;
  }

  // 2. Check for an existing in-progress attempt
  const { data: existingAttempts } = await sb.from('attempts')
    .select('*')
    .eq('student_id', studentId)
    .or(`challenge_definition_id.eq.${examId},exam_id.eq.${examId}`)
    .in('status', ['in_progress', 'IN_PROGRESS'])
    .order('created_at', { ascending: false });

  let attempt = existingAttempts?.[0];

  if (!attempt) {
    // Create new attempt
    const timeLimit = exam.working_duration_minutes || exam.time_limit_minutes || 60;
    const now = new Date();
    const expectedEnd = new Date(now.getTime() + timeLimit * 60000);

    // Count previous attempts to set attempt_number
    const { count: priorCount } = await sb.from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .or(`challenge_definition_id.eq.${examId},exam_id.eq.${examId}`);

    const attemptNumber = (priorCount || 0) + 1;

    const { data: newAttempt, error: createErr } = await sb.from('attempts')
      .insert({
        student_id: studentId,
        challenge_definition_id: examId,
        exam_id: examId,
        attempt_number: attemptNumber,
        started_at: now.toISOString(),
        expected_end_at: expectedEnd.toISOString(),
        expires_at: expectedEnd.toISOString(),
        status: 'in_progress',
        score: 0,
        percentage: 0,
        grade: 'F',
        is_best_score: false
      })
      .select()
      .single();

    if (createErr) throw createErr;
    attempt = newAttempt;

    // Check for V1 frozen snapshot assessment_questions
    const { data: snapQuestions } = await sb.from('challenge_definition_questions')
      .select('*')
      .eq('challenge_definition_id', examId)
      .order('display_order');

    if (snapQuestions && snapQuestions.length > 0) {
      const answerRows = snapQuestions.map(sq => ({
        attempt_id: attempt.id,
        question_id: sq.question_id,
        question_snapshot: {
          question_text: sq.question_text_snapshot,
          question_type: sq.question_type_snapshot,
          topic: sq.topic_snapshot,
          question_order: sq.display_order,
          section_id: 'default'
        },
        topic_snapshot: sq.topic_snapshot,
        question_type_snapshot: sq.question_type_snapshot,
        accepted_answers_snapshot: sq.accepted_answers_snapshot,
        correct_answer_snapshot: Array.isArray(sq.accepted_answers_snapshot) ? sq.accepted_answers_snapshot.join(' / ') : sq.accepted_answers_snapshot,
        student_answer: null,
        score: 0
      }));
      await sb.from('attempt_answers').insert(answerRows);
    } else {
      // Legacy fallback: first check for direct questions linked to exam_id
      try {
        const { data: directQs } = await sb.from('questions')
          .select('*')
          .eq('exam_id', examId)
          .is('deleted_at', null)
          .order('question_order');

        if (directQs && directQs.length > 0) {
          const answerRows = directQs.map((q, idx) => ({
            attempt_id: attempt.id,
            question_id: q.id,
            question_snapshot: {
              question_text: q.question_text,
              answer_type: q.answer_type || 'written',
              options_json: q.options_json,
              question_order: q.question_order ?? (idx + 1),
              section_id: 'default',
              metadata: q.metadata
            },
            topic_snapshot: 'General',
            question_type_snapshot: q.metadata?.type || q.question_type || null,
            options_snapshot: q.options_json,
            correct_answer_snapshot: q.correct_answer || '',
            accepted_answers_snapshot: q.accepted_answers || (q.correct_answer ? [q.correct_answer] : []),
            student_answer: null,
            score: 0
          }));
          await sb.from('attempt_answers').insert(answerRows);
        } else {
          // Check for sections if exam_sections table exists
          const { data: sections } = await sb.from('exam_sections')
            .select('*, questions(*)')
            .eq('exam_id', examId)
            .is('deleted_at', null)
            .order('section_order');

          if (sections && sections.length > 0) {
            const answerRows = [];
            sections.forEach(sec => {
              const qs = sec.questions || [];
              qs.forEach((q, idx) => {
                answerRows.push({
                  attempt_id: attempt.id,
                  question_id: q.id,
                  question_snapshot: {
                    question_text: q.question_text,
                    answer_type: q.answer_type || 'written',
                    options_json: q.options_json,
                    question_order: q.question_order ?? (idx + 1),
                    section_id: sec.id,
                    metadata: q.metadata
                  },
                  options_snapshot: q.options_json,
                  correct_answer_snapshot: q.correct_answer || '',
                  accepted_answers_snapshot: q.accepted_answers || (q.correct_answer ? [q.correct_answer] : []),
                  student_answer: null,
                  score: 0
                });
              });
            });
            await sb.from('attempt_answers').insert(answerRows);
          }
        }
      } catch (qErr) {
        console.warn('startExam question population fallback notice:', qErr.message);
      }
    }
  }

  // Fetch attempt answers for execution UI
  let { data: answers } = await sb.from('attempt_answers')
    .select('*')
    .eq('attempt_id', attempt.id);

  let sections = null;
  try {
    const { data: secs } = await sb.from('exam_sections').select('*, questions(*)').eq('exam_id', examId).is('deleted_at', null).order('section_order');
    sections = secs;
  } catch (_) {}

  // Ensure deterministic ordering
  if (answers && answers.length > 0) {
    answers.sort((a, b) => {
      const orderA = a.question_snapshot?.question_order;
      const orderB = b.question_snapshot?.question_order;
      if (orderA != null && orderB != null) return orderA - orderB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  // SECURITY: Sanitize answers so secret answer keys are NEVER sent to the student client
  const sanitizedAnswers = (answers || []).map(a => {
    let snap = typeof a.question_snapshot === 'string'
      ? (() => { try { return JSON.parse(a.question_snapshot); } catch(_) { return {}; } })()
      : (a.question_snapshot ? { ...a.question_snapshot } : {});
    
    delete snap.correct_answer;
    delete snap.accepted_answers;

    return {
      id: a.id,
      attempt_id: a.attempt_id,
      question_id: a.question_id,
      question_snapshot: snap,
      options_snapshot: a.options_snapshot,
      student_answer: a.student_answer,
      topic_snapshot: a.topic_snapshot,
      question_type_snapshot: a.question_type_snapshot
    };
  });

  return {
    success: true,
    attempt: attempt,
    exam: exam,
    sections: sections || [],
    answers: sanitizedAnswers,
    resumed: !!existingAttempts?.[0]
  };
}

/** Save a single answer progress (in-progress autosave) */
export async function saveAnswer(attemptAnswerId, studentAnswer) {
  const sb = await getSupabase();
  const { error } = await sb.from('attempt_answers')
    .update({ student_answer: studentAnswer, updated_at: new Date().toISOString() })
    .eq('id', attemptAnswerId);
  if (error) throw error;
}

/** Submit exam via Edge Function with direct DB fallback */
export async function submitExam(attemptId, answersMap, options = {}) {
  const targetStatus = options?.status || 'submitted';
  try {
    return await callEdgeFunction('submit-exam', { attempt_id: attemptId, answers: answersMap, status: targetStatus });
  } catch (edgeErr) {
    console.warn('Edge Function submit-exam unavailable, using client DB fallback:', edgeErr.message);
  }

  const sb = await getSupabase();

  // Save all final answers concurrently (supports both Array and Object)
  if (answersMap && typeof answersMap === 'object') {
    const saveTasks = [];
    if (Array.isArray(answersMap)) {
      for (const item of answersMap) {
        if (item && item.attempt_answer_id) {
          saveTasks.push(
            sb.from('attempt_answers')
              .update({ student_answer: item.student_answer ?? '', updated_at: new Date().toISOString() })
              .eq('id', item.attempt_answer_id)
          );
        }
      }
    } else {
      for (const [ansId, ansVal] of Object.entries(answersMap)) {
        saveTasks.push(
          sb.from('attempt_answers')
            .update({ student_answer: ansVal ?? '', updated_at: new Date().toISOString() })
            .eq('id', ansId)
        );
      }
    }
    if (saveTasks.length > 0) {
      await Promise.all(saveTasks);
    }
  }

  // Fetch all attempt answers to evaluate score
  const { data: attemptAnswers, error: fetchErr } = await sb.from('attempt_answers')
    .select('*')
    .eq('attempt_id', attemptId);

  if (fetchErr) throw fetchErr;

  let totalPoints = 0;
  let correctCount = 0;
  let maxPoints = attemptAnswers?.length || 0;

  const evalTasks = [];
  for (const a of (attemptAnswers || [])) {
    let answerType = 'written';
    if (a.question_snapshot) {
      try {
        const qSnap = typeof a.question_snapshot === 'string' ? JSON.parse(a.question_snapshot) : a.question_snapshot;
        if (qSnap?.answer_type) answerType = qSnap.answer_type;
      } catch (_) {}
    }

    // Authoritative grading with multiple valid answers and hyphen/typo tolerance
    const validKey = a.accepted_answers_snapshot || a.correct_answer_snapshot;
    const evalRes = evaluateAnswer(a.student_answer, validKey, answerType);
    totalPoints += evalRes.score;
    if (evalRes.score >= 1.0) correctCount++;

    const isCorrect = evalRes.score >= 1.0;
    const simScore = evalRes.score >= 1.0 ? 1.0 : (evalRes.score === 0.5 ? 0.85 : 0);

    evalTasks.push(
      sb.from('attempt_answers').update({
        score: evalRes.score,
        evaluation_result: evalRes.result,
        is_correct: isCorrect,
        similarity_score: simScore,
        answered_at: new Date().toISOString()
      }).eq('id', a.id)
    );
  }
  if (evalTasks.length > 0) {
    await Promise.all(evalTasks);
  }

  const percentage = calculatePercentage(totalPoints, maxPoints);
  const grade = calculateGrade(percentage);

  const { data: updatedAttempt, error: updateErr } = await sb.from('attempts')
    .update({
      status: targetStatus,
      submitted_at: new Date().toISOString(),
      score: totalPoints,
      correct_count: correctCount,
      total_questions: maxPoints,
      percentage,
      grade,
      effective_score: percentage
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  // Authoritative Best Score Recalculation
  try {
    await recalculateBestScore(updatedAttempt.student_id, updatedAttempt.challenge_definition_id || updatedAttempt.exam_id);
  } catch (bsErr) {
    console.warn('Best score recalculation notice:', bsErr.message);
  }

  return { success: true, attempt: updatedAttempt };
}

// ============================================================
// RESULTS
// ============================================================

/** Fetch attempt with all answer details */
export async function fetchAttemptResult(attemptId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('attempts')
    .select(`
      id, status, score, percentage, grade, submitted_at, started_at,
      expected_end_at, expires_at, challenge_definition_id, exam_id, is_best_score,
      challenge_definitions:challenge_definition_id(title, challenge_definition_type, classes(name), levels(name)),
      exams:exam_id(exam_type, exam_title, answer_type, classes(name), levels(name))
    `)
    .eq('id', attemptId)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch attempt answers for result display */
export async function fetchAttemptAnswers(attemptId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('attempt_answers')
    .select('id, attempt_id, question_id, student_answer, score, evaluation_result, question_snapshot, topic_snapshot, question_type_snapshot, correct_answer_snapshot, is_review_required, created_at, updated_at')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return data;
}

// ============================================================
// ADMIN — Institutions, Programs, Subjects, Levels
// ============================================================

// In-memory mock store for admin console demo when Supabase is not connected
const MOCK_ADMIN_STORE = {
  institutions: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'General English Program', is_active: true, created_at: '2026-01-10T08:00:00Z' },
    { id: '11111111-1111-1111-1111-222222222222', name: 'Academic English Program', is_active: true, created_at: '2026-01-15T08:00:00Z' }
  ],
  programs: [
    { id: '22222222-2222-2222-2222-222222222222', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Class A', is_active: true, created_at: '2026-01-20T08:00:00Z' },
    { id: '22222222-2222-2222-2222-333333333333', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Class B', is_active: true, created_at: '2026-01-22T08:00:00Z' },
    { id: '22222222-2222-2222-2222-444444444444', institution_id: '11111111-1111-1111-1111-222222222222', name: 'Class C (IELTS Prep)', is_active: true, created_at: '2026-01-25T08:00:00Z' }
  ],
  subjects: [
    { id: '33333333-3333-3333-3333-333333333333', institution_id: '11111111-1111-1111-1111-111111111111', name: 'English Grammar & Vocabulary', is_active: true, created_at: '2026-01-12T08:00:00Z' },
    { id: '33333333-3333-3333-3333-444444444444', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Conversational Speaking', is_active: true, created_at: '2026-01-14T08:00:00Z' }
  ],
  levels: [
    { id: '44444444-4444-4444-4444-444444444444', class_id: '33333333-3333-3333-3333-333333333333', name: 'Level 1 - Beginner', level_number: 1, is_active: true, created_at: '2026-01-16T08:00:00Z' },
    { id: '44444444-4444-4444-4444-555555555555', class_id: '33333333-3333-3333-3333-333333333333', name: 'Level 2 - Intermediate', level_number: 2, is_active: true, created_at: '2026-01-18T08:00:00Z' }
  ],
  program_classes: [
    { program_id: '22222222-2222-2222-2222-222222222222', class_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-02-01T08:00:00Z' },
    { program_id: '22222222-2222-2222-2222-333333333333', class_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-02-01T08:00:00Z' }
  ],
  batches: [
    { id: 'bbbbbbbb-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-A', is_active: true, created_at: '2026-01-26T08:00:00Z' },
    { id: 'bbbbbbbb-1111-1111-1111-111111111112', program_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-B', is_active: true, created_at: '2026-01-28T08:00:00Z' },
    { id: 'bbbbbbbb-2222-2222-2222-111111111111', program_id: '22222222-2222-2222-2222-333333333333', name: 'Batch 2026-A', is_active: true, created_at: '2026-01-29T08:00:00Z' }
  ],
  students: [
    { id: '55555555-5555-5555-5555-555555555555', institution_id: '11111111-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'John Doe', gender: 'male', birth_date: '2008-05-14', is_active: true, created_at: '2026-02-02T08:00:00Z' },
    { id: '55555555-5555-5555-5555-666666666666', institution_id: '11111111-1111-1111-1111-111111111111', program_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'Jane Smith', gender: 'female', birth_date: '2009-08-21', is_active: true, created_at: '2026-02-03T08:00:00Z' }
  ],
  exams: [
    { id: '66666666-6666-6666-6666-666666666666', institution_id: '11111111-1111-1111-1111-111111111111', class_id: '33333333-3333-3333-3333-333333333333', exam_type: 'MIDTERM', exam_title: 'Grammar Basics Exam', answer_type: 'multiple_choice', exam_status: 'published', question_order: 'sequential', time_limit_minutes: 15, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-05T08:00:00Z' },
    { id: '66666666-6666-6666-6666-777777777777', institution_id: '11111111-1111-1111-1111-111111111111', class_id: '33333333-3333-3333-3333-333333333333', exam_type: 'QUIZ', exam_title: 'Vocabulary Weekly Sprint', answer_type: 'written', exam_status: 'published', question_order: 'sequential', time_limit_minutes: 20, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-08T08:00:00Z' }
  ],
  exam_programs: [
    { exam_id: '66666666-6666-6666-6666-666666666666', program_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-06T08:00:00Z' },
    { exam_id: '66666666-6666-6666-6666-777777777777', program_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-09T08:00:00Z' }
  ],
  questions: [
    { id: '88888888-8888-8888-8888-111111111111', exam_id: '66666666-6666-6666-6666-666666666666', question_order: 1, question_text: 'Choose the correct form: She ___ to school every morning.', correct_answer: 'walks', answer_type: 'multiple_choice', options_json: ['walks', 'walk', 'walking', 'walked'], created_at: '2026-02-06T09:00:00Z' },
    { id: '88888888-8888-8888-8888-222222222222', exam_id: '66666666-6666-6666-6666-666666666666', question_order: 2, question_text: 'Select the plural of child:', correct_answer: 'children', answer_type: 'multiple_choice', options_json: ['childs', 'children', 'childrens', 'childer'], created_at: '2026-02-06T09:05:00Z' },
    { id: '88888888-8888-8888-8888-333333333333', exam_id: '66666666-6666-6666-6666-777777777777', question_order: 1, question_text: 'Translate to English: MENCAPAI', correct_answer: 'ACHIEVE', answer_type: 'written', options_json: null, created_at: '2026-02-09T09:00:00Z' }
  ],
  attempts: [
    { id: '99999999-9999-9999-9999-111111111111', student_id: '55555555-5555-5555-5555-555555555555', exam_id: '66666666-6666-6666-6666-666666666666', status: 'submitted', score: 10, percentage: 100, grade: 'S', effective_score: 100, submitted_at: '2026-02-10T10:30:00Z', created_at: '2026-02-10T10:00:00Z' }
  ],
  progress: [
    { id: 'aaaa1111-aaaa-1111-aaaa-111111111111', student_id: '55555555-5555-5555-5555-555555555555', class_id: '33333333-3333-3333-3333-333333333333', is_unlocked: true, is_completed: true, completed_at: '2026-02-10T10:30:00Z', created_at: '2026-02-01T08:00:00Z' },
    { id: 'aaaa1111-aaaa-1111-aaaa-222222222222', student_id: '55555555-5555-5555-5555-555555555555', class_id: '33333333-3333-3333-3333-333333333333', is_unlocked: true, is_completed: false, created_at: '2026-02-10T10:31:00Z' }
  ],
  audit_logs: [
    { id: '77777777-7777-7777-7777-777777777777', actor_role: 'ADMIN', action: 'LOGIN', entity_type: 'auth', ip_address: '127.0.0.1', created_at: new Date().toISOString() }
  ],
  question_types: [
    { id: 'wt-1', name: 'Noun', is_system: true, is_active: true },
    { id: 'wt-2', name: 'Verb', is_system: true, is_active: true },
    { id: 'wt-3', name: 'Adjective', is_system: true, is_active: true },
    { id: 'wt-4', name: 'Adverb', is_system: true, is_active: true },
    { id: 'wt-5', name: 'Pronoun', is_system: true, is_active: true },
    { id: 'wt-6', name: 'Preposition', is_system: true, is_active: true },
    { id: 'wt-7', name: 'Conjunction', is_system: true, is_active: true },
    { id: 'wt-8', name: 'Interjection', is_system: true, is_active: true },
    { id: 'wt-9', name: 'Determiner', is_system: true, is_active: true },
    { id: 'wt-10', name: 'Article', is_system: true, is_active: true },
    { id: 'wt-11', name: 'Phrase', is_system: true, is_active: true },
    { id: 'wt-12', name: 'Expression', is_system: true, is_active: true },
    { id: 'wt-13', name: 'Idiom', is_system: true, is_active: true }
  ],
  topics: [
    { id: 'topic-1', class_id: '33333333-3333-3333-3333-333333333333', name: 'General Vocabulary', code: 'GEN-VOC', status: 'active', created_at: '2026-02-01T08:00:00Z' },
    { id: 'topic-2', class_id: '33333333-3333-3333-3333-333333333333', name: 'Daily Conversations', code: 'CONV', status: 'active', created_at: '2026-02-01T08:00:00Z' }
  ],
  challenge_definitions: [],
  assignments: [],
  enrollments: []
};

function hydrateMockRelations(table, item) {
  if (!item) return item;
  const clone = { ...item };
  const store = MOCK_ADMIN_STORE;
  if (table === 'topics') {
    clone.classes = (store.classes || []).find(s => s.id === clone.class_id) || null;
  } else if (table === 'challenge_instances') {
    clone.assessments = (store.challenge_definitions || []).find(a => a.id === clone.challenge_definition_id) || (store.exams || []).find(e => e.id === clone.challenge_definition_id) || null;
    clone.batches = (store.batches || []).find(b => b.id === clone.batch_id) || null;
    clone.students = (store.students || []).find(s => s.id === clone.student_id) || null;
  }
  
  if (table === 'classes') {
    clone.institutions = store.institutions.find(p => p.id === clone.institution_id) || null;
  } else if (table === 'levels') {
    const subj = store.classes.find(s => s.id === clone.class_id);
    clone.classes = subj ? { ...subj, institution_id: subj.institution_id } : null;
  } else if (table === 'programs') {
    clone.institutions = store.institutions.find(p => p.id === clone.institution_id) || null;
  } else if (table === 'batches') {
    const cls = store.programs.find(c => c.id === clone.program_id);
    clone.programs = cls ? { ...cls, institutions: store.institutions.find(p => p.id === cls.institution_id) } : null;
  } else if (table === 'students') {
    clone.programs = store.programs.find(c => c.id === clone.program_id) || null;
    clone.institutions = store.institutions.find(p => p.id === clone.institution_id) || null;
    clone.batches = store.batches.find(b => b.id === clone.batch_id) || null;
  } else if (table === 'exams') {
    clone.institutions = store.institutions.find(p => p.id === clone.institution_id) || null;
    clone.classes = store.classes.find(s => s.id === clone.class_id) || null;
      } else if (table === 'questions') {
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'program_classes') {
    const cls = store.programs.find(c => c.id === clone.program_id);
    clone.programs = cls ? { ...cls, institutions: store.institutions.find(p => p.id === cls.institution_id) } : null;
    clone.classes = store.classes.find(s => s.id === clone.class_id) || null;
  } else if (table === 'exam_programs') {
    const cls = store.programs.find(c => c.id === clone.program_id);
    clone.programs = cls ? { ...cls, institutions: store.institutions.find(p => p.id === cls.institution_id) } : null;
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'attempts') {
    const st = store.students.find(s => s.id === clone.student_id);
    clone.students = st ? { ...st, programs: store.programs.find(c => c.id === st.program_id) } : null;
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'progress') {
    const st = store.students.find(s => s.id === clone.student_id);
    clone.students = st ? { ...st, programs: store.programs.find(c => c.id === st.program_id) } : null;
    clone.classes = store.classes.find(s => s.id === clone.class_id) || null;
      }
  return clone;
}

let _adminCache = new Map();

export function clearAdminCache(table = null) {
  if (table) {
    const normTable = table.replace('-', '_');
    for (const key of _adminCache.keys()) {
      if (key.startsWith(normTable + '|')) {
        _adminCache.delete(key);
      }
    }
  } else {
    _adminCache.clear();
  }
}

export async function adminFetchAll(table, select = '*', filters = {}, forceRefresh = false) {
  const normTable = table.replace('-', '_');
  const cacheKey = normTable + '|' + select + '|' + JSON.stringify(filters);

  if (!forceRefresh && _adminCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(_adminCache.get(cacheKey))); // Return deep copy
  }

  if (isPlaceholderUrl()) {
    let rows = MOCK_ADMIN_STORE[normTable] || [];
    for (const [key, val] of Object.entries(filters)) {
      rows = rows.filter(r => r[key] === val);
    }
    return rows.map(r => hydrateMockRelations(normTable, r));
  }
  try {
    const sb = await getSupabase();
    let query = sb.from(normTable).select(select);
    // Only filter by deleted_at if the table supports soft delete
    if (!['program_classes', 'exam_programs', 'attempts', 'attempt_answers', 'progress', 'audit_logs', 'site_settings'].includes(normTable)) {
      query = query.is('deleted_at', null);
    }
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
    let { data, error } = await query;
    if (error && select !== '*') {
      console.warn(`Query with relation "${select}" on ${normTable} failed, retrying with '*':`, error.message);
      let fallbackQuery = sb.from(normTable).select('*');
      if (!['program_classes', 'exam_programs', 'attempts', 'attempt_answers', 'progress', 'audit_logs', 'site_settings'].includes(normTable)) {
        fallbackQuery = fallbackQuery.is('deleted_at', null);
      }
      for (const [key, val] of Object.entries(filters)) {
        fallbackQuery = fallbackQuery.eq(key, val);
      }
      const retry = await fallbackQuery;
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }
    if (error) throw error;
    let list = data || [];

    // Hydrate exams with program_id, prerequisite_exam_id, exam_order
    if (normTable === 'exams' && list.length > 0) {
      try {
        const [ecRes, auditRes] = await Promise.all([
          sb.from('exam_programs').select('*'),
          sb.from('audit_logs').select('entity_id, new_value, created_at').eq('entity_type', 'exam').eq('action', 'exam_metadata')
        ]);
        const ecList = ecRes.data || [];
        const logsList = auditRes.data || [];
        list.forEach(r => {
          if (!r.program_id) {
            const match = ecList.find(c => c.exam_id === r.id);
            if (match) r.program_id = match.program_id;
          }
          const examLogs = logsList.filter(l => l.entity_id === r.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (examLogs.length > 0 && examLogs[0].new_value) {
            const nv = examLogs[0].new_value;
            if (!r.prerequisite_exam_id && nv.prerequisite_exam_id) r.prerequisite_exam_id = nv.prerequisite_exam_id;
            if (!r.exam_order && nv.exam_order) r.exam_order = nv.exam_order;
            if (!r.program_id && nv.program_id) r.program_id = nv.program_id;
          }
          if (!r.exam_order) r.exam_order = '1';
        });
      } catch (hydrationErr) {
        console.warn('Metadata hydration warning:', hydrationErr.message);
      }
    }
    _adminCache.set(cacheKey, JSON.parse(JSON.stringify(list)));
    return list;
  } catch(e) {
    console.warn(`Supabase query failed for ${table}, using mock store:`, e.message);
    let rows = MOCK_ADMIN_STORE[normTable] || [];
    for (const [key, val] of Object.entries(filters)) {
      rows = rows.filter(r => r[key] === val);
    }
    const list = rows.map(r => hydrateMockRelations(normTable, r));
    _adminCache.set(cacheKey, JSON.parse(JSON.stringify(list)));
    return list;
  }
}

export async function adminInsert(table, payload) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const newItem = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
    if (!MOCK_ADMIN_STORE[normTable]) MOCK_ADMIN_STORE[normTable] = [];
    MOCK_ADMIN_STORE[normTable].unshift(newItem);
    clearAdminCache(normTable);
    return newItem;
  }
  const sb = await getSupabase();
  let insertPayload = { ...payload };
  if (normTable === 'exams') delete insertPayload.display_name;

  let data = null;
  try {
    const res = await sb.from(normTable).insert(insertPayload).select().single();
    if (res.error) throw res.error;
    data = res.data;
  } catch (error) {
    const isRelationMissing = error.code === '42P01' || error.code === 'PGRST204' || String(error.message || '').includes('does not exist');
    if (isRelationMissing) {
      console.warn(`Table ${normTable} does not exist in Supabase, using in-memory store:`, error.message);
      const newItem = { id: crypto.randomUUID(), ...insertPayload, created_at: new Date().toISOString() };
      if (!MOCK_ADMIN_STORE[normTable]) MOCK_ADMIN_STORE[normTable] = [];
      MOCK_ADMIN_STORE[normTable].unshift(newItem);
      clearAdminCache(normTable);
      return newItem;
    }
    const isMissingCol = (
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      String(error.message || '').toLowerCase().includes('pgrst204') ||
      String(error.message || '').toLowerCase().includes('could not find') ||
      String(error.message || '').toLowerCase().includes('column') ||
      String(error.details || '').toLowerCase().includes('column')
    );
    if (isMissingCol) {
      const fallback = { ...insertPayload };
      if (normTable === 'exams') {
        delete fallback.program_id;
        delete fallback.prerequisite_exam_id;
        delete fallback.prerequisite_min_score;
        delete fallback.exam_order;
      } else if (normTable === 'questions') {
        delete fallback.section_id;
        delete fallback.previous_correct_answer;
        delete fallback.last_edited_at;
      }
      const retry = await sb.from(normTable).insert(fallback).select().single();
      if (retry.error) throw new Error(`DB Error (${normTable}): ${retry.error.message}`);
      data = retry.data;
    } else {
      throw new Error(`DB Error (${normTable}): ${error.message || error.code || 'Unknown error'}`);
    }
  }

  // Persist auxiliary metadata for exams
  if (normTable === 'exams' && data?.id) {
    try {
      if (payload.program_id) {
        await sb.from('exam_programs').insert({ exam_id: data.id, program_id: payload.program_id });
      }
      await sb.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'exam_metadata',
        entity_type: 'exam',
        entity_id: data.id,
        new_value: {
          prerequisite_exam_id: payload.prerequisite_exam_id || null,
          prerequisite_min_score: payload.prerequisite_min_score || 60.0,
          exam_order: payload.exam_order || '1',
          program_id: payload.program_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Exam metadata auxiliary save notice:', auxErr.message);
    }
  }

  // Sync Student Level to Progress table (Phase 4)
  if (normTable === 'students' && data?.id && payload.level_id) {
    try {
      const { data: cls } = await sb.from('programs').select('institution_id').eq('id', data.program_id).single();
      const progId = cls?.institution_id || data.institution_id;
      const { data: subjs } = await sb.from('classes').select('id').eq('institution_id', progId).is('deleted_at', null);
      if (subjs && subjs.length > 0) {
        for (const s of subjs) {
          await sb.from('progress').upsert({
            student_id: data.id,
            class_id: s.id,
            is_unlocked: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_id,class_id' });
        }
      }
    } catch (progErr) {
      console.warn('Student progress auto-sync notice:', progErr.message);
    }
  }

  clearAdminCache(normTable);
  return data;
}

export async function adminUpdate(table, id, payload) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      clearAdminCache(normTable);
      return list[idx];
    }
    clearAdminCache(normTable);
    return { id, ...payload };
  }
  const sb = await getSupabase();
  let updatePayload = { ...payload };
  if (normTable === 'exams') delete updatePayload.display_name;

  // Question Change Tracking (Phase 13 & 14)
  if (normTable === 'questions') {
    try {
      const { data: oldQ } = await sb.from('questions').select('correct_answer, question_text').eq('id', id).single();
      if (oldQ && oldQ.correct_answer !== payload.correct_answer) {
        updatePayload.previous_correct_answer = oldQ.correct_answer;
        updatePayload.last_edited_at = new Date().toISOString();
        await sb.from('audit_logs').insert({
          actor_role: 'admin',
          action: 'question_updated',
          entity_type: 'question',
          entity_id: id,
          old_value: { correct_answer: oldQ.correct_answer, question_text: oldQ.question_text },
          new_value: { correct_answer: payload.correct_answer, question_text: payload.question_text },
          created_at: new Date().toISOString()
        });
      }
    } catch (_) {}
  }

  let data = null;
  try {
    const res = await sb.from(normTable).update(updatePayload).eq('id', id).select().single();
    if (res.error) throw res.error;
    data = res.data;
  } catch (error) {
    const isRelationMissing = error.code === '42P01' || error.code === 'PGRST204' || String(error.message || '').includes('does not exist');
    if (isRelationMissing) {
      console.warn(`Table ${normTable} does not exist in Supabase, updating in-memory store:`, error.message);
      if (!MOCK_ADMIN_STORE[normTable]) MOCK_ADMIN_STORE[normTable] = [];
      const list = MOCK_ADMIN_STORE[normTable];
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updatePayload, updated_at: new Date().toISOString() };
        clearAdminCache(normTable);
        return list[idx];
      }
      const newItem = { id, ...updatePayload, updated_at: new Date().toISOString() };
      list.unshift(newItem);
      clearAdminCache(normTable);
      return newItem;
    }
    const isMissingCol = (
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      String(error.message || '').toLowerCase().includes('pgrst204') ||
      String(error.message || '').toLowerCase().includes('could not find') ||
      String(error.message || '').toLowerCase().includes('column') ||
      String(error.details || '').toLowerCase().includes('column')
    );
    if (isMissingCol) {
      const fallback = { ...updatePayload };
      if (normTable === 'exams') {
        delete fallback.program_id;
        delete fallback.prerequisite_exam_id;
        delete fallback.prerequisite_min_score;
        delete fallback.exam_order;
      } else if (normTable === 'questions') {
        delete fallback.section_id;
        delete fallback.previous_correct_answer;
        delete fallback.last_edited_at;
      }
      const retry = await sb.from(normTable).update(fallback).eq('id', id).select().single();
      if (retry.error) throw new Error(`DB Error (${normTable}): ${retry.error.message}`);
      data = retry.data;
    } else {
      throw new Error(`DB Error (${normTable}): ${error.message || error.code || 'Unknown error'}`);
    }
  }

  // Persist auxiliary metadata for exams
  if (normTable === 'exams') {
    try {
      if (payload.program_id) {
        await sb.from('exam_programs').delete().eq('exam_id', id);
        await sb.from('exam_programs').insert({ exam_id: id, program_id: payload.program_id });
      }
      await sb.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'exam_metadata',
        entity_type: 'exam',
        entity_id: id,
        new_value: {
          prerequisite_exam_id: payload.prerequisite_exam_id || null,
          prerequisite_min_score: payload.prerequisite_min_score || 60.0,
          exam_order: payload.exam_order || '1',
          program_id: payload.program_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Exam metadata auxiliary save notice:', auxErr.message);
    }
  }

  // Sync Student Level to Progress table (Phase 4)
  if (normTable === 'students' && payload.level_id) {
    try {
      const studentClassId = payload.program_id || data?.program_id;
      const { data: cls } = await sb.from('programs').select('institution_id').eq('id', studentClassId).single();
      const progId = cls?.institution_id || payload.institution_id;
      const { data: subjs } = await sb.from('classes').select('id').eq('institution_id', progId).is('deleted_at', null);
      if (subjs && subjs.length > 0) {
        for (const s of subjs) {
          await sb.from('progress').upsert({
            student_id: id,
            class_id: s.id,
            is_unlocked: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_id,class_id' });
        }
      }
    } catch (progErr) {
      console.warn('Student progress update notice:', progErr.message);
    }
  }

  clearAdminCache(normTable);
  return data;
}

export async function adminSoftDelete(table, id) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
    clearAdminCache(normTable);
    return;
  }
  // Real Supabase — throw on error
  const sb = await getSupabase();
  const { error } = await sb.from(normTable).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    const isRelationMissing = error.code === '42P01' || error.code === 'PGRST204' || String(error.message || '').includes('does not exist');
    if (isRelationMissing && MOCK_ADMIN_STORE[normTable]) {
      const list = MOCK_ADMIN_STORE[normTable];
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) list.splice(idx, 1);
      clearAdminCache(normTable);
      return { success: true };
    }
    console.error(`Supabase SOFT DELETE failed on ${normTable} id=${id}:`, error);
    throw new Error(`DB Error (${normTable}): ${error.message || error.code || 'Unknown error'}`);
  }
  clearAdminCache(normTable);
}

export async function adminFetchDeleted(table) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) return [];
  const sb = await getSupabase();
  const { data, error } = await sb.from(normTable).select('*').not('deleted_at', 'is', null);
  if (error) {
    const isRelationMissing = error.code === '42P01' || error.code === 'PGRST204' || String(error.message || '').includes('does not exist');
    if (isRelationMissing) return [];
    console.error(`Supabase FETCH DELETED failed on ${normTable}:`, error);
    throw new Error(`DB Error (${normTable}): ${error.message}`);
  }
  return data || [];
}

export async function adminRestore(table, id) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) return;
  const sb = await getSupabase();
  const { error } = await sb.from(normTable).update({ deleted_at: null }).eq('id', id);
  if (error) {
    const isRelationMissing = error.code === '42P01' || error.code === 'PGRST204' || String(error.message || '').includes('does not exist');
    if (isRelationMissing && MOCK_ADMIN_STORE[normTable]) {
      clearAdminCache(normTable);
      return { success: true };
    }
    console.error(`Supabase RESTORE failed on ${normTable} id=${id}:`, error);
    throw new Error(`DB Error (${normTable}): ${error.message}`);
  }
  clearAdminCache(normTable);
}

export async function adminHardDelete(table, id) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
    clearAdminCache(normTable);
    return;
  }
  try {
    const sb = await getSupabase();
    const { error } = await sb.from(normTable).delete().eq('id', id);
    if (error) throw error;
    clearAdminCache(normTable);
  } catch(err) {
    console.warn(`Supabase hard delete failed for ${normTable}, falling back to mock store:`, err.message);
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
    clearAdminCache(normTable);
  }
}

/**
 * Detect and merge duplicate students in the database.
 * Merges duplicate student records belonging to the same class with identical names.
 * Re-links any associated attempts and progress to the primary surviving student.
 */
export async function mergeDuplicateStudents() {
  const allStudents = await adminFetchAll('students');
  const allAttempts = await adminFetchAll('attempts');
  const allProgress = await adminFetchAll('progress');

  const groups = new Map();
  for (const s of allStudents) {
    if (s.deleted_at) continue;
    const key = `${s.program_id}::${(s.name || '').toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  let mergedCount = 0;
  let groupsCount = 0;

  for (const [key, members] of groups.entries()) {
    if (members.length <= 1) continue;
    groupsCount++;

    // Rank candidates to pick best primary:
    // 1. Most attempts
    // 2. Most progress
    // 3. Has birth_date
    // 4. Has gender
    // 5. Earliest created_at
    const sorted = [...members].sort((a, b) => {
      const aAtt = allAttempts.filter(att => att.student_id === a.id).length;
      const bAtt = allAttempts.filter(att => att.student_id === b.id).length;
      if (bAtt !== aAtt) return bAtt - aAtt;

      const aProg = allProgress.filter(p => p.student_id === a.id).length;
      const bProg = allProgress.filter(p => p.student_id === b.id).length;
      if (bProg !== aProg) return bProg - aProg;

      if (a.birth_date && !b.birth_date) return -1;
      if (!a.birth_date && b.birth_date) return 1;

      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    // Merge enriched details into primary
    const primaryUpdates = {};
    if (!primary.birth_date) {
      const withBirth = duplicates.find(d => d.birth_date);
      if (withBirth) primaryUpdates.birth_date = withBirth.birth_date;
    }
    if (!primary.gender) {
      const withGender = duplicates.find(d => d.gender);
      if (withGender) primaryUpdates.gender = withGender.gender;
    }
    if (!primary.batch_id) {
      const withBatch = duplicates.find(d => d.batch_id);
      if (withBatch) primaryUpdates.batch_id = withBatch.batch_id;
    }
    if (!primary.pin_hash) {
      const withPin = duplicates.find(d => d.pin_hash);
      if (withPin) primaryUpdates.pin_hash = withPin.pin_hash;
    }
    if (!primary.is_active && duplicates.some(d => d.is_active)) {
      primaryUpdates.is_active = true;
    }

    if (Object.keys(primaryUpdates).length > 0) {
      primaryUpdates.updated_at = new Date().toISOString();
      await adminUpdate('students', primary.id, primaryUpdates);
      Object.assign(primary, primaryUpdates);
    }

    // Re-link attempts from duplicates to primary
    for (const dup of duplicates) {
      const dupAttempts = allAttempts.filter(a => a.student_id === dup.id);
      for (const att of dupAttempts) {
        await adminUpdate('attempts', att.id, { student_id: primary.id });
        att.student_id = primary.id;
      }

      // Re-link or consolidate progress
      const dupProgress = allProgress.filter(p => p.student_id === dup.id);
      for (const dp of dupProgress) {
        const primaryHasSubject = allProgress.some(p => p.student_id === primary.id && p.class_id === dp.class_id);
        if (!primaryHasSubject) {
          await adminUpdate('progress', dp.id, { student_id: primary.id });
          dp.student_id = primary.id;
        } else {
          await adminHardDelete('progress', dp.id);
        }
      }

      // Delete the duplicate student row
      await adminHardDelete('students', dup.id);
      mergedCount++;
    }
  }

  return { groupsCount, mergedCount };
}

/**
 * Detect duplicate questions within an exam or across exams
 * @param {string|null} examId - Optional filter by exam
 */
export async function detectDuplicateQuestions(examId = null) {
  const [questions, exams] = await Promise.all([
    adminFetchAll('questions', 'id, exam_id, question_order, question_text, correct_answer, answer_type, created_at, deleted_at'),
    adminFetchAll('exams', 'id, exam_title, exam_type')
  ]);

  const examMap = new Map();
  (exams || []).forEach(e => examMap.set(e.id, e));

  let activeQuestions = (questions || []).filter(q => !q.deleted_at);
  if (examId) {
    activeQuestions = activeQuestions.filter(q => q.exam_id === examId);
  }

  // 1. Same-Exam Duplicate Text Groups (Critical duplicate bug)
  const sameExamTextMap = new Map();
  activeQuestions.forEach(q => {
    const textNorm = String(q.question_text || '').trim().toLowerCase();
    if (!textNorm) return;
    const key = `${q.exam_id}::${textNorm}`;
    if (!sameExamTextMap.has(key)) sameExamTextMap.set(key, []);
    sameExamTextMap.get(key).push(q);
  });

  const sameExamDuplicates = [];
  for (const [key, candidates] of sameExamTextMap.entries()) {
    if (candidates.length <= 1) continue;
    candidates.sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0) || new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const e = examMap.get(candidates[0].exam_id);
    sameExamDuplicates.push({
      key,
      examId: candidates[0].exam_id,
      examTitle: e ? `${e.exam_type ? e.exam_type + ' — ' : ''}${e.exam_title}` : 'Unknown Exam',
      questionText: candidates[0].question_text,
      recommendedPrimaryId: candidates[0].id,
      candidates
    });
  }

  // 2. Same-Exam Order Conflicts (duplicate order numbers in same exam)
  const sameExamOrderMap = new Map();
  activeQuestions.forEach(q => {
    if (q.question_order == null) return;
    const key = `${q.exam_id}::${Number(q.question_order)}`;
    if (!sameExamOrderMap.has(key)) sameExamOrderMap.set(key, []);
    sameExamOrderMap.get(key).push(q);
  });

  const sameExamOrderConflicts = [];
  for (const [key, candidates] of sameExamOrderMap.entries()) {
    if (candidates.length <= 1) continue;
    const e = examMap.get(candidates[0].exam_id);
    sameExamOrderConflicts.push({
      key,
      examId: candidates[0].exam_id,
      examTitle: e ? `${e.exam_type ? e.exam_type + ' — ' : ''}${e.exam_title}` : 'Unknown Exam',
      order: Number(candidates[0].question_order),
      candidates
    });
  }

  // 3. Cross-Exam Duplicates (identical question text appearing across multiple exams)
  const crossExamTextMap = new Map();
  (questions || []).filter(q => !q.deleted_at).forEach(q => {
    const textNorm = String(q.question_text || '').trim().toLowerCase();
    if (!textNorm) return;
    if (!crossExamTextMap.has(textNorm)) crossExamTextMap.set(textNorm, []);
    crossExamTextMap.get(textNorm).push(q);
  });

  const crossExamDuplicates = [];
  for (const [textNorm, candidates] of crossExamTextMap.entries()) {
    const uniqueExams = new Set(candidates.map(c => c.exam_id));
    if (uniqueExams.size <= 1) continue;
    crossExamDuplicates.push({
      questionText: candidates[0].question_text,
      examCount: uniqueExams.size,
      candidatesCount: candidates.length,
      exams: Array.from(uniqueExams).map(eid => {
        const e = examMap.get(eid);
        return {
          id: eid,
          title: e ? `${e.exam_type ? e.exam_type + ' — ' : ''}${e.exam_title}` : 'Unknown Exam'
        };
      })
    });
  }

  return {
    sameExamDuplicates,
    sameExamOrderConflicts,
    crossExamDuplicates,
    totalSameExamDupCount: sameExamDuplicates.reduce((acc, g) => acc + (g.candidates.length - 1), 0)
  };
}

/**
 * Re-sequence question_order sequentially (1, 2, 3... N) for an exam
 * @param {string} examId
 */
export async function resequenceExamQuestions(examId) {
  const allQ = await adminFetchAll('questions', '*', { exam_id: examId });
  const activeQ = (allQ || []).filter(q => !q.deleted_at);
  activeQ.sort((a, b) => {
    const orderDiff = (Number(a.question_order) || 0) - (Number(b.question_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  let resequencedCount = 0;
  const updatePromises = [];
  activeQ.forEach((q, idx) => {
    const newOrder = idx + 1;
    if (Number(q.question_order) !== newOrder) {
      updatePromises.push(adminUpdate('questions', q.id, { question_order: newOrder, updated_at: new Date().toISOString() }));
      resequencedCount++;
    }
  });

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  return { examId, totalQuestions: activeQ.length, resequencedCount };
}

/**
 * Resolve a single duplicate question pair
 * Safely re-links any attempt_answers from duplicateQId to primaryQId,
 * deletes duplicateQId, and re-sequences questions.
 */
export async function resolveDuplicateQuestionGroup(primaryQId, duplicateQId, autoResequence = true) {
  const sb = await getSupabase();

  let examId = null;
  if (!isPlaceholderUrl()) {
    try {
      const { data: qData } = await sb.from('questions').select('exam_id').eq('id', duplicateQId).single();
      if (qData) examId = qData.exam_id;
    } catch (_) {}

    try {
      // Re-link attempt_answers pointing to duplicateQId to primaryQId
      await sb.from('attempt_answers')
        .update({ question_id: primaryQId, updated_at: new Date().toISOString() })
        .eq('question_id', duplicateQId);
    } catch (err) {
      console.warn('Could not re-link attempt_answers for question:', err.message);
    }
  }

  await adminHardDelete('questions', duplicateQId);

  let reseqResult = null;
  if (autoResequence && examId) {
    reseqResult = await resequenceExamQuestions(examId);
  }

  return { success: true, primaryQId, duplicateQId, examId, reseqResult };
}

/**
 * Batch resolve all same-exam duplicate questions within an exam
 */
export async function batchResolveExamDuplicateQuestions(examId) {
  const dups = await detectDuplicateQuestions(examId);
  const groups = dups.sameExamDuplicates;
  let deletedQuestions = 0;

  for (const group of groups) {
    const primary = group.candidates[0]; // lowest order
    const duplicates = group.candidates.slice(1);
    for (const dup of duplicates) {
      await resolveDuplicateQuestionGroup(primary.id, dup.id, false);
      deletedQuestions++;
    }
  }

  const reseqResult = await resequenceExamQuestions(examId);

  return {
    examId,
    resolvedGroups: groups.length,
    deletedQuestions,
    remainingQuestions: reseqResult.totalQuestions
  };
}

/**
 * Detect duplicate students with rich comparison metadata
 * @param {'same_class'|'cross_class'} scope
 */
export async function detectDuplicateStudents(scope = 'same_class') {
  const [students, attempts, progress] = await Promise.all([
    adminFetchAll('students', '*, programs(id, name, institution_id, institutions(name)), batches(id, name)'),
    adminFetchAll('attempts', 'id, student_id, score, percentage, grade, status'),
    adminFetchAll('progress', 'id, student_id, class_id')
  ]);

  const activeStudents = (students || []).filter(s => !s.deleted_at);

  const groups = new Map();
  activeStudents.forEach(s => {
    const nameNorm = String(s.name || '').toLowerCase().trim();
    if (!nameNorm) return;
    const key = scope === 'same_class' ? `${s.program_id}::${nameNorm}` : nameNorm;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });

  const duplicateGroups = [];
  for (const [key, rawCandidates] of groups.entries()) {
    if (rawCandidates.length <= 1) continue;

    if (scope === 'cross_class') {
      const distinctClasses = new Set(rawCandidates.map(c => c.program_id));
      if (distinctClasses.size <= 1) continue; // Same class already covered in other scope
    }

    const candidates = rawCandidates.map(c => {
      const studentAttempts = (attempts || []).filter(a => a.student_id === c.id);
      const studentProgress = (progress || []).filter(p => p.student_id === c.id);
      const bestAttempt = [...studentAttempts].sort((a, b) => (Number(b.percentage) || 0) - (Number(a.percentage) || 0))[0];
      return {
        ...c,
        attemptsCount: studentAttempts.length,
        progressCount: studentProgress.length,
        bestScore: bestAttempt ? parseFloat(bestAttempt.percentage || 0).toFixed(1) : null,
        globalGrade: bestAttempt ? bestAttempt.grade : null,
        programName: c.programs?.name || '—',
        institutionName: c.programs?.institutions?.name || '—',
        batchName: c.batches?.name || 'Unassigned'
      };
    });

    // Recommendation logic:
    // 1. Has photo
    // 2. Most attempts
    // 3. Most progress
    // 4. Has birth date
    // 5. Earliest created
    const sorted = [...candidates].sort((a, b) => {
      if (b.photo_url && !a.photo_url) return 1;
      if (!b.photo_url && a.photo_url) return -1;
      if (b.attemptsCount !== a.attemptsCount) return b.attemptsCount - a.attemptsCount;
      if (b.progressCount !== a.progressCount) return b.progressCount - a.progressCount;
      if (b.birth_date && !a.birth_date) return 1;
      if (!b.birth_date && a.birth_date) return -1;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    duplicateGroups.push({
      key,
      name: candidates[0].name,
      recommendedPrimaryId: sorted[0].id,
      candidates
    });
  }

  return duplicateGroups;
}

/**
 * Merge a specific duplicate student into a primary student
 * @param {string} primaryId
 * @param {string} duplicateId
 * @param {boolean} softDelete
 */
export async function mergeStudentPair(primaryId, duplicateId, softDelete = true) {
  const [primaryList, dupList, allAttempts, allProgress] = await Promise.all([
    adminFetchAll('students', '*', { id: primaryId }),
    adminFetchAll('students', '*', { id: duplicateId }),
    adminFetchAll('attempts', '*', { student_id: duplicateId }),
    adminFetchAll('progress', '*', { student_id: duplicateId })
  ]);

  const primary = primaryList[0];
  const dup = dupList[0];

  if (!primary || !dup) throw new Error('Primary or duplicate student not found.');

  // 1. Merge missing demographic / profile fields into primary
  const primaryUpdates = {};
  if (!primary.birth_date && dup.birth_date) primaryUpdates.birth_date = dup.birth_date;
  if (!primary.gender && dup.gender) primaryUpdates.gender = dup.gender;
  if (!primary.batch_id && dup.batch_id) primaryUpdates.batch_id = dup.batch_id;
  if (!primary.pin_hash && dup.pin_hash) primaryUpdates.pin_hash = dup.pin_hash;
  if (!primary.photo_url && dup.photo_url) primaryUpdates.photo_url = dup.photo_url;
  if (!primary.is_active && dup.is_active) primaryUpdates.is_active = true;

  if (Object.keys(primaryUpdates).length > 0) {
    primaryUpdates.updated_at = new Date().toISOString();
    await adminUpdate('students', primary.id, primaryUpdates);
  }

  // 2. Re-link all attempts from duplicate to primary
  for (const att of allAttempts) {
    await adminUpdate('attempts', att.id, { student_id: primary.id, updated_at: new Date().toISOString() });
  }

  // 3. Re-link progress
  const primaryProgress = await adminFetchAll('progress', '*', { student_id: primary.id });
  for (const dp of allProgress) {
    const exists = primaryProgress.some(p => p.class_id === dp.class_id);
    if (!exists) {
      await adminUpdate('progress', dp.id, { student_id: primary.id, updated_at: new Date().toISOString() });
    } else {
      await adminHardDelete('progress', dp.id);
    }
  }

  // 4. Delete or soft-delete duplicate student
  if (softDelete) {
    await adminUpdate('students', dup.id, { deleted_at: new Date().toISOString(), is_active: false });
  } else {
    await adminHardDelete('students', dup.id);
  }

  return { success: true, primaryId, duplicateId };
}

// ============================================================
// CHEATING LOG
// ============================================================

export async function logCheatingEvent(studentId, examId, action, detail) {
  try {
    if (isPlaceholderUrl()) {
      console.warn('Cheating logged (demo mode):', { studentId, examId, action, detail });
      return;
    }
    const sb = await getSupabase();
    await sb.from('audit_logs').insert({
      actor_user_id: studentId,
      actor_role: 'student',
      action: action || 'CHEAT_ATTEMPT',
      entity_type: 'exam',
      entity_id: examId,
      new_value: detail,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Failed to insert audit log for cheating:', err);
  }
}

// ============================================================
// UTILITIES
// ============================================================

// ============================================================
// EXAM RECALIBRATOR ENGINE (Phases 15, 16, 17)
// ============================================================

/**
 * Preview recalibration of an exam across all submitted attempts.
 * Pure read-only operation: does not mutate the database.
 *
 * @param {string} examId
 * @returns {Promise<Object>} Detailed comparison and summary
 */
export async function previewRecalibrateExam(examId) {
  const sb = await getSupabase();

  // 1. Load exam
  const { data: exam, error: examErr } = await sb.from('exams')
    .select('id, exam_title, display_name, minimum_required_score, class_id, institution_id')
    .eq('id', examId)
    .single();
  if (examErr || !exam) throw new Error('Exam not found: ' + (examErr?.message || examId));

  const minPassingScore = Number(exam.minimum_required_score) || 60;

  // 2. Load current active questions for this exam
  const { data: questions, error: qErr } = await sb.from('questions')
    .select('id, question_order, question_text, correct_answer, answer_type, metadata')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order');
  if (qErr) throw qErr;

  const questionsMap = new Map();
  (questions || []).forEach(q => questionsMap.set(q.id, q));

  // 3. Load all submitted attempts for this exam
  const { data: attempts, error: attErr } = await sb.from('attempts')
    .select('*, students(id, name, gender, program_id, programs(name))')
    .eq('exam_id', examId)
    .in('status', ['submitted', 'auto_submitted', 'expired'])
    .order('submitted_at', { ascending: false });
  if (attErr) throw attErr;

  if (!attempts || attempts.length === 0) {
    return {
      exam,
      totalQuestions: questions.length,
      totalAttempts: 0,
      affectedAttemptsCount: 0,
      affectedStudentsCount: 0,
      passToFailCount: 0,
      failToPassCount: 0,
      scoreIncreaseCount: 0,
      scoreDecreaseCount: 0,
      noChangeCount: 0,
      attemptsDiff: []
    };
  }

  // 4. Load all attempt answers for these attempts
  const attemptIds = attempts.map(a => a.id);
  const { data: allAnswers, error: ansErr } = await sb.from('attempt_answers')
    .select('*')
    .in('attempt_id', attemptIds);
  if (ansErr) throw ansErr;

  const answersByAttempt = new Map();
  (allAnswers || []).forEach(ans => {
    if (!answersByAttempt.has(ans.attempt_id)) answersByAttempt.set(ans.attempt_id, []);
    answersByAttempt.get(ans.attempt_id).push(ans);
  });

  const attemptsDiff = [];
  const affectedStudentsSet = new Set();
  const affectedQuestionsSet = new Set();
  let passToFailCount = 0;
  let failToPassCount = 0;
  let scoreIncreaseCount = 0;
  let scoreDecreaseCount = 0;
  let noChangeCount = 0;

  for (const attempt of attempts) {
    const studentName = attempt.students ? formatStudentName(attempt.students.name, attempt.students.gender) : 'Unknown Student';
    const programName = attempt.students?.programs?.name || '—';
    const ansList = answersByAttempt.get(attempt.id) || [];

    let newTotalScore = 0;
    const totalQuestions = ansList.length || questions.length || 1;
    const questionDiffs = [];

    for (const ans of ansList) {
      // Find current question definition
      const curQ = ans.question_id ? questionsMap.get(ans.question_id) : null;
      const targetCorrect = curQ ? curQ.correct_answer : ans.correct_answer_snapshot;
      const answerType = curQ?.answer_type || ans.question_snapshot?.answer_type || 'written';

      // Re-evaluate using authoritative centralized grading engine
      const evalRes = evaluateAnswer(ans.student_answer, targetCorrect, answerType);
      newTotalScore += evalRes.score;

      const oldScore = Number(ans.score) || 0;
      const oldRes = ans.evaluation_result || 'incorrect';
      const isQuestionAffected = (evalRes.score !== oldScore) || (evalRes.result !== oldRes);

      if (isQuestionAffected && curQ) {
        affectedQuestionsSet.add(curQ.id);
      }

      questionDiffs.push({
        answerId: ans.id,
        questionId: ans.question_id,
        questionText: curQ?.question_text || ans.question_snapshot?.question_text || 'Question',
        studentAnswer: ans.student_answer || '—',
        oldCorrectAnswer: ans.correct_answer_snapshot,
        newCorrectAnswer: targetCorrect,
        oldResult: oldRes,
        newResult: evalRes.result,
        oldScore,
        newScore: evalRes.score,
        isAffected: isQuestionAffected
      });
    }

    const oldPct = Number(attempt.percentage) || 0;
    const newPct = calculatePercentage(newTotalScore, totalQuestions);
    const oldGrade = attempt.grade || calculateGrade(oldPct);
    const newGrade = calculateGrade(newPct);

    const oldPassed = isPassing(oldPct, minPassingScore);
    const newPassed = isPassing(newPct, minPassingScore);
    const isAttemptAffected = (oldPct !== newPct) || (oldPassed !== newPassed);

    if (isAttemptAffected) {
      affectedStudentsSet.add(attempt.student_id);
      if (!oldPassed && newPassed) failToPassCount++;
      else if (oldPassed && !newPassed) passToFailCount++;

      if (newPct > oldPct) scoreIncreaseCount++;
      else if (newPct < oldPct) scoreDecreaseCount++;
    } else {
      noChangeCount++;
    }

    attemptsDiff.push({
      attemptId: attempt.id,
      studentId: attempt.student_id,
      studentName,
      programName,
      submittedAt: attempt.submitted_at,
      oldScore: Number(attempt.score) || 0,
      newScore: newTotalScore,
      oldPercentage: oldPct,
      newPercentage: newPct,
      oldGrade,
      newGrade,
      oldStatus: oldPassed ? 'PASS' : 'FAIL',
      newStatus: newPassed ? 'PASS' : 'FAIL',
      isAffected: isAttemptAffected,
      questions: questionDiffs
    });
  }

  return {
    exam,
    totalQuestions: questions.length,
    totalAttempts: attempts.length,
    affectedAttemptsCount: attemptsDiff.filter(a => a.isAffected).length,
    affectedStudentsCount: affectedStudentsSet.size,
    affectedQuestionsCount: affectedQuestionsSet.size,
    passToFailCount,
    failToPassCount,
    scoreIncreaseCount,
    scoreDecreaseCount,
    noChangeCount,
    attemptsDiff
  };
}

/**
 * Apply recalibration to an exam. Mutates attempt_answers, attempts, and progress.
 *
 * @param {string} examId
 * @param {string} adminIdentifier
 * @returns {Promise<Object>} Result of execution
 */
export async function applyRecalibrateExam(examId, adminIdentifier = 'admin') {
  const sb = await getSupabase();
  const preview = await previewRecalibrateExam(examId);

  const affected = preview.attemptsDiff.filter(a => a.isAffected);
  if (affected.length === 0) {
    return {
      success: true,
      updatedAttemptsCount: 0,
      message: 'All attempts already match the latest question definitions. No changes needed.'
    };
  }

  let updatedAttemptsCount = 0;

  for (const diff of affected) {
    // 1. Update attempt_answers
    const ansTasks = diff.questions.filter(q => q.isAffected).map(q => {
      return sb.from('attempt_answers').update({
        score: q.newScore,
        evaluation_result: q.newResult,
        correct_answer_snapshot: q.newCorrectAnswer,
        updated_at: new Date().toISOString()
      }).eq('id', q.answerId);
    });

    if (ansTasks.length > 0) {
      await Promise.all(ansTasks);
    }

    // 2. Update attempt
    await sb.from('attempts').update({
      score: diff.newScore,
      percentage: diff.newPercentage,
      grade: diff.newGrade,
      effective_score: diff.newPercentage,
      updated_at: new Date().toISOString()
    }).eq('id', diff.attemptId);

    // 3. Update student progress if level progression is affected
    if (preview.exam.class_id && preview.exam.level_id) {
      const isPassed = diff.newStatus === 'PASS';
      try {
        await sb.from('progress').upsert({
          student_id: diff.studentId,
          class_id: preview.exam.class_id,
          is_unlocked: true,
          is_completed: isPassed,
          completed_at: isPassed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'student_id,class_id' });
      } catch (progErr) {
        console.warn('Progress update warning during recalibration:', progErr.message);
      }
    }

    updatedAttemptsCount++;
  }

  // 4. Record Audit Log (Phase 17)
  try {
    await sb.from('audit_logs').insert({
      actor_role: 'admin',
      action: 'exam_recalibrated',
      entity_type: 'exam',
      entity_id: examId,
      old_value: {
        affectedAttemptsCount: preview.affectedAttemptsCount,
        passToFailCount: preview.passToFailCount,
        failToPassCount: preview.failToPassCount
      },
      new_value: {
        recalibratedBy: adminIdentifier,
        recalibratedAt: new Date().toISOString(),
        scoreIncreases: preview.scoreIncreaseCount,
        scoreDecreases: preview.scoreDecreaseCount
      },
      created_at: new Date().toISOString()
    });
  } catch (auditErr) {
    console.warn('Audit log notice:', auditErr.message);
  }

  return {
    success: true,
    updatedAttemptsCount,
    summary: {
      affectedAttemptsCount: preview.affectedAttemptsCount,
      passToFailCount: preview.passToFailCount,
      failToPassCount: preview.failToPassCount,
      scoreIncreaseCount: preview.scoreIncreaseCount,
      scoreDecreaseCount: preview.scoreDecreaseCount
    }
  };
}

// ============================================================
// CENTRALIZED ASSESSMENT SYSTEM V1 API
// ============================================================

/** Global Subjects */
export async function fetchGlobalClasses() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('classes')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return data || [];
}

/** Word Types (Configurable Validation List) */
export async function fetchWordTypes() {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('question_types')
      .select('*')
      .order('name');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('Word types query fallback to defaults:', err.message);
  }
  return MOCK_ADMIN_STORE.question_types || [];
}

export async function createWordType(name) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('question_types')
      .insert({ name: name.trim(), is_active: true })
      .select()
      .single();
    if (!error && data) {
      clearAdminCache('question_types');
      return data;
    }
  } catch (_) {}
  const newWt = { id: 'custom-' + Date.now(), name: name.trim(), is_system: false, is_active: true, created_at: new Date().toISOString() };
  if (!MOCK_ADMIN_STORE.question_types) MOCK_ADMIN_STORE.question_types = [];
  MOCK_ADMIN_STORE.question_types.push(newWt);
  clearAdminCache('question_types');
  return newWt;
}

export async function toggleWordType(id, isActive) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('question_types')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      clearAdminCache('question_types');
      return data;
    }
  } catch (_) {}
  if (MOCK_ADMIN_STORE.question_types) {
    const item = MOCK_ADMIN_STORE.question_types.find(w => w.id === id);
    if (item) item.is_active = isActive;
  }
  clearAdminCache('question_types');
  return { id, is_active: isActive };
}

/** Topics (Global per Subject) */
export async function fetchTopics(subjectId = null) {
  const sb = await getSupabase();
  try {
    let query = sb.from('topics')
      .select('*, classes(name)')
      .is('deleted_at', null);
    if (subjectId) {
      query = query.eq('class_id', subjectId);
    }
    const { data, error } = await query.order('name');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('Topics table query fallback:', err.message);
  }
  let list = MOCK_ADMIN_STORE.topics || [];
  if (subjectId) list = list.filter(t => t.class_id === subjectId);
  return list.map(t => hydrateMockRelations('topics', t));
}

export async function createTopic(payload) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('topics')
      .insert({
        class_id: payload.class_id,
        name: payload.name.trim(),
        code: payload.code ? payload.code.trim() : null,
        status: payload.status || 'active'
      })
      .select()
      .single();
    if (!error && data) {
      clearAdminCache('topics');
      return data;
    }
  } catch (_) {}
  const newTopic = {
    id: 'topic-' + Date.now(),
    class_id: payload.class_id,
    name: payload.name.trim(),
    code: payload.code ? payload.code.trim() : null,
    status: payload.status || 'active',
    created_at: new Date().toISOString()
  };
  if (!MOCK_ADMIN_STORE.topics) MOCK_ADMIN_STORE.topics = [];
  MOCK_ADMIN_STORE.topics.push(newTopic);
  clearAdminCache('topics');
  return hydrateMockRelations('topics', newTopic);
}

export async function updateTopic(id, payload) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('topics')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      clearAdminCache('topics');
      return data;
    }
  } catch (_) {}
  if (MOCK_ADMIN_STORE.topics) {
    const idx = MOCK_ADMIN_STORE.topics.findIndex(t => t.id === id);
    if (idx !== -1) {
      MOCK_ADMIN_STORE.topics[idx] = { ...MOCK_ADMIN_STORE.topics[idx], ...payload, updated_at: new Date().toISOString() };
      clearAdminCache('topics');
      return hydrateMockRelations('topics', MOCK_ADMIN_STORE.topics[idx]);
    }
  }
  clearAdminCache('topics');
  return { id, ...payload };
}

export async function deleteTopic(id) {
  try {
    return await adminSoftDelete('topics', id);
  } catch (_) {
    if (MOCK_ADMIN_STORE.topics) {
      MOCK_ADMIN_STORE.topics = MOCK_ADMIN_STORE.topics.filter(t => t.id !== id);
      clearAdminCache('topics');
    }
    return { success: true };
  }
}

/** Questions (Central Question Bank) */
export async function fetchCentralQuestions(filters = {}) {
  const sb = await getSupabase();
  try {
    let query = sb.from('questions')
      .select('*, topics(name, code), classes(name)')
      .is('deleted_at', null);

    if (filters.class_id) query = query.eq('class_id', filters.class_id);
    if (filters.topic_id) query = query.eq('topic_id', filters.topic_id);
    if (filters.question_type) query = query.eq('question_type', filters.question_type);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) return data;
  } catch (err) {
    console.warn('Central questions query fallback to legacy questions:', err.message);
  }

  // Fallback to legacy questions table
  try {
    const { data: legacyQ, error: legErr } = await sb.from('questions')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!legErr && legacyQ) {
      return legacyQ.map(q => {
        let metaObj = {};
        if (typeof q.metadata === 'object' && q.metadata) metaObj = q.metadata;
        else if (typeof q.metadata === 'string') {
          try { metaObj = JSON.parse(q.metadata); } catch (_) {}
        }
        const topicName = metaObj.topic || 'General';
        const wordType = metaObj.type || q.question_type || null;
        const accepted = Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0
          ? q.accepted_answers
          : (q.correct_answer ? [q.correct_answer] : []);

        return {
          ...q,
          topic_id: null,
          topic_name: topicName,
          question_type: wordType,
          topics: { name: topicName, code: 'GEN' },
          subjects: { name: 'General' },
          accepted_answers: accepted,
          status: 'active'
        };
      });
    }
  } catch (e2) {
    console.warn('Legacy questions fetch fallback error:', e2.message);
  }
  return [];
}

export async function createCentralQuestion(payload) {
  const sb = await getSupabase();
  let acceptedAnswers = [];
  if (Array.isArray(payload.accepted_answers)) {
    acceptedAnswers = payload.accepted_answers;
  } else if (typeof payload.accepted_answers === 'string') {
    acceptedAnswers = payload.accepted_answers.split(/[;/|]/).map(s => s.trim()).filter(Boolean);
  } else if (payload.correct_answer) {
    acceptedAnswers = String(payload.correct_answer).split(/[;/|]/).map(s => s.trim()).filter(Boolean);
  }

  const { data, error } = await sb.from('questions')
    .insert({
      class_id: payload.class_id,
      topic_id: payload.topic_id,
      question_type: payload.question_type || null,
      question_text: payload.question_text.trim(),
      accepted_answers: acceptedAnswers,
      status: payload.status || 'active'
    })
    .select()
    .single();
  if (error) throw error;
  clearAdminCache('questions');
  return data;
}

export async function updateCentralQuestion(id, payload) {
  const sb = await getSupabase();
  const updateData = { ...payload };
  if (updateData.accepted_answers && !Array.isArray(updateData.accepted_answers)) {
    updateData.accepted_answers = String(updateData.accepted_answers).split(/[;/|]/).map(s => s.trim()).filter(Boolean);
  }
  const { data, error } = await sb.from('questions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  clearAdminCache('questions');
  return data;
}

export async function deleteCentralQuestion(id) {
  return await adminSoftDelete('questions', id);
}

/** Assessments (Evaluations & Exams) */
export async function fetchChallengeDefinitions(filters = {}) {
  const sb = await getSupabase();
  let query = sb.from('challenge_definitions').select('*, classes(name)').is('deleted_at', null);

  if (filters.class_id) query = query.eq('class_id', filters.class_id);
  if (filters.challenge_definition_type) query = query.eq('challenge_definition_type', filters.challenge_definition_type);
  if (filters.status) query = query.eq('status', filters.status);

  try {
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) return data;
  } catch (err) {
    console.warn('Assessments table query fallback to exams:', err.message);
  }

  // Fallback to legacy exams table if assessments not yet migrated
  const legacyList = await adminFetchAll('exams', '*, classes(name)');
  return legacyList.map(e => ({
    id: e.id,
    title: e.title || e.exam_title,
    challenge_definition_type: e.challenge_definition_type || 'EVALUATION',
    status: (e.exam_status || 'draft').toUpperCase(),
    working_duration_minutes: e.time_limit_minutes || 60,
    created_at: e.created_at,
    ...e
  }));
}

export async function createChallengeDefinitionWithTopics(payload, topicIds = []) {
  const sb = await getSupabase();
  try {
    const { data: assessment, error } = await sb.from('challenge_definitions')
      .insert({
        institution_id: payload.institution_id || null,
        class_id: payload.class_id,
        challenge_definition_type: payload.challenge_definition_type || 'EVALUATION',
        title: payload.title.trim(),
        description: payload.description || null,
        status: 'DRAFT',
        question_order: payload.question_order || 'RANDOM',
        availability_start: payload.availability_start || null,
        availability_end: payload.availability_end || null,
        working_duration_minutes: payload.working_duration_minutes || 60,
        prerequisite_assessment_id: payload.prerequisite_assessment_id || null,
        created_by: payload.created_by || 'admin'
      })
      .select()
      .single();

    if (!error && assessment) {
      if (topicIds && topicIds.length > 0) {
        const topicInserts = topicIds.map(tid => ({
          challenge_definition_id: assessment.id,
          topic_id: tid
        }));
        await sb.from('challenge_definition_topics').insert(topicInserts);
      }
      clearAdminCache('challenge_definitions');
      return assessment;
    }
  } catch (err) {
    console.warn('createChallengeDefinitionWithTopics fallback to exams:', err.message);
  }

  // Fallback to legacy exams table
  let instId = payload.institution_id || null;
  if (!instId && payload.class_id) {
    try {
      const { data: sData } = await sb.from('classes').select('institution_id').eq('id', payload.class_id).single();
      if (sData?.institution_id) instId = sData.institution_id;
    } catch (_) {}
  }
  if (!instId) {
    try {
      const { data: anyInst } = await sb.from('institutions').select('id').is('deleted_at', null).limit(1);
      if (anyInst?.[0]?.id) instId = anyInst[0].id;
    } catch (_) {}
  }

  const examPayload = {
    institution_id: instId,
    class_id: payload.class_id,
    exam_title: payload.title.trim(),
    time_limit_minutes: payload.working_duration_minutes || 60,
    exam_status: 'draft',
    randomize_order: payload.question_order === 'RANDOM'
  };
  const { data: createdExam, error: examErr } = await sb.from('exams')
    .insert(examPayload)
    .select()
    .single();
  if (examErr) throw examErr;
  clearAdminCache('exams');
  return {
    ...createdExam,
    title: createdExam.exam_title,
    challenge_definition_type: payload.challenge_definition_type || 'EVALUATION',
    working_duration_minutes: createdExam.time_limit_minutes
  };
}

export async function updateAssessmentWithTopics(assessmentId, payload, topicIds = []) {
  const sb = await getSupabase();
  try {
    const { data: updated, error } = await sb.from('challenge_definitions')
      .update({
        class_id: payload.class_id,
        challenge_definition_type: payload.challenge_definition_type || 'EVALUATION',
        title: payload.title,
        working_duration_minutes: payload.working_duration_minutes || 60,
        question_order: payload.question_order || 'RANDOM',
        prerequisite_assessment_id: payload.prerequisite_assessment_id || null,
        availability_start: payload.availability_start || null,
        availability_end: payload.availability_end || null,
        status: payload.status || 'DRAFT',
        updated_at: new Date().toISOString()
      })
      .eq('id', assessmentId)
      .select()
      .single();

    if (!error && updated) {
      if (topicIds.length >= 0) {
        await sb.from('challenge_definition_topics').delete().eq('challenge_definition_id', assessmentId);
        if (topicIds.length > 0) {
          const topicInserts = topicIds.map(tid => ({
            challenge_definition_id: assessmentId,
            topic_id: tid
          }));
          await sb.from('challenge_definition_topics').insert(topicInserts);
        }
      }
      clearAdminCache('challenge_definitions');
      return updated;
    }
  } catch (err) {
    console.warn('updateAssessmentWithTopics fallback to exams:', err.message);
  }

  // Fallback to legacy exams table
  const examUpdate = {
    class_id: payload.class_id,
    exam_title: payload.title.trim(),
    time_limit_minutes: payload.working_duration_minutes || 60,
    randomize_order: payload.question_order === 'RANDOM',
    updated_at: new Date().toISOString()
  };
  const { data: updatedExam, error: exErr } = await sb.from('exams')
    .update(examUpdate)
    .eq('id', assessmentId)
    .select()
    .single();

  if (exErr) throw exErr;
  clearAdminCache('exams');
  return {
    ...updatedExam,
    title: updatedExam.exam_title,
    challenge_definition_type: payload.challenge_definition_type || 'EVALUATION',
    working_duration_minutes: updatedExam.time_limit_minutes
  };
}

export async function publishAssessment(assessmentId) {
  const sb = await getSupabase();
  try {
    // 1. Fetch assessment and linked topics
    const { data: assessment, error: aErr } = await sb.from('challenge_definitions')
      .select('*, assessment_topics(topic_id)')
      .eq('id', assessmentId)
      .single();

    if (!aErr && assessment) {
      const topicIds = (assessment.assessment_topics || []).map(t => t.topic_id);
      let snapshotCount = 0;
      if (topicIds.length > 0) {
        const { data: questions } = await sb.from('questions')
          .select('*, topics(name)')
          .in('topic_id', topicIds)
          .eq('status', 'active')
          .is('deleted_at', null);

        if (questions && questions.length > 0) {
          await sb.from('challenge_definition_questions').delete().eq('challenge_definition_id', assessmentId);
          let displayOrder = 1;
          const snapshotRows = questions.map(q => ({
            challenge_definition_id: assessmentId,
            question_id: q.id,
            question_text_snapshot: q.question_text,
            accepted_answers_snapshot: Array.isArray(q.accepted_answers) ? q.accepted_answers : [q.correct_answer],
            topic_snapshot: q.topics?.name || 'General',
            question_type_snapshot: q.question_type || null,
            display_order: displayOrder++
          }));
          await sb.from('challenge_definition_questions').insert(snapshotRows);
          snapshotCount = snapshotRows.length;
        }
      }

      // Update status to PUBLISHED
      const { data: updated, error: pubErr } = await sb.from('challenge_definitions')
        .update({ status: 'PUBLISHED' })
        .eq('id', assessmentId)
        .select()
        .single();

      if (!pubErr && updated) {
        clearAdminCache('challenge_definitions');
        return { success: true, assessment: updated, total_questions: snapshotCount };
      }
    }
  } catch (err) {
    console.warn('publishAssessment fallback to legacy exams:', err.message);
  }

  // Fallback to legacy exam publishing
  const { data: updatedExam, error: exErr } = await sb.from('exams')
    .update({ exam_status: 'published' })
    .eq('id', assessmentId)
    .select()
    .single();
  if (exErr) throw exErr;

  const { count } = await sb.from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', assessmentId)
    .is('deleted_at', null);

  clearAdminCache('exams');
  return { success: true, assessment: updatedExam, total_questions: count || 0 };
}

export async function fetchAssessmentQuestions(assessmentId) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('challenge_definition_questions')
      .select('*')
      .eq('challenge_definition_id', assessmentId)
      .order('display_order');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('assessment_questions query fallback to questions:', err.message);
  }

  // Fallback to legacy questions
  const { data: legacyQ } = await sb.from('questions')
    .select('*')
    .eq('exam_id', assessmentId)
    .is('deleted_at', null)
    .order('question_order');

  return (legacyQ || []).map((q, idx) => ({
    id: q.id,
    challenge_definition_id: assessmentId,
    question_id: q.id,
    question_text_snapshot: q.question_text,
    accepted_answers_snapshot: Array.isArray(q.accepted_answers) ? q.accepted_answers : (q.correct_answer ? [q.correct_answer] : []),
    topic_snapshot: 'General',
    question_type_snapshot: q.question_type || null,
    display_order: q.question_order || (idx + 1)
  }));
}

/** Assignments (Batch / Student Access Control) */
export async function assignAssessment(payload) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('challenge_instances')
      .insert({
        challenge_definition_id: payload.challenge_definition_id,
        challenge_instance_type: payload.challenge_instance_type,
        batch_id: payload.challenge_instance_type === 'BATCH' ? payload.batch_id : null,
        student_id: payload.challenge_instance_type === 'STUDENT' ? payload.student_id : null,
        availability_start: payload.availability_start || null,
        availability_end: payload.availability_end || null,
        assigned_by: payload.assigned_by || 'admin',
        status: 'active'
      })
      .select()
      .single();
    if (!error && data) {
      clearAdminCache('challenge_instances');
      return data;
    }
  } catch (err) {
    console.warn('assignAssessment fallback to exam_programs:', err.message);
  }

  // Fallback to legacy exam_programs if batch assignment
  if (payload.challenge_instance_type === 'BATCH' && payload.batch_id) {
    try {
      const { data: batch } = await sb.from('batches').select('program_id').eq('id', payload.batch_id).single();
      if (batch && batch.program_id) {
        await sb.from('exam_programs').insert({
          exam_id: payload.challenge_definition_id,
          program_id: batch.program_id
        });
      }
    } catch (_) {}
  }
  const memItem = {
    id: 'assignment-' + Date.now(),
    ...payload,
    status: 'active',
    created_at: new Date().toISOString()
  };
  if (!MOCK_ADMIN_STORE.assignments) MOCK_ADMIN_STORE.assignments = [];
  MOCK_ADMIN_STORE.assignments.unshift(memItem);
  clearAdminCache('challenge_instances');
  return hydrateMockRelations('challenge_instances', memItem);
}

export async function fetchAssignments(filters = {}) {
  const sb = await getSupabase();
  try {
    let query = sb.from('challenge_instances')
      .select('*, assessments(title, challenge_definition_type), batches(name), students(name)');

    if (filters.challenge_definition_id) query = query.eq('challenge_definition_id', filters.challenge_definition_id);

    const orConditions = [];
    if (filters.batch_id) orConditions.push(`batch_id.eq.${filters.batch_id}`);
    if (filters.batch_ids && Array.isArray(filters.batch_ids) && filters.batch_ids.length > 0) {
      filters.batch_ids.forEach(bId => {
        if (bId) orConditions.push(`batch_id.eq.${bId}`);
      });
    }
    if (filters.student_id) orConditions.push(`student_id.eq.${filters.student_id}`);

    if (orConditions.length > 1) {
      query = query.or(orConditions.join(','));
    } else if (orConditions.length === 1) {
      if (filters.batch_id) query = query.eq('batch_id', filters.batch_id);
      else if (filters.student_id) query = query.eq('student_id', filters.student_id);
      else if (filters.batch_ids && filters.batch_ids.length > 0) query = query.in('batch_id', filters.batch_ids);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('Assignments table query fallback:', err.message);
  }

  // Fallback: derive assignments from live exam_programs and batches
  try {
    const { data: epList } = await sb.from('exam_programs').select('*, exams(id, exam_title, exam_type), programs(id, name)');
    if (epList && epList.length > 0) {
      const { data: batches } = await sb.from('batches').select('id, name, program_id').is('deleted_at', null);
      const derived = [];
      epList.forEach(ep => {
        const matchingBatches = (batches || []).filter(b => b.program_id === ep.program_id);
        matchingBatches.forEach(b => {
          derived.push({
            id: `ep-assign-${ep.exam_id}-${b.id}`,
            challenge_definition_id: ep.exam_id,
            challenge_instance_type: 'BATCH',
            batch_id: b.id,
            status: 'active',
            created_at: ep.created_at || new Date().toISOString(),
            challenge_definitions: { title: ep.exams?.exam_title || 'Evaluation', challenge_definition_type: ep.exams?.exam_type || 'EVALUATION' },
            batches: { name: b.name },
            students: null
          });
        });
      });
      const mem = (MOCK_ADMIN_STORE.assignments || []).map(a => hydrateMockRelations('challenge_instances', a));
      let combined = [...mem, ...derived];
      if (filters.challenge_definition_id) combined = combined.filter(a => a.challenge_definition_id === filters.challenge_definition_id);
      if (filters.batch_id) combined = combined.filter(a => a.batch_id === filters.batch_id);
      if (filters.student_id) combined = combined.filter(a => a.student_id === filters.student_id);
      return combined;
    }
  } catch (_) {}

  return (MOCK_ADMIN_STORE.assignments || []).map(a => hydrateMockRelations('challenge_instances', a));
}

/** Enrollments (Student <-> Batch tracking) */
export async function fetchStudentEnrollments(studentId) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('enrollments')
      .select('*, batches(name, program_id, programs(name))')
      .eq('student_id', studentId)
      .order('joined_at', { ascending: false });
    if (!error && data && data.length > 0) return data;
  } catch (_) {}

  // Fallback: derive enrollment from student record's batch_id
  try {
    const { data: student } = await sb.from('students')
      .select('id, batch_id, batches(name, program_id, programs(name))')
      .eq('id', studentId)
      .single();
    if (student?.batch_id) {
      return [{
        id: 'enrollment-derived-' + studentId,
        student_id: studentId,
        batch_id: student.batch_id,
        status: 'active',
        batches: student.batches
      }];
    }
  } catch (_) {}

  return [];
}

/** Student Assessment Runner & Best Score Recalculator */
export async function recalculateBestScore(studentId, assessmentId) {
  const sb = await getSupabase();
  const { data: attempts, error } = await sb.from('attempts')
    .select('id, score, percentage, effective_score, created_at')
    .eq('student_id', studentId)
    .eq('challenge_definition_id', assessmentId)
    .in('status', ['submitted', 'auto_submitted', 'evaluated', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'])
    .order('percentage', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !attempts || !attempts.length) return null;

  const bestAttemptId = attempts[0].id;
  for (const a of attempts) {
    await sb.from('attempts')
      .update({ is_best_score: a.id === bestAttemptId })
      .eq('id', a.id);
  }
  return attempts[0];
}

/** Aliases for backward compatibility with existing views */
export const startAssessment = startExam;
export const submitAssessment = submitExam;

// ============================================================
// ABCD MIGRATION — PHASE 6 & 9 CORE ENDPOINTS
// ============================================================

/** Classes (Phase 6) */
export async function fetchClasses(forceRefresh = false) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('classes')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return data;
}

/** Class Instances (Phase 6) */
export async function fetchClassInstances(batchId = null) {
  const sb = await getSupabase();
  let query = sb.from('class_instances').select('*, classes(name), batches(name)');
  if (batchId) query = query.eq('batch_id', batchId);
  const { data, error } = await query.is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchClassInstanceRoster(classInstanceId) {
  const sb = await getSupabase();
  
  // 1. Fetch the class instance to get batch_id and start_date
  const { data: ci, error: ciErr } = await sb.from('class_instances')
    .select('batch_id, start_date')
    .eq('id', classInstanceId)
    .single();
    
  if (ciErr || !ci) throw new Error('Class Instance not found');

  // 2. Fetch Auto-enrolled students (joined batch before/on start_date)
  const { data: autoStudents, error: autoErr } = await sb.from('students')
    .select('*')
    .eq('batch_id', ci.batch_id)
    .lte('batch_joined_at', ci.start_date ? ci.start_date + 'T23:59:59Z' : new Date().toISOString())
    .is('deleted_at', null)
    .order('name');
    
  if (autoErr) throw autoErr;

  // 3. Fetch Manually added / Migrated students (from additional_members)
  const { data: addMembers, error: addErr } = await sb.from('additional_members')
    .select('..., students(*)')
    .eq('class_instance_id', classInstanceId);
    
  if (addErr) throw addErr;

  // 4. Merge and deduplicate
  const rosterMap = new Map();
  
  (autoStudents || []).forEach(s => {
    rosterMap.set(s.id, { ...s, enrollment_type: 'auto' });
  });
  
  (addMembers || []).forEach(am => {
    if (am.students && !rosterMap.has(am.students.id)) {
      rosterMap.set(am.students.id, { ...am.students, enrollment_type: 'manual' });
    }
  });

  return Array.from(rosterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addAdditionalMember(classInstanceId, studentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('additional_members')
    .insert([{ class_instance_id: classInstanceId, student_id: studentId }])
    .select();
  if (error) throw error;
  return data;
}


/** Class Meetings (Phase 6) */
export async function fetchClassMeetings(classInstanceId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('class_meetings')
    .select('*')
    .eq('class_instance_id', classInstanceId)
    .order('scheduled_date');
  if (error) throw error;
  return data;
}



export async function fetchChallengeDefinitionTopics(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('challenge_definition_topics').select('topic_id').eq('challenge_definition_id', id);
  if (error) throw error;
  return (data || []).map(d => d.topic_id);
}

export async function createChallengeDefinition(payload, topicIds = []) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('challenge_definitions')
    .insert({
      class_id: payload.class_id,
      title: payload.title.trim(),
      description: payload.description || null,
      challenge_type: payload.challenge_type || 'EVALUATION',
      status: payload.status || 'DRAFT',
      question_order: payload.question_order || 'RANDOM',
      working_duration_minutes: payload.working_duration_minutes || 60,
      default_max_attempts: payload.default_max_attempts || null,
      created_by: payload.created_by || 'admin'
    })
    .select()
    .single();
  if (error) throw error;

  if (topicIds && topicIds.length > 0) {
    const topicInserts = topicIds.map(tid => ({
      challenge_definition_id: data.id,
      topic_id: tid
    }));
    await sb.from('challenge_definition_topics').insert(topicInserts);
  }

  return data;
}

export async function updateChallengeDefinition(id, payload, topicIds = null) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('challenge_definitions')
    .update({
      title: payload.title.trim(),
      description: payload.description || null,
      challenge_type: payload.challenge_type || 'EVALUATION',
      status: payload.status || 'DRAFT',
      question_order: payload.question_order || 'RANDOM',
      working_duration_minutes: payload.working_duration_minutes || 60,
      default_max_attempts: payload.default_max_attempts || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  if (topicIds !== null) {
    await sb.from('challenge_definition_topics').delete().eq('challenge_definition_id', id);
    if (topicIds.length > 0) {
      const topicInserts = topicIds.map(tid => ({
        challenge_definition_id: id,
        topic_id: tid
      }));
      await sb.from('challenge_definition_topics').insert(topicInserts);
    }
  }
  return data;
}

export async function publishChallengeDefinition(id) {
  const sb = await getSupabase();
  const { data: topics, error: tErr } = await sb.from('challenge_definition_topics')
    .select('topic_id')
    .eq('challenge_definition_id', id);
  if (tErr) throw tErr;
  
  let questionIds = [];
  if (topics && topics.length > 0) {
    const tIds = topics.map(t => t.topic_id);
    const { data: qData, error: qErr } = await sb.from('questions')
      .select('id')
      .in('topic_id', tIds)
      .is('deleted_at', null)
      .eq('is_active', true);
    if (qErr) throw qErr;
    questionIds = (qData || []).map(q => q.id);
  }
  
  if (questionIds.length > 0) {
    await sb.from('challenge_definition_questions').delete().eq('challenge_definition_id', id);
    const inserts = questionIds.map(qid => ({
      challenge_definition_id: id,
      question_id: qid
    }));
    await sb.from('challenge_definition_questions').insert(inserts);
  }

  const { data, error } = await sb.from('challenge_definitions')
    .update({ status: 'READY', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, _frozenCount: questionIds.length };
}

/** Challenge Instances (Phase 9) */
export async function fetchChallengeInstances(classInstanceId = null) {
  const sb = await getSupabase();
  let query = sb.from('challenge_instances').select('*, challenge_definitions(title, challenge_type), class_instances(batches(name), classes(name))').is('deleted_at', null);
  if (classInstanceId) query = query.eq('class_instance_id', classInstanceId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createChallengeInstance(payload) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('challenge_instances')
    .insert({
      class_instance_id: payload.class_instance_id,
      challenge_definition_id: payload.challenge_definition_id,
      title_override: payload.title_override || null,
      availability_start: payload.availability_start || null,
      availability_end: payload.availability_end || null,
      working_duration_minutes: payload.working_duration_minutes || 60,
      max_attempts: payload.max_attempts || null,
      status: payload.status || 'DRAFT',
      assigned_by: payload.assigned_by || 'admin'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function startChallengeAttempt(studentId, challengeInstanceId) {
  const sb = await getSupabase();

  // 1. Fetch Challenge Instance and Definition Details
  const { data: instData, error: instErr } = await sb.from('challenge_instances')
    .select('*, challenge_definitions(*)')
    .eq('id', challengeInstanceId)
    .single();

  if (instErr || !instData) throw new Error('Challenge instance not found.');
  const definition = instData.challenge_definitions;

  // 2. Determine max attempts
  const maxAttempts = instData.max_attempts || definition.default_max_attempts || 1;

  // 3. Check existing attempts
  const { data: existAtt, error: existErr } = await sb.from('challenge_attempts')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('challenge_instance_id', challengeInstanceId)
    .order('created_at', { ascending: false });

  if (!existErr && existAtt && existAtt.length > 0) {
    const inProgress = existAtt.find(a => a.status === 'IN_PROGRESS');
    if (inProgress) {
      return { attemptId: inProgress.id, status: 'RESUMED' }; // Resume existing
    }
    if (existAtt.length >= maxAttempts) {
      throw new Error(`Maximum attempts (${maxAttempts}) reached for this challenge.`);
    }
  }

  // 4. Create new attempt
  const duration = instData.working_duration_minutes || definition.working_duration_minutes || 60;
  const now = new Date();
  const deadline = new Date(now.getTime() + duration * 60000);

  const { data: newAtt, error: attErr } = await sb.from('challenge_attempts')
    .insert({
      student_id: studentId,
      challenge_instance_id: challengeInstanceId,
      status: 'IN_PROGRESS',
      expected_end_at: deadline.toISOString(),
      score: 0,
      percentage: 0
    })
    .select()
    .single();

  if (attErr) throw attErr;

  // 5. Build snapshots from definitions
  const { data: defQuestions, error: qErr } = await sb.from('challenge_definition_questions')
    .select('question_id, questions(question_text, topic_id, question_type, correct_answer, topics(name))')
    .eq('challenge_definition_id', definition.id);

  if (qErr) throw qErr;

  const answerInserts = (defQuestions || []).map(dq => {
    const q = dq.questions;
    let acceptedAnswers = [];
    if (q.correct_answer) {
      acceptedAnswers = q.correct_answer.split(/[\/;]/).map(s => s.trim()).filter(Boolean);
    }

    return {
      challenge_attempt_id: newAtt.id,
      question_id: dq.question_id,
      question_snapshot: JSON.stringify(q),
      topic_snapshot: q.topics?.name || '',
      question_type_snapshot: q.question_type || '',
      accepted_answers_snapshot: JSON.stringify(acceptedAnswers),
      correct_answer_snapshot: q.correct_answer || '',
      student_answer: '',
      is_correct: false,
      score: 0,
      evaluation_result: null
    };
  });

  if (answerInserts.length > 0) {
    const { error: insErr } = await sb.from('challenge_attempt_answers').insert(answerInserts);
    if (insErr) throw insErr;
  }

  return { attemptId: newAtt.id, status: 'STARTED' };
}

export async function submitChallengeAttempt(attemptId, answersMap, options = {}) {
  const sb = await getSupabase();

  // 1. Fetch the attempt to ensure it's valid and not already submitted
  const { data: att, error: attErr } = await sb.from('challenge_attempts')
    .select('*, challenge_instances(*)')
    .eq('id', attemptId)
    .single();

  if (attErr || !att) throw new Error('Attempt not found.');
  if (att.status !== 'IN_PROGRESS') throw new Error(`Attempt already ${att.status}`);

  // 2. Fetch all pre-existing challenge_attempt_answers to evaluate
  const { data: attemptAnswers, error: fetchErr } = await sb.from('challenge_attempt_answers')
    .select('*')
    .eq('challenge_attempt_id', attemptId);

  if (fetchErr) throw fetchErr;

  let totalPoints = 0;
  let correctCount = 0;
  let maxPoints = attemptAnswers?.length || 1; // prevent div by zero

  const evalTasks = [];

  for (const a of (attemptAnswers || [])) {
    // Determine the student answer provided in answersMap
    // answersMap could be keyed by question_id or answer_id. We'll check both.
    let studentAns = answersMap[a.question_id] || answersMap[a.id];
    
    // If it's an object from UI (like in some versions), extract value
    if (studentAns && typeof studentAns === 'object') {
      studentAns = studentAns.student_answer || studentAns.answerText || '';
    } else if (studentAns === undefined || studentAns === null) {
      studentAns = '';
    }

    // Default to Incorrect
    let isCorrect = false;
    let evalResult = 'incorrect';
    let similarityScore = 0;
    let score = 0;

    let accepted = [];
    try {
      if (a.accepted_answers_snapshot) {
        if (typeof a.accepted_answers_snapshot === 'string') {
          accepted = JSON.parse(a.accepted_answers_snapshot);
        } else {
          accepted = a.accepted_answers_snapshot;
        }
      }
    } catch(e) {}

    const cleanInput = (str) => (str || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanStudent = cleanInput(studentAns);

    if (cleanStudent) {
      for (const validAns of accepted) {
        const cleanValid = cleanInput(validAns);
        if (cleanValid && cleanValid === cleanStudent) {
          isCorrect = true;
          evalResult = 'correct';
          similarityScore = 1.0;
          score = 1;
          break;
        }
      }
    }

    if (isCorrect) {
      totalPoints += 1;
      correctCount += 1;
    }

    evalTasks.push(
      sb.from('challenge_attempt_answers')
        .update({
          student_answer: studentAns,
          is_correct: isCorrect,
          evaluation_result: evalResult,
          similarity_score: similarityScore,
          score: score,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', a.id)
    );
  }

  // Await all answer evaluations
  if (evalTasks.length > 0) {
    await Promise.all(evalTasks);
  }

  const percentage = Math.round((totalPoints / maxPoints) * 100);

  // 3. Update Attempt Status
  const { data: updatedAtt, error: upErr } = await sb.from('challenge_attempts')
    .update({
      status: options.isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED',
      score: totalPoints,
      percentage: percentage,
      submitted_at: new Date().toISOString()
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (upErr) throw upErr;
  return updatedAtt;
}


