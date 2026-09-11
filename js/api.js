// TOP ENGLISH CLASS — API Module
// All server calls are centralized here.
import { getSupabase, SUPABASE_URL } from './supabase.js';
import { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens } from './grading.js';

export { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens };

// ============================================================
// AUTH / LOGIN
// ============================================================

// Mock data for development / offline / demo environment
const MOCK_PROGRAMS = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'General English Program' },
  { id: '11111111-1111-1111-1111-222222222222', name: 'Academic English Program' }
];

const MOCK_CLASSES = [
  { id: '22222222-2222-2222-2222-222222222222', program_id: '11111111-1111-1111-1111-111111111111', name: 'Class A' },
  { id: '22222222-2222-2222-2222-333333333333', program_id: '11111111-1111-1111-1111-111111111111', name: 'Class B' }
];

/**
 * Format student name with honorific title: Miss for female, Mr. for male.
 * Strips pre-existing titles to avoid duplication.
 */
export function formatStudentName(name, gender) {
  if (!name) return '';
  const clean = String(name).trim().replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, '').trim();
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
  { id: 'bbbbbbbb-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-A' },
  { id: 'bbbbbbbb-1111-1111-1111-111111111112', class_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-B' },
  { id: 'bbbbbbbb-2222-2222-2222-111111111111', class_id: '22222222-2222-2222-2222-333333333333', name: 'Batch 2026-A' }
];

const MOCK_STUDENTS = [
  { id: '55555555-5555-5555-5555-555555555555', program_id: '11111111-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'John Doe', gender: 'male', is_active: true, pin_hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4' }, // PIN: 1234
  { id: '55555555-5555-5555-5555-666666666666', program_id: '11111111-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'Jane Smith', gender: 'female', is_active: true, pin_hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4' }
];


async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isPlaceholderUrl() {
  return !SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT');
}

