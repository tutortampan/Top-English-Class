// TOP ENGLISH CLASS — Session Management
// Stores authenticated student/admin session in sessionStorage only.
// Never stores plaintext PINs.

const SESSION_KEY = 'tec_session';
const ADMIN_SESSION_KEY = 'tec_admin_session';

export function setStudentSession(data) {
  const session = {
    student_id: data.student_id,
    student_name: data.student_name,
    gender: data.gender || null,
    program_id: data.program_id,
    program_name: data.program_name,
    class_id: data.class_id,
    class_name: data.class_name,
    batch_id: data.batch_id || null,
    batch_name: data.batch_name || null,
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
