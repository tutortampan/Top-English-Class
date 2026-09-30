// TOPS CORE — Session Management
// Stores authenticated student/admin session in sessionStorage only.
// Never stores plaintext PINs.

const SESSION_KEY = 'topscore_session';
const ADMIN_SESSION_KEY = 'topscore_admin_session';

// Legacy Purge: Clear any old "Top English" branding from storage
(function purgeLegacyStorage() {
  try {
    ['localStorage', 'sessionStorage'].forEach(storeType => {
      const store = window[storeType];
      if (!store) return;
      const keysToRemove = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && (key.toLowerCase().includes('topenglish') || key.toLowerCase().includes('top_english'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => store.removeItem(k));
    });
  } catch (e) {
    console.warn("Legacy purge failed:", e);
  }
})();

export function setStudentSession(data) {
  const session = {
    student_id: data.student_id,
    student_name: data.student_name,
    gender: data.gender || null,
    education: data.education || null,
    institution_id: data.institution_id || null,
    institution_name: data.institution_name || null,
    program_id: data.program_id,
    program_name: data.program_name,
    class_id: data.class_id || null,
    class_name: data.class_name || null,
    batch_id: data.batch_id || null,
    batch_name: data.batch_name || null,
    level_id: data.level_id || null,
    level_number: data.level_number || null,
    level_name: data.level_name || null,
    authenticated_at: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateStudentSessionGender(gender, studentName) {
  const session = getStudentSession();
  if (session) {
    session.gender = gender;
    if (studentName) session.student_name = studentName;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function getStudentSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStudentSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function requireStudentSession(redirectTo = '/index.html') {
  const session = getStudentSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

// Admin session
export function setAdminSession(data) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
    admin_id: data.admin_id || 'admin',
    role: 'admin',
    authenticated_at: new Date().toISOString(),
  }));
}

export function getAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function requireAdminSession(redirectTo = '/admin.html') {
  const session = getAdminSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}
