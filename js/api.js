// TOPS CORE — API Module
// All server calls are centralized here.
import { getSupabase, SUPABASE_URL, callEdgeFunction } from './supabase.js';
import { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens } from './grading.js';

export { evaluateAnswer, calculatePercentage, isPassing, calculateGrade, parseCorrectAnswers, stripHyphens, callEdgeFunction };

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
          .select('id, name, institution_id, is_active')
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

export async function updateStudentEducation(studentId, educationLevel) {
  if (!educationLevel) throw new Error('Education level is required');
  if (isPlaceholderUrl()) return { success: true };

  const sb = await getSupabase();
  const { error } = await sb
    .from('students')
    .update({ 
      education: educationLevel,
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

/** Fetch Classes accessible by the student (directly by institution_id or class) */
export async function fetchStudentClasses(programId, institutionId) {
  const sb = await getSupabase();
  // 1. Check for global Classes first or fallback
  try {
    const { data: globalSubjs, error: gErr } = await sb.from('classes')
      .select('id, name, code, description')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    if (!gErr && globalSubjs && globalSubjs.length > 0) return globalSubjs;
  } catch (e) {
    console.warn('Global Classes query note:', e.message);
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

/** Fetch levels for a Class */
export async function fetchLevels(ClassId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('levels')
    .select('id, name, level_number')
    .eq('class_id', ClassId)
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

/** Fetch published assessments available for a specific level */
export async function fetchAssessmentsForStudentLevel(programId, levelId, institutionId) {
  const sb = await getSupabase();
  let query = sb.from('assessments')
    .select('*')
    
    .eq('status', 'PUBLISHED')
    .is('deleted_at', null)
    .order('name');

  if (institutionId) {
    query = query.eq('institution_id', institutionId);
  }

  let AssessmentsList = [];
  try {
    const { data, error } = await query;
    if (!error && data) AssessmentsList = data;
  } catch {
    // fallback
  }

  if (!AssessmentsList.length) {
    try {
      const { data: directAssessments } = await sb.from('assessments')
        .select('*')
        
        .eq('status', 'PUBLISHED')
        .is('deleted_at', null)
        .order('name');
      AssessmentsList = directAssessments || [];
    } catch {
      AssessmentsList = [];
    }
  }

  // Hydrate prerequisite_assessment_id & Assessment_order if missing
  if (AssessmentsList.length > 0) {
    try {
      const { data: logs } = await sb.from('audit_logs')
        .select('entity_id, new_value, created_at')
        .eq('entity_type', 'Assessment')
        .eq('action', 'Assessment_metadata');
      if (logs && logs.length > 0) {
        AssessmentsList.forEach(ex => {
          const m = logs.filter(l => l.entity_id === ex.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (m.length > 0 && m[0].new_value) {
            if (!ex.prerequisite_assessment_id && m[0].new_value.prerequisite_assessment_id) {
              ex.prerequisite_assessment_id = m[0].new_value.prerequisite_assessment_id;
            }
            if (!ex.Assessment_order && m[0].new_value.Assessment_order) {
              ex.Assessment_order = m[0].new_value.Assessment_order;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Student Assessment metadata hydration warning:', e.message);
    }
  }
  return AssessmentsList;
}

/** Fetch published assessments available for a specific Class (when no levels are defined or level is optional) */
export async function fetchAssessmentsForStudentClass(programId, ClassId, institutionId) {
  const sb = await getSupabase();
  let query = sb.from('assessments')
    .select('*')
    .eq('class_id', ClassId)
    .eq('status', 'PUBLISHED')
    .is('deleted_at', null)
    .order('name');

  if (institutionId) {
    query = query.eq('institution_id', institutionId);
  }

  let AssessmentsList = [];
  try {
    const { data, error } = await query;
    if (!error && data) AssessmentsList = data;
  } catch {
    // fallback
  }

  if (!AssessmentsList.length) {
    try {
      const { data: directAssessments } = await sb.from('assessments')
        .select('*')
        .eq('class_id', ClassId)
        .eq('status', 'PUBLISHED')
        .is('deleted_at', null)
        .order('name');
      AssessmentsList = directAssessments || [];
    } catch {
      AssessmentsList = [];
    }
  }

  // Hydrate prerequisite_assessment_id & Assessment_order if missing
  if (AssessmentsList.length > 0) {
    try {
      const { data: logs } = await sb.from('audit_logs')
        .select('entity_id, new_value, created_at')
        .eq('entity_type', 'Assessment')
        .eq('action', 'Assessment_metadata');
      if (logs && logs.length > 0) {
        AssessmentsList.forEach(ex => {
          const m = logs.filter(l => l.entity_id === ex.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
          if (m.length > 0 && m[0].new_value) {
            if (!ex.prerequisite_assessment_id && m[0].new_value.prerequisite_assessment_id) {
              ex.prerequisite_assessment_id = m[0].new_value.prerequisite_assessment_id;
            }
            if (!ex.Assessment_order && m[0].new_value.Assessment_order) {
              ex.Assessment_order = m[0].new_value.Assessment_order;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Student Assessment metadata hydration warning:', e.message);
    }
  }
  return AssessmentsList;
}


/** Fetch all submitted attempts for a student across all assessments */
export async function fetchAllStudentAttempts(studentId) {
  const sb = await getSupabase();

  // Try embedded join first (requires FK relationship in schema cache)
  const { data, error } = await sb.from('attempts')
    .select('id, assessment_id, score, percentage, grade, submitted_at, assessments(name, assessment_type, classes(name))')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });

  if (!error) return data || [];

  // Fallback: schema cache not updated yet — fetch separately and merge in JS
  console.warn('fetchAllStudentAttempts: embedded join unavailable, using 2-step fallback:', error.message);
  const { data: attempts, error: attErr } = await sb.from('attempts')
    .select('id, assessment_id, score, percentage, grade, submitted_at')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false });
  if (attErr) throw attErr;
  if (!attempts || attempts.length === 0) return [];

  const assessmentIds = [...new Set(attempts.map(a => a.assessment_id).filter(Boolean))];
  let assessmentMap = {};
  if (assessmentIds.length > 0) {
    const { data: asmData } = await sb.from('assessments')
      .select('id, name, assessment_type, classes(name)')
      .in('id', assessmentIds);
    if (asmData) asmData.forEach(a => { assessmentMap[a.id] = a; });
  }

  return attempts.map(att => ({
    ...att,
    assessments: assessmentMap[att.assessment_id] || null
  }));
}

/** Fetch student's attempts for an Assessment (to show best score / attempt count) */
export async function fetchStudentAttemptsForAssessment(studentId, AssessmentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('attempts')
    .select('id, status, score, percentage, grade, submitted_at')
    .eq('student_id', studentId)
    .eq('assessment_id', AssessmentId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('percentage', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// Assessment EXECUTION
// ============================================================

/** Start or resume an Assessment — calls Edge Function with direct DB fallback */
export async function startAssessment(studentId, AssessmentId) {
  try {
    return await callEdgeFunction('start-assessment', { student_id: studentId, assessment_id: AssessmentId });
  } catch (edgeErr) {
    console.warn('Edge Function start-assessment failed/unavailable, using client DB fallback:', edgeErr.message);
  }

  const sb = await getSupabase();

  // 1. Fetch assessment / Assessment details (try assessments table first, fallback to assessments)
  let Assessment = null;
  const { data: asmData, error: asmErr } = await sb.from('assessments').select('*').eq('id', AssessmentId).single();
  if (!asmErr && asmData) {
    Assessment = {
      ...asmData,
      name: asmData.title || asmData.name,
      time_limit_seconds: asmData.working_duration_minutes || asmData.time_limit_seconds || 60,
      assessment_type: asmData.category || asmData.assessment_type || 'EVALUATION'
    };
  } else {
    const { data: exData, error: exErr } = await sb.from('assessments').select('*').eq('id', AssessmentId).single();
    if (exErr || !exData) throw new Error('Assessment not found.');
    Assessment = exData;
  }

  // 2. Check for an existing in-progress attempt
  const { data: existingAttempts } = await sb.from('attempts')
    .select('*')
    .eq('student_id', studentId)
    .or(`assessment_id.eq.${AssessmentId},assessment_id.eq.${AssessmentId}`)
    .in('status', ['in_progress', 'IN_PROGRESS'])
    .order('created_at', { ascending: false });

  let attempt = existingAttempts?.[0];

  if (!attempt) {
    // Create new attempt
    const timeLimit = Assessment.working_duration_minutes || Assessment.time_limit_seconds || 60;
    const now = new Date();
    const expectedEnd = new Date(now.getTime() + timeLimit * 60000);

    // Count previous attempts to set attempt_number
    const { count: priorCount } = await sb.from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .or(`assessment_id.eq.${AssessmentId},assessment_id.eq.${AssessmentId}`);

    const attemptNumber = (priorCount || 0) + 1;

    const { data: newAttempt, error: createErr } = await sb.from('attempts')
      .insert({
        student_id: studentId,
        assessment_id: AssessmentId,
        assessment_id: AssessmentId,
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
    const { data: snapQuestions } = await sb.from('assessment_questions')
      .select('*')
      .eq('assessment_id', AssessmentId)
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
      // Legacy fallback: first check for direct questions linked to assessment_id
      try {
        const { data: directQs } = await sb.from('questions')
          .select('*')
          .eq('assessment_id', AssessmentId)
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
          // Check for sections if Assessment_sections table exists
          const { data: sections } = await sb.from('Assessment_sections')
            .select('*, questions(*)')
            .eq('assessment_id', AssessmentId)
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
        console.warn('startAssessment question population fallback notice:', qErr.message);
      }
    }
  }

  // Fetch attempt answers for execution UI
  let { data: answers } = await sb.from('attempt_answers')
    .select('*')
    .eq('attempt_id', attempt.id);

  let sections = null;
  try {
    const { data: secs } = await sb.from('Assessment_sections').select('*, questions(*)').eq('assessment_id', AssessmentId).is('deleted_at', null).order('section_order');
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
    Assessment: Assessment,
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

/** Submit Assessment via Edge Function with direct DB fallback */
export async function submitAssessment(attemptId, answersMap, options = {}) {
  const targetStatus = options?.status || 'submitted';
  try {
    return await callEdgeFunction('submit-assessment', { attempt_id: attemptId, answers: answersMap, status: targetStatus });
  } catch (edgeErr) {
    console.warn('Edge Function submit-assessment unavailable, using client DB fallback:', edgeErr.message);
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
    await recalculateBestScore(updatedAttempt.student_id, updatedAttempt.assessment_id || updatedAttempt.assessment_id);
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
      expected_end_at, assessment_id, exam_id, is_best_score,
      assessments:assessment_id(id, name, assessment_type, answer_type, classes(name), levels(name))
    `)
    .eq('id', attemptId)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch attempt answers for result display */
export async function fetchAttemptAnswers(attemptId) {
  const sb = await getSupabase();
  
  // 1. Fetch attempt status first to determine if we should sanitize answers
  let status = null;
  try {
    const { data: att } = await sb.from('attempts').select('status').eq('id', attemptId).maybeSingle();
    if (att) status = att.status;
    else {
      const { data: cAtt } = await sb.from('attempts').select('status').eq('id', attemptId).maybeSingle();
      if (cAtt) status = cAtt.status;
    }
  } catch (_) {}
  
  const { data, error } = await sb.from('attempt_answers')
    .select('id, attempt_id, question_id, student_answer, score, evaluation_result, question_snapshot, topic_snapshot, question_type_snapshot, correct_answer_snapshot, accepted_answers_snapshot, is_review_required, created_at, updated_at')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  
  const normStatus = (status || '').toUpperCase();
  const isFinished = ['SUBMITTED', 'AUTO_SUBMITTED', 'COMPLETED', 'EXPIRED'].includes(normStatus);
  
  // SECURITY: If attempt is IN_PROGRESS or not finished, strictly strip out answer keys
  if (!isFinished) {
    return (data || []).map(a => { 
      const clean = { ...a };
      delete clean.correct_answer_snapshot; 
      delete clean.accepted_answers_snapshot; 
      if (clean.question_snapshot && typeof clean.question_snapshot === 'object') {
        clean.question_snapshot = { ...clean.question_snapshot };
        delete clean.question_snapshot.correct_answer;
        delete clean.question_snapshot.accepted_answers;
      }
      return clean; 
    });
  }
  
  return data || [];
}

// ============================================================
// ADMIN — Institutions, Programs, Classes, Levels
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
  Classes: [
    { id: '33333333-3333-3333-3333-333333333333', institution_id: '11111111-1111-1111-1111-111111111111', name: 'English Grammar & Vocabulary', is_active: true, created_at: '2026-01-12T08:00:00Z' },
    { id: '33333333-3333-3333-3333-444444444444', institution_id: '11111111-1111-1111-1111-111111111111', name: 'Conversational Speaking', is_active: true, created_at: '2026-01-14T08:00:00Z' }
  ],
  classes: [
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
  assessments: [
    { id: '66666666-6666-6666-6666-666666666666', institution_id: '11111111-1111-1111-1111-111111111111', class_id: '33333333-3333-3333-3333-333333333333', assessment_type: 'MIDTERM', name: 'Grammar Basics Assessment', answer_type: 'multiple_choice', assessment_type: 'published', question_order: 'sequential', time_limit_seconds: 15, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-05T08:00:00Z' },
    { id: '66666666-6666-6666-6666-777777777777', institution_id: '11111111-1111-1111-1111-111111111111', class_id: '33333333-3333-3333-3333-333333333333', assessment_type: 'QUIZ', name: 'Vocabulary Weekly Sprint', answer_type: 'written', assessment_type: 'published', question_order: 'sequential', time_limit_seconds: 20, minimum_required_score: 60, retake_allowed: true, created_at: '2026-02-08T08:00:00Z' }
  ],
  Assessment_programs: [
    { assessment_id: '66666666-6666-6666-6666-666666666666', program_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-06T08:00:00Z' },
    { assessment_id: '66666666-6666-6666-6666-777777777777', program_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-02-09T08:00:00Z' }
  ],
  questions: [
    { id: '88888888-8888-8888-8888-111111111111', assessment_id: '66666666-6666-6666-6666-666666666666', question_order: 1, question_text: 'Choose the correct form: She ___ to school every morning.', correct_answer: 'walks', answer_type: 'multiple_choice', options_json: ['walks', 'walk', 'walking', 'walked'], created_at: '2026-02-06T09:00:00Z' },
    { id: '88888888-8888-8888-8888-222222222222', assessment_id: '66666666-6666-6666-6666-666666666666', question_order: 2, question_text: 'Select the plural of child:', correct_answer: 'children', answer_type: 'multiple_choice', options_json: ['childs', 'children', 'childrens', 'childer'], created_at: '2026-02-06T09:05:00Z' },
    { id: '88888888-8888-8888-8888-333333333333', assessment_id: '66666666-6666-6666-6666-777777777777', question_order: 1, question_text: 'Translate to English: MENCAPAI', correct_answer: 'ACHIEVE', answer_type: 'written', options_json: null, created_at: '2026-02-09T09:00:00Z' }
  ],
  attempts: [
    { id: '99999999-9999-9999-9999-111111111111', student_id: '55555555-5555-5555-5555-555555555555', assessment_id: '66666666-6666-6666-6666-666666666666', status: 'submitted', score: 10, percentage: 100, grade: 'S', effective_score: 100, submitted_at: '2026-02-10T10:30:00Z', created_at: '2026-02-10T10:00:00Z' }
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
  assessments: [],
  assignments: [],
  enrollments: []
};

function hydrateMockRelations(table, item) {
  if (!item || typeof item !== 'object') return item;
  try {
    const clone = { ...item };
    const store = (typeof MOCK_ADMIN_STORE === 'object' && MOCK_ADMIN_STORE !== null) ? MOCK_ADMIN_STORE : {};

    const getList = (key) => {
      if (Array.isArray(store[key])) return store[key];
      if (key === 'classes' && Array.isArray(store.Classes)) return store.Classes;
      if (key === 'Classes' && Array.isArray(store.classes)) return store.classes;
      return [];
    };

    const findItem = (key, predicate) => {
      const list = getList(key);
      return list.find(predicate) || null;
    };

    if (table === 'topics') {
      clone.classes = findItem('classes', s => s?.id === clone.class_id);
    } else if (table === 'assessment_instances') {
      clone.assessments = findItem('assessments', a => a?.id === clone.assessment_id) ||
                          findItem('assessments', e => e?.id === clone.assessment_id);
      clone.batches = findItem('batches', b => b?.id === clone.batch_id);
      clone.students = findItem('students', s => s?.id === clone.student_id);
    }

    if (table === 'classes' || table === 'Classes') {
      clone.institutions = findItem('institutions', p => p?.id === clone.institution_id);
    } else if (table === 'levels') {
      const subj = findItem('classes', s => s?.id === clone.class_id);
      clone.classes = subj ? { ...subj, institution_id: subj.institution_id } : null;
    } else if (table === 'programs') {
      clone.institutions = findItem('institutions', p => p?.id === clone.institution_id);
    } else if (table === 'batches') {
      const cls = findItem('programs', c => c?.id === clone.program_id);
      clone.programs = cls ? { ...cls, institutions: findItem('institutions', p => p?.id === cls.institution_id) } : null;
    } else if (table === 'students') {
      clone.programs = findItem('programs', c => c?.id === clone.program_id);
      clone.institutions = findItem('institutions', p => p?.id === clone.institution_id);
      clone.batches = findItem('batches', b => b?.id === clone.batch_id);
    } else if (table === 'assessments') {
      clone.institutions = findItem('institutions', p => p?.id === clone.institution_id);
      clone.classes = findItem('classes', s => s?.id === clone.class_id);
    } else if (table === 'questions') {
      clone.assessments = findItem('assessments', e => e?.id === clone.assessment_id);
    } else if (table === 'program_classes') {
      const cls = findItem('programs', c => c?.id === clone.program_id);
      clone.programs = cls ? { ...cls, institutions: findItem('institutions', p => p?.id === cls.institution_id) } : null;
      clone.classes = findItem('classes', s => s?.id === clone.class_id);
    } else if (table === 'exam_programs') {
      const cls = findItem('programs', c => c?.id === clone.program_id);
      clone.programs = cls ? { ...cls, institutions: findItem('institutions', p => p?.id === cls.institution_id) } : null;
      clone.assessments = findItem('assessments', e => e?.id === clone.assessment_id);
    } else if (table === 'attempts') {
      const st = findItem('students', s => s?.id === clone.student_id);
      clone.students = st ? { ...st, programs: findItem('programs', c => c?.id === st.program_id) } : null;
      clone.assessments = findItem('assessments', e => e?.id === clone.assessment_id);
    } else if (table === 'progress') {
      const st = findItem('students', s => s?.id === clone.student_id);
      clone.students = st ? { ...st, programs: findItem('programs', c => c?.id === st.program_id) } : null;
      clone.classes = findItem('classes', s => s?.id === clone.class_id);
    }

    return clone;
  } catch (err) {
    console.warn(`[hydrateMockRelations] Error hydrating table "${table}":`, err);
    return item;
  }
}

let _adminCache = new Map();

export function clearAdminCache(table = null) {
  if (table) {
    const normTable = (table || '').replace('-', '_');
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
  const normTable = (table || '').replace('-', '_');
  const cacheKey = normTable + '|' + select + '|' + JSON.stringify(filters);

  if (!forceRefresh && _adminCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(_adminCache.get(cacheKey))); // Return deep copy
  }

  if (isPlaceholderUrl()) {
    let rows = MOCK_ADMIN_STORE[normTable] || (normTable === 'classes' ? MOCK_ADMIN_STORE.Classes : (normTable === 'Classes' ? MOCK_ADMIN_STORE.classes : [])) || [];
    for (const [key, val] of Object.entries(filters)) {
      rows = rows.filter(r => r && r[key] === val);
    }
    return rows.map(r => hydrateMockRelations(normTable, r));
  }
  try {
    const sb = await getSupabase();
    if (!sb) {
      throw new Error('Supabase client unavailable');
    }
    // Disambiguate foreign key relations if standard embed syntax is used
    let resolvedSelect = select;
    if (resolvedSelect !== '*') {
      // Disambiguate relations using explicit foreign key constraint hints where ambiguity exists
      resolvedSelect = resolvedSelect
        .replace(/\binstitutions(?!!)\(/g, 'institutions!institution_id(')
        .replace(/\bprograms(?!!)\(/g, 'programs!program_id(')
        .replace(/\bbatches(?!!)\(/g, 'batches!batch_id(')
        .replace(/\blevels(?!!)\(/g, 'levels!level_id(')
        .replace(/\bAssessments(?!!)\(/g, 'assessments!assessment_id(')
        .replace(/\bstudents(?!!)\(/g, 'students!student_id(');
    }

    let query = sb.from(normTable).select(resolvedSelect);
    // Only filter by deleted_at if the table supports soft delete
    const noDeletedAtTables = ['program_classes', 'exam_programs', 'attempts', 'attempt_answers', 'progress', 'audit_logs', 'site_settings', 'attempts', 'attempt_answers', 'modules', 'student_submissions', 'Assessment_history'];
    if (!noDeletedAtTables.includes(normTable)) {
      query = query.is('deleted_at', null);
    }
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
    let { data, error } = await query;
    if (error && select !== '*') {
      console.warn(`Query with relation "${resolvedSelect}" on ${normTable} failed, retrying with '*':`, error.message);
      let fallbackQuery = sb.from(normTable).select('*');
      if (!noDeletedAtTables.includes(normTable)) {
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
    if (error) {
      console.warn(`adminFetchAll soft warning: Query on ${normTable} failed:`, error.message);
      return [];
    }
    let list = data || [];

    // Hydrate missing institutions relationship if the original query requested it but it failed and fell back
    if (list.length > 0 && select.includes('institutions') && list.some(r => !r.institutions && r.institution_id)) {
      try {
        const instRes = await sb.from('institutions').select('id, name');
        const instList = instRes.data || [];
        list.forEach(r => {
          if (!r.institutions && r.institution_id) {
            const match = instList.find(i => i.id === r.institution_id);
            if (match) r.institutions = { name: match.name };
          }
        });
      } catch (hydrationErr) {
        console.warn('Institutions hydration warning:', hydrationErr.message);
      }
    }

    // Hydrate missing classes relationship if the original query requested it but it failed and fell back
    if (list.length > 0 && select.includes('classes') && list.some(r => !r.classes && r.class_id)) {
      try {
        const clsRes = await sb.from('classes').select('id, name');
        const clsList = clsRes.data || [];
        list.forEach(r => {
          if (!r.classes && r.class_id) {
            const match = clsList.find(c => c.id === r.class_id);
            if (match) r.classes = { name: match.name };
          }
        });
      } catch (clsHydrationErr) {
        console.warn('Classes hydration warning:', clsHydrationErr.message);
      }
    }

    // Hydrate missing programs relationship if the original query requested it but it failed and fell back
    if (list.length > 0 && select.includes('programs') && list.some(r => !r.programs && r.program_id)) {
      try {
        const progRes = await sb.from('programs').select('id, name, institution_id');
        const progList = progRes.data || [];
        list.forEach(r => {
          if (!r.programs && r.program_id) {
            const match = progList.find(p => p.id === r.program_id);
            if (match) r.programs = { name: match.name, institution_id: match.institution_id };
          }
        });
      } catch (progHydrationErr) {
        console.warn('Programs hydration warning:', progHydrationErr.message);
      }
    }

    // Hydrate missing batches relationship if the original query requested it but it failed and fell back
    if (list.length > 0 && select.includes('batches') && list.some(r => !r.batches && r.batch_id)) {
      try {
        const batchRes = await sb.from('batches').select('id, name');
        const batchList = batchRes.data || [];
        list.forEach(r => {
          if (!r.batches && r.batch_id) {
            const match = batchList.find(b => b.id === r.batch_id);
            if (match) r.batches = { name: match.name };
          }
        });
      } catch (batchHydrationErr) {
        console.warn('Batches hydration warning:', batchHydrationErr.message);
      }
    }

    // Hydrate assessments with program_id, prerequisite_assessment_id, Assessment_order
    if (normTable === 'assessments' && list.length > 0) {
      try {
        let ecList = [];
        let logsList = [];
        try {
          const { data, error } = await sb.from('exam_programs').select('*');
          if (!error && Array.isArray(data)) ecList = data;
        } catch (_) {}

        try {
          const { data, error } = await sb.from('audit_logs')
            .select('entity_id, new_value, created_at')
            .eq('entity_type', 'Assessment')
            .eq('action', 'Assessment_metadata');
          if (!error && Array.isArray(data)) logsList = data;
        } catch (_) {}

        list.forEach(r => {
          if (!r) return;
          if (!r.program_id) {
            const match = ecList.find(c => c?.assessment_id === r.id);
            if (match) r.program_id = match.program_id;
          }
          const AssessmentLogs = logsList.filter(l => l?.entity_id === r.id).sort((a,b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
          let nv = {};
          if (AssessmentLogs.length > 0 && AssessmentLogs[0]?.new_value) {
            try {
              nv = typeof AssessmentLogs[0].new_value === 'string' ? JSON.parse(AssessmentLogs[0].new_value) : AssessmentLogs[0].new_value;
            } catch (_) {
              nv = {};
            }
          }
          nv = (nv && typeof nv === 'object') ? nv : {};
          if (!r.prerequisite_assessment_id && nv?.prerequisite_assessment_id) r.prerequisite_assessment_id = nv.prerequisite_assessment_id;
          if (!r.Assessment_order && nv?.Assessment_order) r.Assessment_order = nv.Assessment_order;
          if (!r.program_id && nv?.program_id) r.program_id = nv.program_id;
          if (!r.Assessment_order) r.Assessment_order = 1;
        });
      } catch (hydrationErr) {
        console.warn('Metadata hydration warning:', hydrationErr?.message || hydrationErr);
      }
    }
    _adminCache.set(cacheKey, JSON.parse(JSON.stringify(list)));
    return list;
  } catch(e) {
    console.warn(`Supabase query failed for ${table}, using mock store:`, e?.message || e);
    let rows = MOCK_ADMIN_STORE[normTable] || (normTable === 'classes' ? MOCK_ADMIN_STORE.Classes : (normTable === 'Classes' ? MOCK_ADMIN_STORE.classes : [])) || [];
    for (const [key, val] of Object.entries(filters)) {
      rows = rows.filter(r => r && r[key] === val);
    }
    const list = rows.map(r => hydrateMockRelations(normTable, r));
    _adminCache.set(cacheKey, JSON.parse(JSON.stringify(list)));
    return list;
  }
}

export async function adminInsert(table, payload) {
  const normTable = (table || '').replace('-', '_');
  if (isPlaceholderUrl()) {
    const newItem = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
    if (!MOCK_ADMIN_STORE[normTable]) MOCK_ADMIN_STORE[normTable] = [];
    MOCK_ADMIN_STORE[normTable].unshift(newItem);
    clearAdminCache(normTable);
    return newItem;
  }
  const sb = await getSupabase();
  let insertPayload = { ...payload };
  if (normTable === 'assessments') delete insertPayload.display_name;

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
      if (normTable === 'assessments') {
        delete fallback.program_id;
        delete fallback.prerequisite_assessment_id;
        delete fallback.prerequisite_min_score;
        delete fallback.Assessment_order;
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

  // Persist auxiliary metadata for assessments
  if (normTable === 'assessments' && data?.id) {
    try {
      if (payload.program_id) {
        await sb.from('exam_programs').insert({ assessment_id: data.id, program_id: payload.program_id });
      }
      await sb.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'Assessment_metadata',
        entity_type: 'Assessment',
        entity_id: data.id,
        new_value: {
          prerequisite_assessment_id: payload.prerequisite_assessment_id || null,
          prerequisite_min_score: payload.prerequisite_min_score || 60.0,
          Assessment_order: payload.Assessment_order || '1',
          program_id: payload.program_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Assessment metadata auxiliary save notice:', auxErr.message);
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
  const normTable = (table || '').replace('-', '_');
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
  if (normTable === 'assessments') delete updatePayload.display_name;

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
      if (normTable === 'assessments') {
        delete fallback.program_id;
        delete fallback.prerequisite_assessment_id;
        delete fallback.prerequisite_min_score;
        delete fallback.Assessment_order;
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

  // Persist auxiliary metadata for assessments
  if (normTable === 'assessments') {
    try {
      if (payload.program_id) {
        await sb.from('exam_programs').delete().eq('assessment_id', id);
        await sb.from('exam_programs').insert({ assessment_id: id, program_id: payload.program_id });
      }
      await sb.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'Assessment_metadata',
        entity_type: 'Assessment',
        entity_id: id,
        new_value: {
          prerequisite_assessment_id: payload.prerequisite_assessment_id || null,
          prerequisite_min_score: payload.prerequisite_min_score || 60.0,
          Assessment_order: payload.Assessment_order || '1',
          program_id: payload.program_id || null
        }
      });
    } catch (auxErr) {
      console.warn('Assessment metadata auxiliary save notice:', auxErr.message);
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

  // Deactivation Cascade Logic
  if (normTable === 'institutions' && 'is_active' in payload) {
    try {
      const isActive = payload.is_active;
      await sb.from('programs').update({ is_active: isActive }).eq('institution_id', id);
      const { data: progs } = await sb.from('programs').select('id').eq('institution_id', id);
      if (progs && progs.length > 0) {
        const progIds = progs.map(p => p.id);
        await sb.from('batches').update({ is_active: isActive }).in('program_id', progIds);
      }
      clearAdminCache('programs');
      clearAdminCache('batches');
    } catch (err) {
      console.warn('Cascade deactivation notice (institutions):', err.message);
    }
  } else if (normTable === 'programs' && 'is_active' in payload) {
    try {
      await sb.from('batches').update({ is_active: payload.is_active }).eq('program_id', id);
      clearAdminCache('batches');
    } catch (err) {
      console.warn('Cascade deactivation notice (programs):', err.message);
    }
  }

  clearAdminCache(normTable);
  return data;
}

export async function adminSoftDelete(table, id) {
  const normTable = (table || '').replace('-', '_');
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
  const normTable = (table || '').replace('-', '_');
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
  const normTable = (table || '').replace('-', '_');
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
  const normTable = (table || '').replace('-', '_');
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
        const primaryHasClass = allProgress.some(p => p.student_id === primary.id && p.class_id === dp.class_id);
        if (!primaryHasClass) {
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
 * Detect duplicate questions within an Assessment or across assessments
 * @param {string|null} AssessmentId - Optional filter by Assessment
 */
export async function detectDuplicateQuestions(AssessmentId = null) {
  const [questions, assessments] = await Promise.all([
    adminFetchAll('questions', 'id, assessment_id, question_order, question_text, correct_answer, answer_type, created_at, deleted_at'),
    adminFetchAll('assessments', 'id, name, assessment_type')
  ]);

  const AssessmentMap = new Map();
  (assessments || []).forEach(e => AssessmentMap.set(e.id, e));

  let activeQuestions = (questions || []).filter(q => !q.deleted_at);
  if (AssessmentId) {
    activeQuestions = activeQuestions.filter(q => q.assessment_id === AssessmentId);
  }

  // 1. Same-Assessment Duplicate Text Groups (Critical duplicate bug)
  const sameAssessmentTextMap = new Map();
  activeQuestions.forEach(q => {
    const textNorm = String(q.question_text || '').trim().toLowerCase();
    if (!textNorm) return;
    const key = `${q.assessment_id}::${textNorm}`;
    if (!sameAssessmentTextMap.has(key)) sameAssessmentTextMap.set(key, []);
    sameAssessmentTextMap.get(key).push(q);
  });

  const sameAssessmentDuplicates = [];
  for (const [key, candidates] of sameAssessmentTextMap.entries()) {
    if (candidates.length <= 1) continue;
    candidates.sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0) || new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const e = AssessmentMap.get(candidates[0].assessment_id);
    sameAssessmentDuplicates.push({
      key,
      AssessmentId: candidates[0].assessment_id,
      AssessmentTitle: e ? `${e.assessment_type ? e.assessment_type + ' — ' : ''}${e.name}` : 'Unknown Assessment',
      questionText: candidates[0].question_text,
      recommendedPrimaryId: candidates[0].id,
      candidates
    });
  }

  // 2. Same-Assessment Order Conflicts (duplicate order numbers in same Assessment)
  const sameAssessmentOrderMap = new Map();
  activeQuestions.forEach(q => {
    if (q.question_order == null) return;
    const key = `${q.assessment_id}::${Number(q.question_order)}`;
    if (!sameAssessmentOrderMap.has(key)) sameAssessmentOrderMap.set(key, []);
    sameAssessmentOrderMap.get(key).push(q);
  });

  const sameAssessmentOrderConflicts = [];
  for (const [key, candidates] of sameAssessmentOrderMap.entries()) {
    if (candidates.length <= 1) continue;
    const e = AssessmentMap.get(candidates[0].assessment_id);
    sameAssessmentOrderConflicts.push({
      key,
      AssessmentId: candidates[0].assessment_id,
      AssessmentTitle: e ? `${e.assessment_type ? e.assessment_type + ' — ' : ''}${e.name}` : 'Unknown Assessment',
      order: Number(candidates[0].question_order),
      candidates
    });
  }

  // 3. Cross-Assessment Duplicates (identical question text appearing across multiple assessments)
  const crossAssessmentTextMap = new Map();
  (questions || []).filter(q => !q.deleted_at).forEach(q => {
    const textNorm = String(q.question_text || '').trim().toLowerCase();
    if (!textNorm) return;
    if (!crossAssessmentTextMap.has(textNorm)) crossAssessmentTextMap.set(textNorm, []);
    crossAssessmentTextMap.get(textNorm).push(q);
  });

  const crossAssessmentDuplicates = [];
  for (const [textNorm, candidates] of crossAssessmentTextMap.entries()) {
    const uniqueAssessments = new Set(candidates.map(c => c.assessment_id));
    if (uniqueAssessments.size <= 1) continue;
    crossAssessmentDuplicates.push({
      questionText: candidates[0].question_text,
      AssessmentCount: uniqueAssessments.size,
      candidatesCount: candidates.length,
      assessments: Array.from(uniqueAssessments).map(eid => {
        const e = AssessmentMap.get(eid);
        return {
          id: eid,
          title: e ? `${e.assessment_type ? e.assessment_type + ' — ' : ''}${e.name}` : 'Unknown Assessment'
        };
      })
    });
  }

  return {
    sameAssessmentDuplicates,
    sameAssessmentOrderConflicts,
    crossAssessmentDuplicates,
    totalSameAssessmentDupCount: sameAssessmentDuplicates.reduce((acc, g) => acc + (g.candidates.length - 1), 0)
  };
}

/**
 * Re-sequence question_order sequentially (1, 2, 3... N) for an Assessment
 * @param {string} AssessmentId
 */
export async function resequenceAssessmentQuestions(AssessmentId) {
  const allQ = await adminFetchAll('questions', '*', { assessment_id: AssessmentId });
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

  return { AssessmentId, totalQuestions: activeQ.length, resequencedCount };
}

/**
 * Resolve a single duplicate question pair
 * Safely re-links any attempt_answers from duplicateQId to primaryQId,
 * deletes duplicateQId, and re-sequences questions.
 */
export async function resolveDuplicateQuestionGroup(primaryQId, duplicateQId, autoResequence = true) {
  const sb = await getSupabase();

  let AssessmentId = null;
  if (!isPlaceholderUrl()) {
    try {
      const { data: qData } = await sb.from('questions').select('assessment_id').eq('id', duplicateQId).single();
      if (qData) AssessmentId = qData.assessment_id;
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
  if (autoResequence && AssessmentId) {
    reseqResult = await resequenceAssessmentQuestions(AssessmentId);
  }

  return { success: true, primaryQId, duplicateQId, AssessmentId, reseqResult };
}

/**
 * Batch resolve all same-Assessment duplicate questions within an Assessment
 */
export async function batchResolveAssessmentDuplicateQuestions(AssessmentId) {
  const dups = await detectDuplicateQuestions(AssessmentId);
  const groups = dups.sameAssessmentDuplicates;
  let deletedQuestions = 0;

  for (const group of groups) {
    const primary = group.candidates[0]; // lowest order
    const duplicates = group.candidates.slice(1);
    for (const dup of duplicates) {
      await resolveDuplicateQuestionGroup(primary.id, dup.id, false);
      deletedQuestions++;
    }
  }

  const reseqResult = await resequenceAssessmentQuestions(AssessmentId);

  return {
    AssessmentId,
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
  const [students, attempts, progress, programs, batches, institutions] = await Promise.all([
    adminFetchAll('students'),
    adminFetchAll('attempts', 'id, student_id, score, percentage, grade, status').catch(() => []),
    adminFetchAll('progress', 'id, student_id').catch(() => []),
    adminFetchAll('programs').catch(() => []),
    adminFetchAll('batches').catch(() => []),
    adminFetchAll('institutions').catch(() => [])
  ]);

  const progMap = new Map((programs || []).map(p => [p.id, p]));
  const batchMap = new Map((batches || []).map(b => [b.id, b]));
  const instMap = new Map((institutions || []).map(i => [i.id, i]));

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
      const prog = progMap.get(c.program_id);
      const batch = batchMap.get(c.batch_id);
      const inst = instMap.get(c.institution_id || prog?.institution_id);
      return {
        ...c,
        attemptsCount: studentAttempts.length,
        progressCount: studentProgress.length,
        bestScore: bestAttempt ? parseFloat(bestAttempt.percentage || 0).toFixed(1) : null,
        globalGrade: bestAttempt ? bestAttempt.grade : null,
        programName: prog?.name || c.programs?.name || '—',
        institutionName: inst?.name || prog?.institutions?.name || '—',
        batchName: batch?.name || c.batches?.name || 'Unassigned',
        programs: prog || c.programs || { name: '—' },
        institutions: inst || c.institutions || { name: '—' }
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
  try {
    const primaryProgress = await adminFetchAll('progress', '*', { student_id: primary.id }).catch(() => []);
    for (const dp of (allProgress || [])) {
      const pKey = dp.class_id || dp.class_id;
      const exists = primaryProgress.some(p => (p.class_id || p.class_id) === pKey);
      if (!exists) {
        await adminUpdate('progress', dp.id, { student_id: primary.id, updated_at: new Date().toISOString() });
      } else {
        await adminHardDelete('progress', dp.id).catch(() => {});
      }
    }
  } catch (progErr) {
    console.warn('Progress relink warning during merge:', progErr.message);
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

export async function logCheatingEvent(studentId, AssessmentId, action, detail) {
  try {
    if (isPlaceholderUrl()) {
      console.warn('Cheating logged (demo mode):', { studentId, AssessmentId, action, detail });
      return;
    }
    const sb = await getSupabase();
    await sb.from('audit_logs').insert({
      actor_user_id: studentId,
      actor_role: 'student',
      action: action || 'CHEAT_ATTEMPT',
      entity_type: 'Assessment',
      entity_id: AssessmentId,
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
// Assessment RECALIBRATOR ENGINE (Phases 15, 16, 17)
// ============================================================

/**
 * Preview recalibration of an Assessment across all submitted attempts.
 * Pure read-only operation: does not mutate the database.
 *
 * @param {string} AssessmentId
 * @returns {Promise<Object>} Detailed comparison and summary
 */
export async function previewRecalibrateAssessment(AssessmentId) {
  const sb = await getSupabase();

  // 1. Load Assessment
  const { data: Assessment, error: AssessmentErr } = await sb.from('assessments')
    .select('id, name, display_name, minimum_required_score, class_id, institution_id')
    .eq('id', AssessmentId)
    .single();
  if (AssessmentErr || !Assessment) throw new Error('Assessment not found: ' + (AssessmentErr?.message || AssessmentId));

  const minPassingScore = Number(Assessment.minimum_required_score) || 60;

  // 2. Load current active questions for this Assessment
  const { data: questions, error: qErr } = await sb.from('questions')
    .select('id, question_order, question_text, correct_answer, answer_type, metadata')
    .eq('assessment_id', AssessmentId)
    .is('deleted_at', null)
    .order('question_order');
  if (qErr) throw qErr;

  const questionsMap = new Map();
  (questions || []).forEach(q => questionsMap.set(q.id, q));

  // 3. Load all submitted attempts for this Assessment
  const { data: attempts, error: attErr } = await sb.from('attempts')
    .select('*, students(id, name, gender, program_id, programs(name))')
    .eq('assessment_id', AssessmentId)
    .in('status', ['submitted', 'auto_submitted', 'expired'])
    .order('submitted_at', { ascending: false });
  if (attErr) throw attErr;

  if (!attempts || attempts.length === 0) {
    return {
      Assessment,
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
    Assessment,
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
 * Apply recalibration to an Assessment. Mutates attempt_answers, attempts, and progress.
 *
 * @param {string} AssessmentId
 * @param {string} adminIdentifier
 * @returns {Promise<Object>} Result of execution
 */
export async function applyRecalibrateAssessment(AssessmentId, adminIdentifier = 'admin') {
  const sb = await getSupabase();
  const preview = await previewRecalibrateAssessment(AssessmentId);

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
    if (preview.Assessment.class_id && preview.Assessment.level_id) {
      const isPassed = diff.newStatus === 'PASS';
      try {
        await sb.from('progress').upsert({
          student_id: diff.studentId,
          class_id: preview.Assessment.class_id,
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
      action: 'Assessment_recalibrated',
      entity_type: 'Assessment',
      entity_id: AssessmentId,
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
// CENTRALIZED assessment SYSTEM V1 API
// ============================================================

/** Global Classes */
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

/** Topics (Global per Class) */
export async function fetchTopics(ClassId = null) {
  const sb = await getSupabase();
  try {
    let query = sb.from('topics')
      .select('*, classes(name)')
      .is('deleted_at', null);
    if (ClassId) {
      query = query.eq('class_id', ClassId);
    }
    const { data, error } = await query.order('name');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('Topics table query fallback:', err.message);
  }
  let list = MOCK_ADMIN_STORE.topics || [];
  if (ClassId) list = list.filter(t => t.class_id === ClassId);
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
      .select('*')
      .is('deleted_at', null);

    if (filters.class_id) query = query.eq('class_id', filters.class_id);
    if (filters.question_type) query = query.eq('question_type', filters.question_type);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Central questions query failed:', err.message);
    return [];
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

  const { data: exData } = await sb.from('assessments')
    .select('id')
    .eq('topic_id', payload.topic_id)
    .is('deleted_at', null)
    .limit(1);
    
  let targetAssessmentId = null;
  if (exData && exData.length > 0) {
    targetAssessmentId = exData[0].id;
  } else {
    const { data: anyEx } = await sb.from('assessments').select('id').is('deleted_at', null).limit(1);
    targetAssessmentId = anyEx?.[0]?.id || null;
  }
  if (!targetAssessmentId) throw new Error("No assessments available to host questions.");

  const { data, error } = await sb.from('questions')
    .insert({
      assessment_id: targetAssessmentId,
      question_order: Math.floor(Math.random() * 1000000),
      question_text: payload.question_text.trim(),
      correct_answer: acceptedAnswers.join(' / '),
      answer_type: 'written',
      metadata: { 
        topic: payload.topic_id || 'General', 
        question_type: payload.question_type || '', 
        accepted_answers_array: acceptedAnswers 
      }
    })
    .select()
    .single();
  if (error) throw error;
  clearAdminCache('questions');
  return data;
}

export async function updateCentralQuestion(id, payload) {
  const sb = await getSupabase();
  const updateData = {};
  let fArray = null;

  if (payload.accepted_answers) {
    if (Array.isArray(payload.accepted_answers)) {
      fArray = payload.accepted_answers;
    } else {
      fArray = String(payload.accepted_answers).split(/[;/|]/).map(s => s.trim()).filter(Boolean);
    }
    updateData.correct_answer = fArray.join(' / ');
  } else if (payload.correct_answer) {
    updateData.correct_answer = payload.correct_answer;
  }
  
  if (payload.question_text !== undefined) {
    updateData.question_text = payload.question_text.trim();
  }
  
  if (payload.topic_id !== undefined || payload.question_type !== undefined || fArray !== null) {
    const { data: existing } = await sb.from('questions').select('metadata').eq('id', id).single();
    let meta = existing?.metadata || {};
    if (payload.topic_id !== undefined) meta.topic = payload.topic_id;
    if (payload.question_type !== undefined) meta.question_type = payload.question_type;
    if (fArray !== null) meta.accepted_answers_array = fArray;
    updateData.metadata = meta;
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

/** assessments (Evaluations & assessments) */
export async function fetchAssessmentDefinitions(filters = {}) {
  const sb = await getSupabase();
  let query = sb.from('assessments').select('*, classes(name)').is('deleted_at', null);

  if (filters.class_id) query = query.eq('class_id', filters.class_id);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('status', filters.status);

  try {
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) return data;
  } catch (err) {
    console.warn('assessments table query fallback to assessments:', err.message);
  }

  // Fallback to legacy assessments table if assessments not yet migrated
  const legacyList = await adminFetchAll('assessments', '*, classes(name)');
  return legacyList.map(e => ({
    id: e.id,
    title: e.title || e.name,
    category: e.category || 'EVALUATION',
    status: (e.assessment_type || 'draft').toUpperCase(),
    working_duration_minutes: Math.floor((e.time_limit_seconds || 3600) / 60),
    created_at: e.created_at,
    ...e
  }));
}

export async function createAssessmentDefinitionWithTopics(payload, topicIds = []) {
  const sb = await getSupabase();
  try {
    const { data: assessment, error } = await sb.from('assessments')
      .insert({
        institution_id: payload.institution_id || null,
        class_id: payload.class_id,
        category: payload.category || 'EVALUATION',
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
          assessment_id: assessment.id,
          topic_id: tid
        }));
        await sb.from('assessment_topics').insert(topicInserts);
      }
      clearAdminCache('assessments');
      return assessment;
    }
  } catch (err) {
    console.warn('createAssessmentDefinitionWithTopics fallback to assessments:', err.message);
  }

  // Fallback to legacy assessments table
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

  const AssessmentPayload = {
    institution_id: instId,
    class_id: payload.class_id,
    name: payload.title.trim(),
    time_limit_seconds: (payload.working_duration_minutes || 60) * 60,
    assessment_type: 'draft',
    randomize_order: payload.question_order === 'RANDOM'
  };
  const { data: createdAssessment, error: AssessmentErr } = await sb.from('assessments')
    .insert(AssessmentPayload)
    .select()
    .single();
  if (AssessmentErr) throw AssessmentErr;
  clearAdminCache('assessments');
  return {
    ...createdAssessment,
    title: createdAssessment.name,
    category: payload.category || 'EVALUATION',
    working_duration_minutes: Math.floor((createdAssessment.time_limit_seconds || 0) / 60)
  };
}

export async function updateAssessmentWithTopics(assessmentId, payload, topicIds = []) {
  const sb = await getSupabase();
  try {
    const { data: updated, error } = await sb.from('assessments')
      .update({
        class_id: payload.class_id,
        category: payload.category || 'EVALUATION',
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
        await sb.from('assessment_topics').delete().eq('assessment_id', assessmentId);
        if (topicIds.length > 0) {
          const topicInserts = topicIds.map(tid => ({
            assessment_id: assessmentId,
            topic_id: tid
          }));
          await sb.from('assessment_topics').insert(topicInserts);
        }
      }
      clearAdminCache('assessments');
      return updated;
    }
  } catch (err) {
    console.warn('updateAssessmentWithTopics fallback to assessments:', err.message);
  }

  // Fallback to legacy assessments table
  const AssessmentUpdate = {
    class_id: payload.class_id,
    name: payload.title.trim(),
    time_limit_seconds: (payload.working_duration_minutes || 60) * 60,
    randomize_order: payload.question_order === 'RANDOM',
    updated_at: new Date().toISOString()
  };
  const { data: updatedAssessment, error: exErr } = await sb.from('assessments')
    .update(AssessmentUpdate)
    .eq('id', assessmentId)
    .select()
    .single();

  if (exErr) throw exErr;
  clearAdminCache('assessments');
  return {
    ...updatedAssessment,
    title: updatedAssessment.name,
    category: payload.category || 'EVALUATION',
    working_duration_minutes: Math.floor((updatedAssessment.time_limit_seconds || 0) / 60)
  };
}

export async function publishAssessment(assessmentId) {
  const sb = await getSupabase();
  try {
    // 1. Fetch assessment and linked topics
    const { data: assessment, error: aErr } = await sb.from('assessments')
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
          await sb.from('assessment_questions').delete().eq('assessment_id', assessmentId);
          let displayOrder = 1;
          const snapshotRows = questions.map(q => ({
            assessment_id: assessmentId,
            question_id: q.id,
            question_text_snapshot: q.question_text,
            accepted_answers_snapshot: Array.isArray(q.accepted_answers) ? q.accepted_answers : [q.correct_answer],
            topic_snapshot: q.topics?.name || 'General',
            question_type_snapshot: q.question_type || null,
            display_order: displayOrder++
          }));
          await sb.from('assessment_questions').insert(snapshotRows);
          snapshotCount = snapshotRows.length;
        }
      }

      // Update status to PUBLISHED
      const { data: updated, error: pubErr } = await sb.from('assessments')
        .update({ status: 'PUBLISHED' })
        .eq('id', assessmentId)
        .select()
        .single();

      if (!pubErr && updated) {
        clearAdminCache('assessments');
        return { success: true, assessment: updated, total_questions: snapshotCount };
      }
    }
  } catch (err) {
    console.warn('publishAssessment fallback to legacy assessments:', err.message);
  }

  // Fallback to legacy Assessment publishing
  const { data: updatedAssessment, error: exErr } = await sb.from('assessments')
    .update({ assessment_type: 'published' })
    .eq('id', assessmentId)
    .select()
    .single();
  if (exErr) throw exErr;

  const { count } = await sb.from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null);

  clearAdminCache('assessments');
  return { success: true, assessment: updatedAssessment, total_questions: count || 0 };
}

export async function fetchAssessmentQuestions(assessmentId) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('display_order');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('assessment_questions query fallback to questions:', err.message);
  }

  // Fallback to legacy questions
  const { data: legacyQ } = await sb.from('questions')
    .select('*')
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)
    .order('question_order');

  return (legacyQ || []).map((q, idx) => ({
    id: q.id,
    assessment_id: assessmentId,
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
    const { data, error } = await sb.from('assessment_instances')
      .insert({
        assessment_id: payload.assessment_id,
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
      clearAdminCache('assessment_instances');
      return data;
    }
  } catch (err) {
    console.warn('assignAssessment fallback to Assessment_programs:', err.message);
  }

  // Fallback to legacy Assessment_programs if batch assignment
  if (payload.challenge_instance_type === 'BATCH' && payload.batch_id) {
    try {
      const { data: batch } = await sb.from('batches').select('program_id').eq('id', payload.batch_id).single();
      if (batch && batch.program_id) {
        await sb.from('exam_programs').insert({
          assessment_id: payload.assessment_id,
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
  clearAdminCache('assessment_instances');
  return hydrateMockRelations('assessment_instances', memItem);
}

export async function fetchAssignments(filters = {}) {
  const sb = await getSupabase();
  try {
    let query = sb.from('assessment_instances')
      .select('*, assessments(title, category), batches(name), students(name)');

    if (filters.assessment_id) query = query.eq('assessment_id', filters.assessment_id);

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

  // Fallback: derive assignments from live Assessment_programs and batches
  try {
    const { data: epList } = await sb.from('exam_programs').select('*, assessments(id, name, assessment_type), programs(id, name)');
    if (epList && epList.length > 0) {
      const { data: batches } = await sb.from('batches').select('id, name, program_id').is('deleted_at', null);
      const derived = [];
      epList.forEach(ep => {
        const matchingBatches = (batches || []).filter(b => b.program_id === ep.program_id);
        matchingBatches.forEach(b => {
          derived.push({
            id: `ep-assign-${ep.assessment_id}-${b.id}`,
            assessment_id: ep.assessment_id,
            challenge_instance_type: 'BATCH',
            batch_id: b.id,
            status: 'active',
            created_at: ep.created_at || new Date().toISOString(),
            assessments: { title: ep.assessments?.name || 'Evaluation', category: ep.assessments?.assessment_type || 'EVALUATION' },
            batches: { name: b.name },
            students: null
          });
        });
      });
      const mem = (MOCK_ADMIN_STORE.assignments || []).map(a => hydrateMockRelations('assessment_instances', a));
      let combined = [...mem, ...derived];
      if (filters.assessment_id) combined = combined.filter(a => a.assessment_id === filters.assessment_id);
      if (filters.batch_id) combined = combined.filter(a => a.batch_id === filters.batch_id);
      if (filters.student_id) combined = combined.filter(a => a.student_id === filters.student_id);
      return combined;
    }
  } catch (_) {}

  return (MOCK_ADMIN_STORE.assignments || []).map(a => hydrateMockRelations('assessment_instances', a));
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
    .eq('assessment_id', assessmentId)
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
// export const startAssessment = startAssessment;
// export const submitAssessment = submitAssessment;

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
  let query = sb.from('class_instances').select('*');
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



export async function fetchAssessmentDefinitionTopics(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('assessment_topics').select('topic_id').eq('assessment_id', id);
  if (error) throw error;
  return (data || []).map(d => d.topic_id);
}

export async function createAssessmentDefinition(payload, topicIds = []) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('assessments')
    .insert({
      class_id: payload.class_id,
      title: payload.title.trim(),
      description: payload.description || null,
      category: payload.category || 'EVALUATION',
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
      assessment_id: data.id,
      topic_id: tid
    }));
    await sb.from('assessment_topics').insert(topicInserts);
  }

  return data;
}

export async function updateAssessmentDefinition(id, payload, topicIds = null) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('assessments')
    .update({
      title: payload.title.trim(),
      description: payload.description || null,
      category: payload.category || 'EVALUATION',
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
    await sb.from('assessment_topics').delete().eq('assessment_id', id);
    if (topicIds.length > 0) {
      const topicInserts = topicIds.map(tid => ({
        assessment_id: id,
        topic_id: tid
      }));
      await sb.from('assessment_topics').insert(topicInserts);
    }
  }
  return data;
}

export async function publishAssessmentDefinition(id) {
  const sb = await getSupabase();
  const { data: topics, error: tErr } = await sb.from('assessment_topics')
    .select('topic_id')
    .eq('assessment_id', id);
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
    await sb.from('assessment_questions').delete().eq('assessment_id', id);
    const inserts = questionIds.map(qid => ({
      assessment_id: id,
      question_id: qid
    }));
    await sb.from('assessment_questions').insert(inserts);
  }

  const { data, error } = await sb.from('assessments')
    .update({ status: 'READY', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, _frozenCount: questionIds.length };
}

export async function publishChallengeDefinition(id) {
  const sb = await getSupabase();
  const { data: topics, error: tErr } = await sb.from('assessment_topics')
    .select('topic_id')
    .eq('assessment_id', id);
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
    await sb.from('assessment_questions').delete().eq('assessment_id', id);
    const inserts = questionIds.map(qid => ({
      assessment_id: id,
      question_id: qid
    }));
    await sb.from('assessment_questions').insert(inserts);
  }

  const { data, error } = await sb.from('assessments')
    .update({ status: 'READY', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, _frozenCount: questionIds.length };
}

/** Assessment Instances (Phase 9) */
export async function fetchAssessmentInstances(classInstanceId = null) {
  const sb = await getSupabase();
  let query = sb.from('assessment_instances').select('*, assessments(title, category), class_instances(*)').is('deleted_at', null);
  if (classInstanceId) query = query.eq('class_instance_id', classInstanceId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}


export async function createAssessmentInstance(payload) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('assessment_instances')
    .insert({
      class_instance_id: payload.class_instance_id,
      assessment_id: payload.assessment_id,
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

export async function createChallengeInstance(payload) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('assessment_instances')
    .insert({
      class_instance_id: payload.class_instance_id,
      assessment_id: payload.assessment_id,
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

export async function startAssessmentAttempt(studentId, assessmentInstanceId) {
  const sb = await getSupabase();

  // 1. Fetch Assessment Instance and Definition Details
  const { data: instData, error: instErr } = await sb.from('assessment_instances')
    .select('*, assessments(*)')
    .eq('id', assessmentInstanceId)
    .single();

  if (instErr || !instData) throw new Error('Assessment instance not found.');
  const definition = instData.assessments;

  // 2. Determine max attempts
  const maxAttempts = instData.max_attempts || definition.default_max_attempts || 1;

  // 3. Check existing attempts
  const { data: existingAttempt, error: existErr } = await sb.from('attempts')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('assessment_instance_id', assessmentInstanceId)
    .order('created_at', { ascending: false });

  if (!existErr && existingAttempt && existingAttempt.length > 0) {
    const inProgress = existingAttempt.find(a => a.status === 'IN_PROGRESS');
    if (inProgress) {
      return { attemptId: inProgress.id, status: 'RESUMED' }; // Resume existing
    }
    if (existingAttempt.length >= maxAttempts) {
      throw new Error(`Maximum attempts (${maxAttempts}) reached for this assessment.`);
    }
  }

  // 4. Create new attempt
  const duration = instData.working_duration_minutes || definition.working_duration_minutes || 60;
  const now = new Date();
  const deadline = new Date(now.getTime() + duration * 60000);

  const { data: newAttempt, error: attErr } = await sb.from('attempts')
    .insert({
      student_id: studentId,
      assessment_instance_id: assessmentInstanceId,
      status: 'IN_PROGRESS',
      expected_end_at: deadline.toISOString(),
      score: 0,
      percentage: 0
    })
    .select()
    .single();

  if (attErr) throw attErr;

  // 5. Build snapshots from definitions
  const { data: defQuestions, error: qErr } = await sb.from('assessment_questions')
    .select('question_id, questions(question_text, topic_id, question_type, correct_answer, topics(name))')
    .eq('assessment_id', definition.id);

  if (qErr) throw qErr;

  const answerInserts = (defQuestions || []).map(dq => {
    const q = dq.questions;
    let acceptedAnswers = [];
    if (q.correct_answer) {
      acceptedAnswers = q.correct_answer.split(/[\/;]/).map(s => s.trim()).filter(Boolean);
    }

    return {
      attempt_id: newAttempt.id,
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
    const { error: insErr } = await sb.from('attempt_answers').insert(answerInserts);
    if (insErr) throw insErr;
  }

  return { attemptId: newAttempt.id, status: 'STARTED' };
}

export async function submitAssessmentAttempt(attemptId, answersMap, options = {}) {
  const sb = await getSupabase();

  // 1. Fetch the attempt to ensure it's valid and not already submitted
  const { data: att, error: attErr } = await sb.from('attempts')
    .select('*, assessment_instances(*)')
    .eq('id', attemptId)
    .single();

  if (attErr || !att) throw new Error('Attempt not found.');
  if (att.status !== 'IN_PROGRESS') throw new Error(`Attempt already ${att.status}`);

  // 2. Fetch all pre-existing attempt_answers to evaluate
  const { data: attemptAnswers, error: fetchErr } = await sb.from('attempt_answers')
    .select('*')
    .eq('attempt_id', attemptId);

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
      sb.from('attempt_answers')
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
  const { data: updatedAttempt, error: upErr } = await sb.from('attempts')
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
  return updatedAttempt;
}

export async function fetchAssessmentDefinitionQuestions(assessmentDefinitionId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('assessment_questions')
    .select('*, questions(*)')
    .eq('assessment_id', assessmentDefinitionId)
    .order('question_order', { ascending: true });
  if (error) {
    const { data: qData, error: qErr } = await sb
      .from('questions')
      .select('*')
      .eq('assessment_id', assessmentDefinitionId)
      .order('created_at', { ascending: true });
    if (qErr) throw qErr;
    return qData || [];
  }
  return data || [];
}

export async function fetchAssessments(filters = {}) {
  const sb = await getSupabase();
  try {
    // Only join modules — classes/topics don't have confirmed FK in schema cache yet
    let query = sb.from('assessments').select('*, modules(name, cover_image_url)');
    
    let orConditions = [];
    if (filters.program_id) orConditions.push(`program_id.eq.${filters.program_id}`);
    if (filters.batch_id) orConditions.push(`batch_id.eq.${filters.batch_id}`);
    
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }
    
    const { data, error } = await query.is('deleted_at', null).order('created_at', { ascending: false });
    
    if (!error && data) {
      // Manually hydrate class name if class_id exists (2-step to avoid missing FK join)
      if (data.some(a => a.class_id)) {
        const classIds = [...new Set(data.map(a => a.class_id).filter(Boolean))];
        if (classIds.length > 0) {
          const { data: classData } = await sb.from('classes').select('id, name').in('id', classIds);
          const classMap = {};
          if (classData) classData.forEach(c => { classMap[c.id] = c; });
          data.forEach(a => { a.classes = a.class_id ? (classMap[a.class_id] || null) : null; });
        }
      }
      return data;
    }
  } catch (err) {
    console.warn('assessments table query fallback:', err.message);
  }
  return [];
}

/**
 * TopsCore AI Evaluation Engine (TAEE) API Hook
 */
export async function invokeAIEvaluation(payload) {
  const sb = await getSupabase();
  try {
    const { data, error } = await sb.functions.invoke('evaluate-assessment', {
      body: payload
    });
    if (!error && data) return data;
    throw error;
  } catch (err) {
    console.warn('Edge function invoke failed, routing to local client fallback:', err.message);
    const { evaluateSubmission } = await import('./ai-evaluation-engine.js');
    return await evaluateSubmission(payload);
  }
}

export async function fetchAssessmentResultsFromDB(studentId, assessmentId = null) {
  const sb = await getSupabase();
  try {
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
  } catch (err) {
    console.warn('assessment_results fetch fallback:', err.message);
    return [];
  }
}


/** Generate AI Narrative Report for an attempt */
export async function generateAttemptNarrative(attemptId) {
  const sb = await getSupabase();
  const { data: attempt, error: attemptErr } = await sb.from('attempts')
    .select('id, score, percentage, grade, status, students (name), assessments (name, assessment_type), assessments (title, category)')
    .eq('id', attemptId)
    .single();

  if (attemptErr || !attempt) throw new Error('Failed to fetch attempt details for narrative generation.');

  const { data: answers, error: ansErr } = await sb.from('attempt_answers').select('question_snapshot, student_answer, is_correct, evaluation_result, score').eq('attempt_id', attemptId);
  if (ansErr) throw ansErr;

  const studentName = attempt.students?.name || 'The student';
  const AssessmentTitle = attempt.assessments?.name || attempt.assessments?.title || 'the assessment';
  const score = attempt.score;
  const percentage = attempt.percentage;
  const grade = attempt.grade;

  const incorrectAnswers = (answers || []).filter(a => !a.is_correct || a.score === 0);
  const areasForImprovement = incorrectAnswers.slice(0, 3).map(a => {
    let qText = 'Unknown Question';
    try {
      if (a.question_snapshot) {
        const qObj = typeof a.question_snapshot === 'string' ? JSON.parse(a.question_snapshot) : a.question_snapshot;
        qText = qObj.question_text || 'Unknown Question';
      }
    } catch(e) {}
    return '- Question: ' + qText + '. Student Answer: ' + (a.student_answer || 'N/A');
  }).join('\n');

  const payload = {
    prompt: "Act as a Cambridge English Assessmentiner. Review this student's Assessment data. Write a 1-paragraph (max 4 sentences) encouraging but professional English narrative report highlighting their strengths and 1 area for improvement based on their incorrect answers. Student: " + studentName + " Assessment: " + AssessmentTitle + " Score: " + score + " (" + percentage + "% - Grade " + grade + "). Incorrect Answers Sample: " + (areasForImprovement || 'None. Perfect score!')
  };

  let narrativeText = '';
  try {
    const aiResponse = await callEdgeFunction('generate-narrative', payload);
    narrativeText = aiResponse.narrative || aiResponse.text || aiResponse.result || '';
  } catch (aiErr) {
    console.warn('Edge Function unavailable. Using local fallback.', aiErr.message);
    const strengthAdjectives = percentage >= 90 ? 'outstanding' : percentage >= 70 ? 'commendable' : 'developing';
    const improvement = incorrectAnswers.length > 0 ? 'One area for improvement is careful attention to detail in sections where errors occurred.' : 'The student demonstrated exceptional mastery across all tested areas.';
    narrativeText = studentName + ' has shown ' + strengthAdjectives + ' performance in ' + AssessmentTitle + ', achieving a solid score of ' + percentage + '%. The results indicate a good foundational understanding of the core concepts tested. ' + improvement + ' With continued practice, ' + studentName + ' is well-positioned for further academic success.';
  }

  if (!narrativeText) throw new Error('AI Engine returned an empty response.');

  await sb.from('attempts').update({ narrative_report: narrativeText }).eq('id', attemptId);
  try { await sb.from('attempts').update({ narrative_report: narrativeText }).eq('id', attemptId); } catch(e) {}
  return narrativeText;
}

// ─── Backward-compatibility aliases ────────────────────────────────────────
// dashboard.html uses these older names; map them to the current exports
// to avoid breaking the student dashboard without touching the large HTML file.


