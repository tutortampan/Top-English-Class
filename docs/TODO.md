# TODO LIST

## High Priority
- [x] DB-001 | Create documentation state files (`docs/*`) | HIGH | depends: none | criteria: all required docs initialized
- [x] DB-002 | Create SQL Database schema with RLS and Audit Logs (`supabase-setup.sql`) | HIGH | depends: DB-001 | criteria: schema created with all tables & constraints
- [x] BE-001 | Implement Edge Functions (`student-login`, `start-exam`, `submit-exam`) | HIGH | depends: DB-002 | criteria: edge functions written
- [x] FE-001 | Create CSS design system & dynamic UI assets (`css/style.css`, `css/admin.css`, `css/dashboard.css`) | HIGH | depends: DB-001 | criteria: rich aesthetics, dark mode, glassmorphism
- [x] FE-002 | Create core JS modules (`js/app.js`, `js/api.js`, `js/session.js`, `js/timer.js`, `js/speech.js`, `js/supabase.js`) | HIGH | depends: FE-001 | criteria: ES modules initialized
- [x] FE-003 | Create HTML pages (`index.html`, `dashboard.html`, `exam.html`, `result.html`, `admin.html`) | HIGH | depends: FE-002 | criteria: full user flows functional

## Medium Priority
- [x] FE-004 | Admin 4-Tab Interface (`DATABASE`, `CLASS`, `STUDENT`, `EXAM`) | MEDIUM | depends: FE-003 | criteria: admin tabs fully interactive
- [x] FE-005 | Speech-to-Text & Written Tolerance engine | MEDIUM | depends: FE-003 | criteria: speech API integration & Damerau-Levenshtein score calculation