export async function testSupabaseConnection() {
  if (isPlaceholderUrl()) return { connected: false, error: 'Placeholder URL' };
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('programs').select('id').limit(1);
    return { connected: !error, error };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

/** Fetch all active programs for login step 1 (alphabetical order) */
export async function fetchPrograms() {
  let list = MOCK_PROGRAMS;
  if (!isPlaceholderUrl()) {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.from('programs')
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
}

/** Fetch all active classes for a program (alphabetical order) */
export async function fetchClasses(programId) {
  let list = MOCK_CLASSES.filter(c => c.program_id === programId);
  if (!isPlaceholderUrl()) {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.from('classes')
        .select('id, name, program_id')
        .eq('program_id', programId)
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
}

/** Fetch all active batches for a class (alphabetical order) */
export async function fetchBatches(classId) {
  let list = MOCK_BATCHES.filter(b => b.class_id === classId);
  if (!isPlaceholderUrl()) {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.from('batches')
        .select('id, name, class_id')
        .eq('class_id', classId)
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
}

/** Fetch students by class and optional batch — formatted with Miss/Mr. titles in alphabetical order */
export async function fetchStudentsByClass(classId, batchId = null) {
  let list = MOCK_STUDENTS.filter(s => s.class_id === classId && (!batchId || s.batch_id === batchId));
  if (!isPlaceholderUrl()) {
    try {
      const sb = await getSupabase();
      let query = sb.from('students')
        .select('id, name, gender, class_id, batch_id')
        .eq('class_id', classId)
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
export async function verifyStudentLogin({ programId, classId, batchId, studentId, pin }) {
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
    const edgeRes = await callEdgeFunction('student-login', { programId, classId, batchId, studentId, pin });
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
      .select('id, name, gender, pin_hash, is_active, class_id, program_id, batch_id')
      .eq('id', studentId)
      .single();

    if (error || !student) throw new Error('Student not found.');
    if (!student.is_active) throw new Error('This student account is inactive.');
    if (student.class_id !== classId) throw new Error('Student does not belong to the selected class.');
    if (student.program_id !== programId) throw new Error('Student does not belong to the selected program.');
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

  const rawClean = (st?.name || '').replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, '').trim();
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

/** Fetch subjects accessible by the student (directly by program_id or class) */
export async function fetchStudentSubjects(classId, programId) {
  const sb = await getSupabase();
  // 1. Direct program lookup (recommended: subjects inherit from program)
  if (programId) {
    const { data, error } = await sb.from('subjects')
      .select('id, name')
      .eq('program_id', programId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    if (!error && data && data.length > 0) return data;
  }
  // 2. Class lookup to resolve program_id
  if (classId) {
    const { data: cls } = await sb.from('classes')
      .select('program_id')
      .eq('id', classId)
      .single();
    if (cls?.program_id) {
      const { data, error } = await sb.from('subjects')
        .select('id, name')
        .eq('program_id', cls.program_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (!error && data && data.length > 0) return data;
    }
    // 3. Fallback: class_subjects junction table if it exists
    try {
      const { data, error } = await sb.from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      if (!error && data && data.length > 0) {
        return data.map(r => r.subjects).filter(Boolean);
      }
    } catch(e) {}
  }
  return [];
}

/** Fetch levels for a subject */
export async function fetchLevels(subjectId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('levels')
    .select('id, name, level_number')
    .eq('subject_id', subjectId)
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
export async function fetchExamsForStudentLevel(classId, levelId, programId) {
  const sb = await getSupabase();
  let query = sb.from('exams')
    .select('*')
    .eq('level_id', levelId)
    .eq('exam_status', 'published')
    .is('deleted_at', null)
    .order('exam_title');

  if (programId) {
    query = query.eq('program_id', programId);
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
        .eq('level_id', levelId)
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
export async function fetchExamsForStudentSubject(classId, subjectId, programId) {
  const sb = await getSupabase();
  let query = sb.from('exams')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('exam_status', 'published')
    .is('deleted_at', null)
    .order('exam_title');

  if (programId) {
    query = query.eq('program_id', programId);
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
        .eq('subject_id', subjectId)
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
    .select('id, exam_id, score, percentage, grade, submitted_at, exams(exam_title, exam_type)')
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

  // 1. Fetch exam details
  const { data: exam, error: examErr } = await sb.from('exams').select('*').eq('id', examId).single();
  if (examErr || !exam) throw new Error('Exam not found.');

  // 2. Check for an existing in-progress attempt
  const { data: existingAttempts } = await sb.from('attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('exam_id', examId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false });

  let attempt = existingAttempts?.[0];

  if (!attempt) {
    // Create new attempt
    const timeLimit = exam.time_limit_minutes || 30;
    const now = new Date();
    const expectedEnd = new Date(now.getTime() + timeLimit * 60000);

    const { data: newAttempt, error: createErr } = await sb.from('attempts')
      .insert({
        student_id: studentId,
        exam_id: examId,
        started_at: now.toISOString(),
        expected_end_at: expectedEnd.toISOString(),
        status: 'in_progress',
        score: 0,
        percentage: 0,
        grade: 'F'
      })
      .select()
      .single();

    if (createErr) throw createErr;
    attempt = newAttempt;

    // Fetch questions and create attempt_answers snapshots
    const { data: questions } = await sb.from('questions')
      .select('*')
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order');

    if (questions && questions.length > 0) {
      const answerRows = questions.map((q, idx) => ({
        attempt_id: attempt.id,
        question_id: q.id,
        question_snapshot: {
          question_text: q.question_text,
          answer_type: q.answer_type || exam.answer_type || 'written',
          correct_answer: q.correct_answer || '',
          options_json: q.options_json,
          question_order: q.question_order ?? (idx + 1)
        },
        options_snapshot: q.options_json,
        correct_answer_snapshot: q.correct_answer || '',
        student_answer: null,
        score: 0
      }));

      await sb.from('attempt_answers').insert(answerRows);
    }
  }

  // Fetch attempt answers for execution UI
  let { data: answers } = await sb.from('attempt_answers')
    .select('*')
    .eq('attempt_id', attempt.id);

  // Self-heal: If attempt exists (e.g. resumed attempt) but has no attempt_answers snapshots, backfill them now
  if (!answers || answers.length === 0) {
    const { data: questions } = await sb.from('questions')
      .select('*')
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order');

    if (questions && questions.length > 0) {
      const answerRows = questions.map((q, idx) => ({
        attempt_id: attempt.id,
        question_id: q.id,
        question_snapshot: {
          question_text: q.question_text,
          answer_type: q.answer_type || exam.answer_type || 'written',
          correct_answer: q.correct_answer || '',
          options_json: q.options_json,
          question_order: q.question_order ?? (idx + 1)
        },
        options_snapshot: q.options_json,
        correct_answer_snapshot: q.correct_answer || '',
        student_answer: null,
        score: 0
      }));

      await sb.from('attempt_answers').insert(answerRows);

      const { data: refetched } = await sb.from('attempt_answers')
        .select('*')
        .eq('attempt_id', attempt.id);
      answers = refetched;
    }
  }

  // Ensure deterministic ordering by question_order or created_at
  if (answers && answers.length > 0) {
    answers.sort((a, b) => {
      const orderA = a.question_snapshot?.question_order;
      const orderB = b.question_snapshot?.question_order;
      if (orderA != null && orderB != null) return orderA - orderB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  return {
    success: true,
    attempt: attempt,
    exam: exam,
    answers: answers || [],
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
    // Authoritative grading with multiple valid answers and hyphen tolerance
    const evalRes = evaluateAnswer(a.student_answer, a.correct_answer_snapshot, answerType);
    totalPoints += evalRes.score;
    evalTasks.push(
      sb.from('attempt_answers').update({ score: evalRes.score, evaluation_result: evalRes.result }).eq('id', a.id)
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
      percentage,
      grade,
      effective_score: percentage
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (updateErr) throw updateErr;

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
      id, status, score, percentage, grade, submitted_at, started_at, expected_end_at,
      exams(exam_type, exam_title, answer_type, subjects(name), levels(name))
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
    .select('*')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return data;
}

// ============================================================
// ADMIN — Programs, Classes, Subjects, Levels
// ============================================================

// In-memory mock store for admin console demo when Supabase is not connected
const MOCK_ADMIN_STORE = {
  programs: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'General English Program', is_active: true, created_at: '2026-01-10T08:00:00Z' },
    { id: '11111111-1111-1111-1111-222222222222', name: 'Academic English Program', is_active: true, created_at: '2026-01-15T08:00:00Z' }
  ],
  classes: [
    { id: '22222222-2222-2222-2222-222222222222', program_id: '11111111-1111-1111-1111-111111111111', name: 'Class A', is_active: true, created_at: '2026-01-20T08:00:00Z' },
    { id: '22222222-2222-2222-2222-333333333333', program_id: '11111111-1111-1111-1111-111111111111', name: 'Class B', is_active: true, created_at: '2026-01-22T08:00:00Z' },
    { id: '22222222-2222-2222-2222-444444444444', program_id: '11111111-1111-1111-1111-222222222222', name: 'Class C (IELTS Prep)', is_active: true, created_at: '2026-01-25T08:00:00Z' }
  ],
  subjects: [
    { id: '33333333-3333-3333-3333-333333333333', program_id: '11111111-1111-1111-1111-111111111111', name: 'English Grammar & Vocabulary', is_active: true, created_at: '2026-01-12T08:00:00Z' },
    { id: '33333333-3333-3333-3333-444444444444', program_id: '11111111-1111-1111-1111-111111111111', name: 'Conversational Speaking', is_active: true, created_at: '2026-01-14T08:00:00Z' }
  ],
  levels: [
    { id: '44444444-4444-4444-4444-444444444444', subject_id: '33333333-3333-3333-3333-333333333333', name: 'Level 1 - Beginner', level_number: 1, is_active: true, created_at: '2026-01-16T08:00:00Z' },
    { id: '44444444-4444-4444-4444-555555555555', subject_id: '33333333-3333-3333-3333-333333333333', name: 'Level 2 - Intermediate', level_number: 2, is_active: true, created_at: '2026-01-18T08:00:00Z' }
  ],
  class_subjects: [
    { class_id: '22222222-2222-2222-2222-222222222222', subject_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-02-01T08:00:00Z' },
    { class_id: '22222222-2222-2222-2222-333333333333', subject_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-02-01T08:00:00Z' }
  ],
  batches: [
    { id: 'bbbbbbbb-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-A', is_active: true, created_at: '2026-01-26T08:00:00Z' },
    { id: 'bbbbbbbb-1111-1111-1111-111111111112', class_id: '22222222-2222-2222-2222-222222222222', name: 'Batch 2026-B', is_active: true, created_at: '2026-01-28T08:00:00Z' },
    { id: 'bbbbbbbb-2222-2222-2222-111111111111', class_id: '22222222-2222-2222-2222-333333333333', name: 'Batch 2026-A', is_active: true, created_at: '2026-01-29T08:00:00Z' }
  ],
  students: [
    { id: '55555555-5555-5555-5555-555555555555', program_id: '11111111-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'John Doe', gender: 'male', birth_date: '2008-05-14', is_active: true, created_at: '2026-02-02T08:00:00Z' },
    { id: '55555555-5555-5555-5555-666666666666', program_id: '11111111-1111-1111-1111-111111111111', class_id: '22222222-2222-2222-2222-222222222222', batch_id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'Jane Smith', gender: 'female', birth_date: '2009-08-21', is_active: true, created_at: '2026-02-03T08:00:00Z' }
  ],
  exams: [
    { id: '66666666-6666-6666-6666-666666666666', program_id: '11111111-1111-1111-1111-111111111111', subject_id: '33333333-3333-3333-3333-333333333333', level_id: '44444444-4444-4444-4444-444444444444', exam_type: 'MIDTERM', exam_title: 'Grammar Basics Exam', answer_type: 'multiple_choice', exam_status: 'published', question_order: 'sequential', time_limit_minutes: 15, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-05T08:00:00Z' },
    { id: '66666666-6666-6666-6666-777777777777', program_id: '11111111-1111-1111-1111-111111111111', subject_id: '33333333-3333-3333-3333-333333333333', level_id: '44444444-4444-4444-4444-444444444444', exam_type: 'QUIZ', exam_title: 'Vocabulary Weekly Sprint', answer_type: 'written', exam_status: 'published', question_order: 'sequential', time_limit_minutes: 20, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-08T08:00:00Z' }
  ],
  exam_classes: [
    { exam_id: '66666666-6666-6666-6666-666666666666', class_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-06T08:00:00Z' },
    { exam_id: '66666666-6666-6666-6666-777777777777', class_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-09T08:00:00Z' }
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
    { id: 'aaaa1111-aaaa-1111-aaaa-111111111111', student_id: '55555555-5555-5555-5555-555555555555', subject_id: '33333333-3333-3333-3333-333333333333', level_id: '44444444-4444-4444-4444-444444444444', is_unlocked: true, is_completed: true, completed_at: '2026-02-10T10:30:00Z', created_at: '2026-02-01T08:00:00Z' },
    { id: 'aaaa1111-aaaa-1111-aaaa-222222222222', student_id: '55555555-5555-5555-5555-555555555555', subject_id: '33333333-3333-3333-3333-333333333333', level_id: '44444444-4444-4444-4444-555555555555', is_unlocked: true, is_completed: false, created_at: '2026-02-10T10:31:00Z' }
  ],
  audit_logs: [
    { id: '77777777-7777-7777-7777-777777777777', actor_role: 'ADMIN', action: 'LOGIN', entity_type: 'auth', ip_address: '127.0.0.1', created_at: new Date().toISOString() }
  ]
};

function hydrateMockRelations(table, item) {
  if (!item) return item;
  const clone = { ...item };
  const store = MOCK_ADMIN_STORE;
  
  if (table === 'subjects') {
    clone.programs = store.programs.find(p => p.id === clone.program_id) || null;
  } else if (table === 'levels') {
    const subj = store.subjects.find(s => s.id === clone.subject_id);
    clone.subjects = subj ? { ...subj, program_id: subj.program_id } : null;
  } else if (table === 'classes') {
    clone.programs = store.programs.find(p => p.id === clone.program_id) || null;
  } else if (table === 'batches') {
    const cls = store.classes.find(c => c.id === clone.class_id);
    clone.classes = cls ? { ...cls, programs: store.programs.find(p => p.id === cls.program_id) } : null;
  } else if (table === 'students') {
    clone.classes = store.classes.find(c => c.id === clone.class_id) || null;
    clone.programs = store.programs.find(p => p.id === clone.program_id) || null;
    clone.batches = store.batches.find(b => b.id === clone.batch_id) || null;
  } else if (table === 'exams') {
    clone.programs = store.programs.find(p => p.id === clone.program_id) || null;
    clone.subjects = store.subjects.find(s => s.id === clone.subject_id) || null;
    clone.levels = store.levels.find(l => l.id === clone.level_id) || null;
  } else if (table === 'questions') {
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'class_subjects') {
    const cls = store.classes.find(c => c.id === clone.class_id);
    clone.classes = cls ? { ...cls, programs: store.programs.find(p => p.id === cls.program_id) } : null;
    clone.subjects = store.subjects.find(s => s.id === clone.subject_id) || null;
  } else if (table === 'exam_classes') {
    const cls = store.classes.find(c => c.id === clone.class_id);
    clone.classes = cls ? { ...cls, programs: store.programs.find(p => p.id === cls.program_id) } : null;
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'attempts') {
    const st = store.students.find(s => s.id === clone.student_id);
    clone.students = st ? { ...st, classes: store.classes.find(c => c.id === st.class_id) } : null;
    clone.exams = store.exams.find(e => e.id === clone.exam_id) || null;
  } else if (table === 'progress') {
    const st = store.students.find(s => s.id === clone.student_id);
    clone.students = st ? { ...st, classes: store.classes.find(c => c.id === st.class_id) } : null;
    clone.subjects = store.subjects.find(s => s.id === clone.subject_id) || null;
    clone.levels = store.levels.find(l => l.id === clone.level_id) || null;
  }
  return clone;
}

export async function adminFetchAll(table, select = '*', filters = {}) {
  const normTable = table.replace('-', '_');
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
    if (!['class_subjects', 'exam_classes', 'attempts', 'attempt_answers', 'progress', 'audit_logs', 'site_settings'].includes(normTable)) {
      query = query.is('deleted_at', null);
    }
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
    const { data, error } = await query;
    if (error) throw error;
    let list = data || [];

    // Hydrate exams with class_id, prerequisite_exam_id, exam_order
    if (normTable === 'exams' && list.length > 0) {
      try {
        const [ecRes, auditRes] = await Promise.all([
          sb.from('exam_classes').select('*'),
          sb.from('audit_logs').select('entity_id, new_value, created_at').eq('entity_type', 'exam').eq('action', 'exam_metadata')
        ]);
        const ecList = ecRes.data || [];
        const logsList = auditRes.data || [];
        list.forEach(r => {
          if (!r.class_id) {
            const match = ecList.find(c => c.exam_id === r.id);
            if (match) r.class_id = match.class_id;
          }
          const examLogs = logsList.filter(l => l.entity_id === r.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (examLogs.length > 0 && examLogs[0].new_value) {
            const nv = examLogs[0].new_value;
            if (!r.prerequisite_exam_id && nv.prerequisite_exam_id) r.prerequisite_exam_id = nv.prerequisite_exam_id;
            if (!r.exam_order && nv.exam_order) r.exam_order = nv.exam_order;
            if (!r.class_id && nv.class_id) r.class_id = nv.class_id;
          }
          if (!r.exam_order) r.exam_order = '1';
        });
      } catch (hydrationErr) {
        console.warn('Metadata hydration warning:', hydrationErr.message);
      }
    }
    return list;
  } catch(e) {
    console.warn(`Supabase query failed for ${table}, using mock store:`, e.message);
    let rows = MOCK_ADMIN_STORE[normTable] || [];
    for (const [key, val] of Object.entries(filters)) {
      rows = rows.filter(r => r[key] === val);
    }
    return rows.map(r => hydrateMockRelations(normTable, r));
  }
}

export async function adminInsert(table, payload) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const newItem = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
    if (!MOCK_ADMIN_STORE[normTable]) MOCK_ADMIN_STORE[normTable] = [];
    MOCK_ADMIN_STORE[normTable].unshift(newItem);
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
        delete fallback.class_id;
        delete fallback.prerequisite_exam_id;
        delete fallback.prerequisite_min_score;
        delete fallback.exam_order;
      } else if (normTable === 'students') {
        delete fallback.level_id;
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
      if (payload.class_id) {
        await sb.from('exam_classes').insert({ exam_id: data.id, class_id: payload.class_id });
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
          class_id: payload.class_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Exam metadata auxiliary save notice:', auxErr.message);
    }
  }

  // Sync Student Level to Progress table (Phase 4)
  if (normTable === 'students' && data?.id && payload.level_id) {
    try {
      const { data: cls } = await sb.from('classes').select('program_id').eq('id', data.class_id).single();
      const progId = cls?.program_id || data.program_id;
      const { data: subjs } = await sb.from('subjects').select('id').eq('program_id', progId).is('deleted_at', null);
      if (subjs && subjs.length > 0) {
        for (const s of subjs) {
          await sb.from('progress').upsert({
            student_id: data.id,
            subject_id: s.id,
            level_id: payload.level_id,
            is_unlocked: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_id,subject_id,level_id' });
        }
      }
    } catch (progErr) {
      console.warn('Student progress auto-sync notice:', progErr.message);
    }
  }

  return data;
}

export async function adminUpdate(table, id, payload) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      return list[idx];
    }
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
        delete fallback.class_id;
        delete fallback.prerequisite_exam_id;
        delete fallback.prerequisite_min_score;
        delete fallback.exam_order;
      } else if (normTable === 'students') {
        delete fallback.level_id;
      } else if (normTable === 'questions') {
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
      if (payload.class_id) {
        await sb.from('exam_classes').delete().eq('exam_id', id);
        await sb.from('exam_classes').insert({ exam_id: id, class_id: payload.class_id });
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
          class_id: payload.class_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Exam metadata auxiliary save notice:', auxErr.message);
    }
  }

  // Sync Student Level to Progress table (Phase 4)
  if (normTable === 'students' && payload.level_id) {
    try {
      const studentClassId = payload.class_id || data?.class_id;
      const { data: cls } = await sb.from('classes').select('program_id').eq('id', studentClassId).single();
      const progId = cls?.program_id || payload.program_id;
      const { data: subjs } = await sb.from('subjects').select('id').eq('program_id', progId).is('deleted_at', null);
      if (subjs && subjs.length > 0) {
        for (const s of subjs) {
          await sb.from('progress').upsert({
            student_id: id,
            subject_id: s.id,
            level_id: payload.level_id,
            is_unlocked: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'student_id,subject_id,level_id' });
        }
      }
    } catch (progErr) {
      console.warn('Student progress update notice:', progErr.message);
    }
  }

  return data;
}

export async function adminSoftDelete(table, id) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
    return;
  }
  // Real Supabase — throw on error
  const sb = await getSupabase();
  const { error } = await sb.from(normTable).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.error(`Supabase SOFT DELETE failed on ${normTable} id=${id}:`, error);
    throw new Error(`DB Error (${normTable}): ${error.message || error.code || 'Unknown error'}`);
  }
}

export async function adminHardDelete(table, id) {
  const normTable = table.replace('-', '_');
  if (isPlaceholderUrl()) {
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
    return;
  }
  try {
    const sb = await getSupabase();
    const { error } = await sb.from(normTable).delete().eq('id', id);
    if (error) throw error;
  } catch(err) {
    console.warn(`Supabase hard delete failed for ${normTable}, falling back to mock store:`, err.message);
    const list = MOCK_ADMIN_STORE[normTable] || [];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
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
    const key = `${s.class_id}::${(s.name || '').toLowerCase().trim()}`;
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
        const primaryHasSubject = allProgress.some(p => p.student_id === primary.id && p.subject_id === dp.subject_id);
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
    .select('id, exam_title, display_name, minimum_required_score, subject_id, level_id, program_id')
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
    .select('*, students(id, name, gender, class_id, classes(name))')
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
    const className = attempt.students?.classes?.name || '—';
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
      className,
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
    if (preview.exam.subject_id && preview.exam.level_id) {
      const isPassed = diff.newStatus === 'PASS';
      try {
        await sb.from('progress').upsert({
          student_id: diff.studentId,
          subject_id: preview.exam.subject_id,
          level_id: preview.exam.level_id,
          is_unlocked: true,
          is_completed: isPassed,
          completed_at: isPassed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'student_id,subject_id,level_id' });
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
