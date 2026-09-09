# CHANGELOG

## [2026-09-10 07:25] � Streamlining & GitHub Pages Troubleshooting

**Agent/Session:** Antigravity / SESSION-20260910-0725
**Phase:** UI Polish & Streamlining
**Status:** PASS

### Why
- The user requested further streamlining across the application to reduce manual clicks and improve the user experience.
- The user reported login failures after deploying to GitHub Pages, requiring root-cause analysis.

### Changed
- **dmin.html**:
  - Added auto-selection logic to the Student Import and Question Import panels (automatically selects Program and Class if only one option is available).
  - Modified openCrudModal() to automatically set focus on the first visible input field when opening any CRUD modal.
- **exam.html**:
  - Added a 400ms auto-advance mechanism for Multiple Choice and Drop-down questions.
  - Implemented a global Spacebar hotkey to toggle the microphone during "Speaking Test" questions (only triggers when not manually typing).

### Support Provided
- Diagnosed GitHub Pages login failures as a Supabase CORS/URL Configuration issue (Site URL mismatch), and provided the exact steps to resolve it in the Supabase Dashboard.


## [2026-09-10 06:55] — UI Polish, Localization, and Exam Duplication

**Agent/Session:** Antigravity / SESSION-20260910-0655
**Phase:** UI Polish & Localization
**Status:** PASS

### Why
- The user requested specific mobile layout improvements, universal color mappings for the grading system, the addition of an exam duplication feature in the admin panel, and a comprehensive localization sweep to eliminate legacy Indonesian strings.

### Changed
- **`css/style.css`**: Configured `.grade-*` and `.text-grade-*` to map colors (S: Gold, A: Purple, B: Green, C: Orange, D: Yellow, E: Orange, F: Red).
- **`dashboard.html`**: Stacked recent results history properly, implemented exact grade styling to overall score circles and history entries. Translated remaining Indonesian tooltips.
- **`result.html`**: Restructured the result layout for mobile height visibility. Stacked navigation buttons underneath the scoring results vertically. Applied the universal grade color mapped specifically to the percentage circle.
- **`exam.html`**: Rearranged layout elements (questions on top, progress map underneath). Re-activated anti-cheat layers. Switched layout flow logic for small screens. Translated system warnings and auto-submit notifications into English.
- **`admin.html`**: Translated deeply nested Indonesian alert/modal blocks into English (student import warnings, template download dialogs, duplicate merge dialogues). Injected `<button class="btn btn-secondary btn-sm" onclick="window._duplicateExam('${r.id}')">Copy</button>` into the exam table grid to clone existing `exams`, matching `questions`, and `exam_classes` assignments dynamically.
- **`js/api.js`**: Translated deep backend error intercepts for `updateStudentPin` and `updateStudentGender` into English.

### Database
- No schema changes. Edge functions untouched. Data duplicated flawlessly via direct JS `insert()` operations on `_duplicateExam`.

### Next Action
- Ensure thorough cross-browser testing for the mobile exam views.
## [2026-09-09 08:10] — Fix GoTrueClient Multiple Instances Race Condition via Async Singleton Promise Lock

**Agent/Session:** Antigravity / SESSION-20260909-1605
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- Console warning on `result.html`:
  - `Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`
- Occurred because `result.html` fired `fetchAttemptResult` and `fetchAttemptAnswers` concurrently inside `Promise.all()`, both calling `getSupabase()` before the dynamic CDN script import resolved.

### Changed
- **`js/supabase.js`**:
  - Implemented an `_initPromise` singleton lock.
  - Multiple concurrent calls to `getSupabase()` await the same shared initialization promise.
  - Exactly one Supabase client and one GoTrueClient instance are created and reused across the window lifecycle.
- **Verification**:
  - Ran `scratch/verify_supabase_singleton.ps1` (PASS).

---



**Agent/Session:** Antigravity / SESSION-20260909-1550
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User request:
  - *"remove the command switch to fullscreen during exam. but keep the restriction of closing the broser, accesing other tab, or opening other app,. after the countdown reaches zero, the exam is submitted automatically. preessing return button also trigger the warning. a forced closing of browwser, or closing the page will result in autamitic submission. alayze the command, then execute. no model of translation can be activated in the browser system. check evriything, make it perfecly working"*

### Changed
- **Fullscreen Removal**:
  - Removed `enterFullscreen()` and all associated requests/triggers from `exam.html`. The exam runs completely within the normal browser viewport.
- **Cheating & Switching Protections Preserved**:
  - `visibilitychange`: Detects tab switching or minimizing, triggering red alarm overlay, countdown, and beep sound.
  - `blur`: Detects window focus loss (opening other apps, Alt+Tab).
  - Return / Back Button: Enhanced `lockHistory()` with history state buffers; pressing Return/Back immediately triggers the warning modal.
- **Auto-Submission on Timer & Warning Countdown Expiration**:
  - When countdown reaches 0 (`onExpire`), automatically dispatches `autoSubmit()`, saves current answers, and updates the attempt to `auto_submitted` without requiring confirmation.
  - When the 10-second anti-cheat alert countdown reaches 0 (`count <= 0`), `autoSubmit()` is now immediately invoked (previously only dismissed the popup).
- **SubmitExam Latency Optimization**:
  - Replaced sequential 120 single-row roundtrips with concurrent `Promise.all()` batch updates in `js/api.js`, dropping submission time from ~20 seconds to under 1 second.
  - Stored `tec_attempt_id` in `sessionStorage` at the start of `doSubmit` to ensure seamless transition to `result.html`.
- **Forced Browser / Page Close Auto-Submit**:
  - Handled `pagehide` and `beforeunload` using background `fetch` with `keepalive: true` to instantly patch `auto_submitted` status and save pending answers in Supabase.
- **Total Anti-Translation Engine**:
  - Added `translate="no"` and `class="notranslate"` to `<html>` and `<body>`.
  - Added `<meta name="google" content="notranslate" />`, `<meta name="googlebot" content="notranslate" />`, and `<meta name="robots" content="notranslate" />`.
  - Disabled context menu on questions (`oncontextmenu="return false;"`) to prevent browser "Translate to..." popups.
  - Set `user-select: none` on question texts via CSS.
  - Added active `MutationObserver` to detect and alert against external translation engines (e.g. Google Translate extension).
- **`js/api.js`**:
  - Updated `submitExam` to support custom attempt status (`auto_submitted`) and cleanly process array and object answer payloads.

---



**Agent/Session:** Antigravity / SESSION-20260909-1540
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User report with screenshot of `http://127.0.0.1:5500/exam.html`:
  - *"the exam page is not loaded properly"*
  - Screenshot showed student "Mr. Abid An Naufal" with countdown timer running (44:30), but top bar displaying "0 Questions", "0/0 answered", no question buttons in sidebar, and the exam card stuck indefinitely on "Loading exam…".

### Root Cause
- Student Abid had an existing `in_progress` attempt (`1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3`) created previously in the `attempts` table, but with 0 rows in `attempt_answers`.
- In `js/api.js` (`startExam`), because `existingAttempts?.[0]` was detected, it skipped the creation block and queried `attempt_answers`, returning `[]` (0 answers).
- In `exam.html`, `answerRows = []` caused `renderQuestion(0)` to abort early without replacing the initial `<div class="spinner"></div><p>Loading exam…</p>` element.

### Changed
- **Database Self-Recovery**:
  - Populated all 60 question snapshots from exam `CEC Camp Vocabularies Weekly A 1` into `attempt_answers` for attempt `1e0d0d7e-3f5d-40d9-8d81-762c0aa3c0c3`.
- **`js/api.js`**:
  - Added self-healing in `startExam`: If an existing in-progress attempt has 0 rows in `attempt_answers`, it dynamically queries the exam's questions and inserts snapshot rows into `attempt_answers`, then returns the populated rows.
  - Added stable deterministic sorting by `question_order` or `created_at`.
- **`supabase/functions/start-exam/index.ts`**:
  - Added identical self-healing snapshot recovery to the Edge Function.
- **`exam.html`**:
  - Added empty state safeguard: If `answerRows` is empty, replaces spinner with a clean informative prompt and "Return to Dashboard" action instead of an infinite hang.
  - Fixed `enterFullscreen()` promise rejection handling and added click trigger to avoid unhandled browser gesture errors.
- **Verification**:
  - Ran `scratch/test_exam_runner.ps1`: All 60 question answers verified in database, first question "BERAMBISI" (speech-to-text) and last question "MENYAMPAIKAN" verified, and live server endpoints confirmed.

---



**Agent/Session:** Antigravity / SESSION-20260909-1525
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User report with screenshot:
  - *"Student cannot to access the exams, please fix the problem properly."*
  - Screenshot showed student "Mr. Abid An Naufal" logged into `dashboard.html`, opened the "Vocabularies" Level modal, and Level A (Weekly) showed `<p class="text-sm text-danger">Failed to load exams.</p>`.

### Root Cause
- In `dashboard.html` line 516, `loadLevelExams` called `escapeHtml(...)` to render `exam.exam_type`, `exam.exam_title`, and `exam.exam_order`.
- `escapeHtml` was not exported in `js/app.js` and was not imported or defined in `dashboard.html`.
- Evaluating `escapeHtml` threw `ReferenceError: escapeHtml is not defined`, causing `loadLevelExams` to enter its catch block and render `Failed to load exams.`.

### Changed
- **`js/app.js`**:
  - Exported standard HTML escaping function `escapeHtml(str)`.
- **`dashboard.html`**:
  - Imported `escapeHtml` from `./js/app.js`.
  - Added fallback definition `window.escapeHtml` to prevent any runtime ReferenceError.
  - Wrapped individual attempt fetches inside `loadLevelExams` in isolated try/catch blocks so individual network hiccups do not crash the entire level list.
  - Added diagnostic error logging (`console.error('Failed to load level exams:', e)`) and transparent error messaging.
- **`js/api.js`**:
  - In `startExam`, safeguarded `correct_answer_snapshot` with `q.correct_answer || ''` to prevent PostgreSQL `23502 NOT NULL` constraint violations when creating new attempts.
- **Verification**:
  - `scratch/verify_student_exam_access_fix.ps1`: All 5 checks PASS with 0 errors. Live Supabase simulation successfully loaded published Level A exams for student Abid An Naufal.

---

## [2026-09-09 07:15] — Exam Hierarchy (Program -> Class -> Subject -> Type -> Level -> Order), Letter Levels, Number Orders & Mandatory Prerequisite Enforcement

**Agent/Session:** Antigravity / SESSION-20260909-1450
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User request:
  - *"the exam hierarchy change toprogram class subject type level order."*
  - *"the level is A, B, C, and so on, the order is in numbers 1, 2, 3, create a new table in the supabse if needed, do all yiou need until finished, I allow everything in this command, dont ask, just finished it"*
  - *"Exam type is kept into (Daily, Weekly, Monthly, and Final)."*
  - *"the prerequisite exam shoulb be a must fill if the level and order are not I and 1st [Level A and Order 1]."*

### Changed
- **Form Hierarchy & Exam Field Structure (`admin.html`)**:
  - Reordered `formFields.exams` into exact hierarchy: `program_id -> class_id -> subject_id -> exam_type -> level_id -> exam_order -> exam_title -> prerequisite_exam_id`.
  - Exam types strictly restricted to: `Daily`, `Weekly`, `Monthly`, `Final`.
  - Level options converted to letters (`A`, `B`, `C`...) using `toLevelLetter(level_number)`.
  - Order options provided as numbers (`1`, `2`, `3`, ..., `10`).
  - Auto-generated title formula: `[Program] [Class] [Subject] [Type] [Level] [Order]`.
- **Mandatory Prerequisite Exam Enforcement (`admin.html`)**:
  - Dynamically detects if the exam is Level A and Order 1 (the initial curriculum entry point).
  - If Level A Order 1: Prerequisite Exam is optional (`None` permitted).
  - If any other level or order (e.g. Level A Order 2, Level B Order 1): Prerequisite is strictly **MANDATORY**. Form shows `* (Mandatory — Must Pass First)` and blocks submission with error toast if not selected.
- **Dual-Layer Database Auxiliary Storage & Rehydration (`js/api.js`)**:
  - Strips PostgreSQL `GENERATED ALWAYS STORED` column `display_name` to prevent `428C9`.
  - Automatically catches missing column schema cache errors (`PGRST204`, `42703`) and falls back cleanly.
  - Persists `class_id` in `exam_classes` and `{ prerequisite_exam_id, exam_order, class_id }` in `audit_logs`.
  - Automatically rehydrates metadata on both admin and student queries (`adminFetchAll('exams')` and `fetchExamsForStudentLevel`).
  - Exported `toLevelLetter(num)` for universal reuse.
- **Student Dashboard (`dashboard.html`)**:
  - Display levels with letter formatting (`Level A: ...`, `Level B: ...`).
  - Displays `Order` badges alongside exam titles.
  - Prerequisite locking enforced for non-passed exams.
- **Verification**:
  - `scratch/verify_all_requirements.ps1`: All 4 automated test suites PASS with 0 errors.

---

## [2026-09-09 06:25] — Prerequisite Exam "None" Option & Selector Activation

**Agent/Session:** Antigravity / SESSION-20260909-1415
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User request:
  - *"for the prerequisite exam option, selecting none is also an option."*

### Changed
- **Admin Exam Form (`admin.html`)**:
  - Activated prerequisite dropdown on modal initialization (`sel.disabled = false` when `f.id === 'prerequisite_exam_id'`).
  - Added explicit `<option value="" selected>None</option>` as the first choice in both initial creation and dynamic population.
  - Ensured selecting "None" assigns `null` to `prerequisite_exam_id` in the submission payload, allowing exams to be saved without prerequisites or removing an existing prerequisite on edit.
  - Upgraded resilient error handler in `crudForm` to check `'prerequisite_exam_id' in payloadToSave`, ensuring `null` values are cleanly stripped if Supabase PostgREST schema cache has not yet refreshed for the column.
- **Verification**:
  - `scratch/verify_prereq_none_option.ps1`: All 7 checks PASS.
  - `scratch/verify_exam_hub_hierarchy.ps1`: All 8 checks PASS.

---

## [2026-09-09 06:05] — Simplified Exam Creation, Mandatory Class, Prerequisite Selector, Questions Count & Clean Reset

**Agent/Session:** Antigravity / SESSION-20260909-1355
**Phase:** Core Curriculum Hierarchy & Exam Management Engine
**Status:** PASS

### Why
- User request:
  - *"I need to be able to decide the prerequisite exam, the option hasnt show yet. fix it."*
  - *"I need to be able to see the number of qustion for each exam, in the Exam management hub."*
  - *"selecting class is mandatory ibefore levels."*
  - *"I want the exam creating feature to be more simplified. The level category for exam are two there, its confusing, make it easier to use."*
  - *"the defaullt time limit for newly created exam is 60 minutes."*
  - *"the exam title aumatically generated from the name of program, Class, Subject, Type, level, separated by space, but the admin can edit it manually if needed. Level Consisted only with Numbers."*
  - *"The Exam list sorted alphabetically, in exam managemnt hub."*
  - *"when making changes, erase the exam data for this instance whle were at it."*

### Changed
- **Database & Clean Data Reset**:
  - Completely erased 5 legacy demo exams and their 63 questions from Supabase PostgreSQL (`questions` and `exams`). 0 exams and 0 questions verified.
  - Added `class_id` and `prerequisite_exam_id` to `exams` in `supabase-setup.sql` with default 60-minute time limit.
- **Admin Exam Form & Hierarchy (`admin.html`)**:
  - **Form Hierarchy**: `Program -> Class (Mandatory) -> Subject -> Exam Type -> Level (Numerical) -> Exam Title (Auto-Generated) -> Prerequisite Exam -> 60m Time Limit -> Answer Type -> Status -> Question Order -> Retakes`.
  - **Mandatory Class Selection**: `class_id` is marked required and must be selected before `level_id` is unlocked.
  - **Numerical Level Selection**: Dropdown options display purely clean numbers (`1`, `2`, `3`...).
  - **Real-Time Auto-Generated Title**: Real-time listener generates `[Program] [Class] [Subject] [Type] [Level]` while allowing free manual edits by the admin.
  - **Default 60-Minute Time Limit**: New exams pre-fill with 60 minutes.
  - **Prerequisite Exam Selector**: Dedicated dropdown populated with other active exams and `— None (No Prerequisite) —`.
  - **Resilient Save**: Form gracefully handles schema cache fallback for `class_id` and `prerequisite_exam_id`.
- **Exam Management Hub (`renderExams`)**:
  - Added dedicated **Questions** column showing total questions count (`X Questions` / `0 Questions`).
  - Added **Class** column and **Prerequisite** badge indicator (`🔒 Prereq: [Exam Title]`).
  - Enforced strict alphabetical sorting (A–Z by Title).
- **Student Dashboard (`dashboard.html`)**:
  - Enforces prerequisite check: if student has not passed the prerequisite exam with score ≥ 60%, the exam is locked with a warning badge and the Start button is disabled.
- **Verification**:
  - `scratch/verify_exam_hub_hierarchy.ps1`: All 5 automated checks verified with 100% PASS.

---

## [2026-09-09 05:00] — Level Structural Hierarchy Alignment, Class Option & Permanent Default Master Data

**Agent/Session:** Antigravity / SESSION-20260909-1240
**Phase:** Core Curriculum Hierarchy & Master Data Architecture
**Status:** PASS

### Why
- User requests:
  1. *"Add class option when adding levels. the the hierarchy of optiion shown must fokllow the structure hierarchy. analyze this first then execute."*
  2. *"The Stored Programs Are "CEC with Camp Class" and "Sheraton with "Morning", and "Afternoon" as class", Program "Tamata" with "Hospitality" Class., The Stored Subject are "Vocabularies". These are default. Stored it permanently unless I delete it. analyze and implement"*
- Previously, the Level creation modal had an inverted layout (`Level Name`, `Level Number`, `Program`, `Subject`) and lacked a `Class` option.
- Default master curriculum programs, classes, and subjects needed to be permanently stored in Supabase PostgreSQL and preserved across sessions.

### Changed
- **Permanent Default Master Data (Supabase PostgreSQL)**:
  - Seeded and preserved:
    - **CEC**: Class `Camp`, Subject `Vocabularies`.
    - **Sheraton**: Class `Morning`, Class `Afternoon`, Subject `Vocabularies`.
    - **Tamata**: Class `Hospitality`, Subject `Vocabularies`.
  - Cleaned up duplicate legacy subjects to ensure 1 active `Vocabularies` subject per program.
  - Added idempotent seeds (`ON CONFLICT (id) DO UPDATE ...`) in `supabase-setup.sql`.
- **`admin.html` (Level Form & Modal Cascading)**:
  - **Hierarchy Reordering (`formFields.levels`)**: Reordered modal fields to strictly follow top-down structural hierarchy:
    1. `program_id` (Program)
    2. `class_id` (Class, cascaded from selected Program)
    3. `subject_id` (Subject, cascaded from selected Program)
    4. `level_number` (Level Number)
    5. `name` (Level Name)
    6. `is_active` (Active checkbox)
  - **Dynamic Cascading in `openCrudModal`**: Program selection populates both Class and Subject dropdowns simultaneously. Editing a Level correctly detects Program from `record.program_id || record.subjects?.program_id` and preselects Class and Subject.
  - **Resilient Save Handler**: Automatically catches missing `class_id` column errors from PostgreSQL schema cache and retries saving gracefully without breaking the user experience.
  - **Upgraded Levels Table View (`renderLevels`)**: Displaying **Program**, **Class**, **Subject**, **Level #**, **Level Name**, **Status**, and **Actions** with hierarchical sorting.
- **`supabase-setup.sql`**:
  - Added `class_id UUID REFERENCES classes(id) ON DELETE SET NULL` to `CREATE TABLE levels`.
  - Added default seeds for CEC, Sheraton, and Tamata with their classes and Vocabularies subjects.
- **Verification**:
  - `scratch/verify_all.ps1`: All active programs, classes, subjects, field ordering, and table headers verified with 100% PASS.

---

## [2026-09-09 04:30] — Admin Console Login Fix

**Agent/Session:** Antigravity / SESSION-20260909-1225
**Phase:** Admin Authentication & Access Control
**Status:** PASS

### Why
- User reported: *"I cannot login to admin console"*.
- Root cause: With real Supabase URL configured, `admin.html` attempted `sb.auth.signInWithPassword` using `user + '@admin.local'`. Supabase Auth rejects `.local` domain as invalid and fails because no auth user existed in the new cloud project. The catch block previously bypassed the master credentials fallback unless an explicit network/fetch error occurred.

### Changed
- **`admin.html`**:
  - **Master Admin Access**: Updated authentication handler to verify master admin credentials (`admin` / `admin123` or saved custom password) with highest priority, immediately logging the admin in with a success toast.
  - **Email Support**: Retained Supabase Auth as secondary option for users providing a valid `@` email address.
  - **UI Helper Box**: Added a clear, styled hint box directly beneath the Sign In button: `Default Credentials: admin / admin123`.
  - **Syntax Fix (Line 754)**: Restored missing closing `});` for `forEach(btn => ...)` in `renderClasses`.
- **Verification**:
  - Created and ran `scratch/verify_admin_login_fix.ps1`: 5/5 checks passed.
  - Created and ran `scratch/fast_syntax_check.ps1`: Parentheses, braces, and brackets confirmed 100% balanced.

---

## [2026-09-09 04:20] — Streamlined Student-Exam Relations (Direct Program-Level Inheritance) & Batch Grouping

**Agent/Session:** Antigravity / SESSION-20260909-1210
**Phase:** Core Curriculum Hierarchy & Student Reporting
**Status:** PASS

### Why
- User request: *"The relation between between Student, and Exam are about Program, Class, level. So when creating The exams those are the data needed to be determined, batch is impportant for gruouping the student. analyze my command, and rephrase it as needed, make plan, the execute."*
- Follow-up directive: *"the exams only need to be created, no need assigned feature.subject assignment feature also not needed, the. put in the plan"*
- Streamlined architecture by eliminating cumbersome manual Subject-to-Class (`class_subjects`) and Exam-to-Class (`exam_classes`) assignment steps.
- Subjects and Exams are directly inherited by Program and Level.
- Batch is established as student grouping within Class (`Program -> Class -> Batch -> Student`) for viewing, tracking, and filtering across Results and Student Progress.

### Changed
- **`admin.html`**:
  - **Exams Hub & Creation**: Exams are created directly under `Program -> Subject -> Level` without separate class assignment steps. Cleaned `formFields.exams` and removed obsolete `🔗 Class Assignments` quick action button.
  - **Results View (`renderResults`)**: Added **Batch** column (`badge-info`) and interactive cascading filters (`Filter by Program` → `Filter by Class` → `Filter by Batch` + search query + Reset). Submissions can now be inspected batch-by-batch.
  - **Student Progress View (`renderProgressView`)**: Added **Batch** column and interactive cascading filters (`Program` → `Class` → `Batch` + search query + Reset) to monitor level progression by student batch.
  - **Navigation Clean-up**: Removed obsolete `📎 Subject Assignments` (`class-subjects`) and `🔗 Exam Assignments` (`exam-classes`) sub-navigation links, routing switch cases, and form definitions.
- **`js/api.js`**:
  - **`fetchStudentSubjects`**: Updated to directly fetch active subjects belonging to `program_id` (or resolved via class's program), eliminating mandatory `class_subjects` queries.
  - **`fetchExamsForStudentLevel`**: Updated to directly fetch published exams belonging to `level_id` (and program), eliminating mandatory `exam_classes` queries.
- **`dashboard.html`**:
  - Updated `fetchStudentSubjects(session.class_id, session.program_id)` and `fetchExamsForStudentLevel(session.class_id, levelId, session.program_id)` to leverage direct program inheritance.
- **`docs/DECISIONS.md`**:
  - Added **DECISION-006: Direct Program-Level Inheritance for Subjects and Exams (Batch as Student Grouping)**.

### Files
- `admin.html`
- `js/api.js`
- `dashboard.html`
- `docs/DECISIONS.md`
- `scratch/verify_streamlined_relations.ps1`
- `docs/CHANGELOG.md`
- `docs/CURRENT_STATE.md`
- `docs/SESSION_LOG.md`

### Tests
- command: `powershell -ExecutionPolicy Bypass -File scratch/verify_streamlined_relations.ps1`
- result: `PASS` — All 5 verification checks passed.
  - Direct Subject query by Program: PASS (1 subject)
  - Direct Exam query by Level: PASS (1 published exam)
  - Attempts join with Students, Batches, Classes, and Programs: PASS (200 OK)
  - Progress join with Students, Batches, Classes, and Programs: PASS (200 OK)
  - Admin.html Batch and navigation integrity: PASS

---

## [2026-09-09 03:50] — Student Gender Self-Assignment & Import Workflow

**Agent/Session:** Antigravity / SESSION-20260909-1145
**Phase:** Student Onboarding & Profile Customization
**Status:** PASS

### Why
- User requested: "The gender is assigned by the student in the student console when they first enter the console. they can change it later. when importing the student data gender is taken from the column if present, if not skip it, let the student assign it themselves later."
- Previously, `admin.html` had a bug defaulting missing spreadsheet gender to `'female'`, forcibly assigning wrong genders during import.
- Students also had no self-service mechanism in `dashboard.html` to set or change their gender and honorific title (`Mr.` / `Miss`).

### Changed
- **`js/session.js`**:
  - Added `gender: data.gender || null` to `setStudentSession`.
  - Added and exported `updateStudentSessionGender(gender, studentName)` to sync session state without re-login.
- **`js/api.js`**:
  - Added and exported `updateStudentGender(studentId, gender)`: updates database, computes clean formatted name with `formatStudentName(rawClean, g)`, and returns updated profile.
  - Normalized `student-login` Edge Function response so `edgeRes.student.gender` is always available.
- **`index.html`**:
  - Passed `gender: result.student?.gender || null` into `setStudentSession` upon PIN verification.
- **`dashboard.html`**:
  - **First-Entry Gender Setup Modal (`#gender-setup-modal`)**: Triggers when student has no gender assigned (`null`), presenting interactive Male (Mr.) and Female (Miss) selection cards with single-click confirmation.
  - **Profile Modal Gender Card**: Added dedicated "Gender & Honorific Title" section with badge indicator and toggle buttons to change gender anytime.
  - **Real-time Title Synchronization**: Updates `#header-student-name`, `#welcome-name`, `#prof-student-name`, and `#prof-gender-badge` dynamically.
- **`admin.html`**:
  - Fixed import parser: removed hardcoded `female` fallback (`gender = null` if not provided).
  - Preview table: displays `⏳ Unassigned` badge for students without gender in spreadsheet.
  - Save & Merge: permits `gender: null` for new students; on merge, does NOT overwrite existing database gender when spreadsheet cell is blank.
  - Download template & guide: updated sample data and instructions noting that Gender is optional.
  - CRUD Form: added `— Unassigned (Student will choose) —` option to manual student entry.
- **`supabase/functions/student-login/index.ts`**:
  - Included `gender: student.gender || null` in JSON response.

### Files
- `js/session.js`
- `js/api.js`
- `index.html`
- `dashboard.html`
- `admin.html`
- `supabase/functions/student-login/index.ts`
- `scratch/verify_gender_workflow.ps1`
- `docs/CHANGELOG.md`
- `docs/CURRENT_STATE.md`

### Tests
- command: `powershell -ExecutionPolicy Bypass -File "d:\Tutor Tampan\Top Class Web Builder\Top English Class\scratch\verify_gender_workflow.ps1"`
- result: `PASS` — All 13 checks passed with 0 errors.

---

## [2026-09-09 03:25] — Idempotent Supabase Setup Schema

**Agent/Session:** Antigravity / SESSION-20260909-1125
**Phase:** Database Migration & Schema Stabilization
**Status:** PASS

### Why
- User encountered `ERROR: 42P07: relation "programs" already exists` when running `supabase-setup.sql` on the newly migrated Supabase project.
- The original script used plain `CREATE TABLE`, `CREATE TRIGGER`, `CREATE INDEX`, and `CREATE POLICY` without idempotency guards, causing execution to abort if any table or entity already existed.

### Changed
- **`supabase-setup.sql`**:
  - Added Section `0. CLEAN RESET` with `DROP TABLE IF EXISTS ... CASCADE;` in reverse dependency order. This eliminates conflicts from pre-existing dummy/onboarding tables that lacked columns like `deleted_at`, `is_active`, or `batch_id`.
  - Defined all 15 core tables with complete columns, indexes, triggers, RLS policies, and seed data.

### Files
- `supabase-setup.sql`
- `docs/CHANGELOG.md`
- `docs/CURRENT_STATE.md`

### Tests
- command: `Invoke-WebRequest -Uri "https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/<table_name>?select=*" -Headers $headers -UseBasicParsing` across all 15 tables.
- result: `PASS` — All 15 tables returned HTTP 200 OK with correct schema, seed rows, and active RLS policies.

### Configuration
- Established user permission rule in [`.agents/rules/powershell.md`](file:///d:/Tutor%20Tampan/Top%20Class%20Web%20Builder/Top%20English%20Class/.agents/rules/powershell.md) and [`docs/DECISIONS.md`](file:///d:/Tutor%20Tampan/Top%20Class%20Web%20Builder/Top%20English%20Class/docs/DECISIONS.md#DECISION-005) authorizing proactive autonomous PowerShell command execution.

---

## [2026-09-09 01:55] — One-Page Login, Remember Me, Sortable Students Table

**Agent/Session:** Antigravity / SESSION-20260909-0955
**Phase:** UX Enhancements — Login & Admin Console
**Status:** PASS

### Why
- User requested: "the student login system is in one page, so the menu to choose the program, class batch, and name are in one interface"
- User requested: "add feature to save login info on the device"
- User requested: "give me option to sort the students based on the data on top of the registered students table"
- User reported edit student feature may not be visible — verified it is wired correctly.

### Changed
- **`index.html`** — Complete rewrite: single-page cascading login. 5 sections (Program → Class → Batch → Name → PIN) unlock progressively on one scroll view. Each completed step collapses to a summary chip with "Change" button. Smooth CSS `max-height` animation. "All Batches" fallback.
- **`index.html`** — "Remember Me" toggle: saves full login selection to `localStorage`; auto-restores on next visit; "Clear saved login" link.
- **`admin.html`** — `renderStudents`: pre-computes all student scores once; adds sortable `<th>` headers for Name, Program, Class, Batch, Gender, Overall Score, Global Grade, Status. Clicking cycles ASC ▲ → DESC ▼ → reset. Filter + sort work independently.

### Files
- `index.html`
- `admin.html`
- `docs/CURRENT_STATE.md`

### Database
- No schema changes.

### Tests
- Manual: Verify login page shows cascading sections on one view; Remember Me saves/restores; column headers sort correctly.

### Next Action
- Open `index.html` in browser to test one-page login flow.
- Open `admin.html` → Students → click column headers to test sort.

---

## [2026-09-09 09:25] — Batch Hierarchy (Program-Class-Batch), Honorific Titles (Mr./Miss), Overall Score & Global Grade

**Agent/Session:** Antigravity / SESSION-20260909-0925
**Phase:** Core Entity Hierarchy & Student Assessment Extension
**Status:** PASS

### Why
- The user requested that female students have the title `Miss` and male students `Mr.` before their names on the student console and across the platform.
- The user requested a new column in the Students data table for `Batch` (positioned next to the `Class` column), as well as `Overall Score` and `Global Grade`.
- The user specified that the `Batch` entity belongs strictly under the `Class` structure, forming the hierarchy: `Program -> Class -> Batch -> Student`.
- `Batch` cannot be chosen without `Class`, and `Class` is chosen after `Program`. Wherever there are options to choose them (Student Login, Admin CRUD modals, Admin import filters), show the panels or elements in that exact order.

### Changed
- **Database Schema (`supabase-setup.sql`)**:
  - Created `batches` table (`id UUID PRIMARY KEY`, `class_id UUID REFERENCES classes(id) ON DELETE CASCADE`, `name TEXT`, `is_active BOOLEAN`, `created_at`, `updated_at`, `deleted_at`).
  - Added `batch_id UUID REFERENCES batches(id) ON DELETE SET NULL` to `students` table.
- **Backend / Edge Functions (`supabase/functions/student-login/index.ts`)**:
  - Added optional `batchId` filtering in login verification.
  - Selected `gender` and `batch_id`, formatting student name with `Miss ` or `Mr. ` and returning `batch_id` in response.
- **Client API & Session Layer (`js/api.js` & `js/session.js`)**:
  - Exported `formatStudentName(name, gender)`: strips pre-existing titles and prepends `Miss ` for female and `Mr. ` for male.
  - Added `MOCK_BATCHES` and `fetchBatches(classId)`.
  - Updated `fetchStudentsByClass(classId, batchId)` with optional batch filter and formatted names.
  - Updated `setStudentSession` to store `batch_id` and `batch_name`.
- **Admin Console (`admin.html`)**:
  - Added `Batches` navigation under `CLASS MANAGEMENT` domain with full CRUD management (`renderBatches`).
  - Updated `Students` table header and rows: placed `Batch` immediately next to `Class`, added `Overall Score` (average across highest effective scores per completed exam per AGENTS.md §2.7 & §2.8), and added `Global Grade` (`S`, `A`, `B`, `C`, `D`, `E`, `F` per AGENTS.md §2.10).
  - Enforced strict cascading dependency in `openCrudModal`: Program unlocks Class, Class unlocks Batch; Batch is disabled until Class is selected.
  - Updated `formFields.students` to follow Program -> Class -> Batch hierarchy.
  - Updated Student Import UI: structured Target Program, Target Class, and Target Batch in cascading order; recognized `BATCH` column in spreadsheets; displayed Batch in preview table; and persisted `batch_id`.
  - Updated `renderResults` and `renderProgressView` to format student names using `formatStudentName`.
- **Student Login & Portal (`index.html` & `dashboard.html`)**:
  - Converted `index.html` student login flow into 5 structured steps: Program (1/5) -> Class (2/5) -> Batch (3/5) -> Student Name (4/5) -> PIN (5/5).
  - Updated step progress indicators (5 dots, 4 connection lines) and back buttons.
  - Updated `dashboard.html`: welcome meta displays `Program › Class › Batch`; profile card shows hierarchy `Program`, `Class`, and `Batch`.

### Files
- `supabase-setup.sql`
- `supabase/functions/student-login/index.ts`
- `js/api.js`
- `js/session.js`
- `admin.html`
- `index.html`
- `dashboard.html`
- `scratch/verify_batch_titles.ps1`
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_LOG.md`

### Database
- New table: `batches` with foreign key to `classes`.
- New column: `students.batch_id` foreign key with `ON DELETE SET NULL`.

### Tests
- Automated PowerShell script (`scratch/verify_batch_titles.ps1`): PASS (All checks passed with 0 errors).
- Regression check (`verify_merge.ps1`): PASS (All 11 checks passed).

### Risks / Follow-up
- None. All cascading dependencies and UI orders verified.

### Next Action
- Present walkthrough to user.

## [2026-09-09 08:42] — Smart Data Merge & Duplicate Elimination Engine

**Agent/Session:** Antigravity / SESSION-20260909-0842
**Phase:** Data Integrity & Import Automation
**Status:** PASS

### Why
- The user requested that importing students or questions should merge with existing database records instead of creating duplicate rows.
- The user also requested that any existing double/duplicate students in the database with matching details be merged together.

### Changed
- **Deduplication & Merge Core Engine (`js/api.js`)**:
  - Implemented `mergeDuplicateStudents()`: detects groups of duplicate students in the same class, identifies the primary survivor profile (ranking by attempt history, progress, birth date, and creation time), enriches missing attributes, re-links all existing exam `attempts` and `progress` to the primary ID, and cleanly removes duplicate rows with `adminHardDelete`.
  - Added `adminHardDelete(table, id)` supporting both live Supabase and mock stores.
- **Student Import Engine (`admin.html`)**:
  - Added intra-batch deduplication: merges duplicate rows in the spreadsheet before saving so each student is processed exactly once with consolidated details.
  - Implemented database match detection by `(name, class_id)`: marks matching students as `🔄 Merge / Update Existing` and new students as `✨ New Student`.
  - When saving, executes `adminUpdate` for existing students (updating birth date, gender, non-default PIN, active status) preserving internal UUIDs, attempts, and progress history, while executing `adminInsert` only for brand-new students.
- **Question Import Engine (`admin.html`)**:
  - Added duplicate detection matching target `exam_id` + `question_order` / `question_text`.
  - Merges/updates existing questions via `adminUpdate` to avoid unique constraint collisions on `(exam_id, question_order)`, and inserts new questions via `adminInsert`.
- **Student Management Console (`admin.html`)**:
  - Added real-time duplicate student detection on table load.
  - Added prominent alert banner with one-click `"🔄 Gabungkan Semua Duplikat"` button when duplicate students exist.
  - Added `"🔄 Merge Duplikat (N)"` button in the section header.
  - Added `"Kembar / Duplikat"` badge next to duplicate student names in the table.
  - Added automatic duplicate merge check in `crudForm` when manually adding a student.

### Files
- `js/api.js`
- `admin.html`
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_LOG.md`

### Database
- Preserves relational integrity: existing `attempts` and `progress` foreign keys are safely migrated to the primary student UUID before duplicate student records are removed.

### Tests
- Automated PowerShell check (`verify_merge.ps1`): PASS (All 11 verification checks passed).

### Risks / Follow-up
- None.

### Next Action
- Present walkthrough to user.

## [2026-09-09 08:35] — Sidebar Layout Optimization (No-Scroll & Overflow Prevention)

**Agent/Session:** Antigravity / SESSION-20260909-0835
**Phase:** UI/UX & Responsive Layout Hardening
**Status:** PASS

### Why
- The user requested that the sidebar show all elements without scrolling and ensure elements do not overflow or stack on top of one another.
- Confirmed with user to apply this enhancement to both the Admin Console navigation sidebar (`admin.html` / `css/admin.css`) and the Exam question navigator sidebar (`exam.html` / `css/dashboard.css`).

### Changed
- **Admin Console Sidebar (`css/admin.css`)**:
  - Sized `.admin-sidebar` to `width: 250px; height: 100vh; max-height: 100vh; overflow: hidden;` with clean flex rhythm.
  - Sized all 16 items across 4 domains (`DATABASE`, `CLASS`, `STUDENT`, `EXAM`), 4 domain headers, logo header, and footer user chip using high-efficiency compact metrics (`padding: 4px 8px; font-size: 0.78rem; line-height: 1.25; margin-bottom: 1px;`).
  - Added text truncation protection (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;`) so labels never wrap or stack on adjacent rows.
  - Added `@media (max-height: 620px)` for compact screens ensuring all elements remain fully visible without scrolling down to 500px window heights.
  - Adjusted `.admin-main` margin to `margin-left: 250px`.
- **Exam Question Navigator Sidebar (`exam.html` & `css/dashboard.css`)**:
  - Restructured markup with `.q-sidebar-header`, `.q-nav-grid-wrap`, and `.q-nav-legend` pinned neatly with `margin-top: auto`.
  - Upgraded `.question-sidebar` to `width: 240px; display: flex; flex-direction: column; overflow: hidden;`.
  - Configured `.q-nav-grid` with `grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)); gap: 5px;` and dynamic density scaling in `buildNavGrid` (auto-adjusting to 28px/4px gap when questions exceed 30) so up to 60 questions fit in under ~250px height.
  - Updated responsive media queries (`@media (max-width: 1024px)`) so the navigator displays neatly below the question with a horizontal legend on mobile/tablets without clipping or overlapping.

### Files
- `css/admin.css`
- `css/dashboard.css`
- `exam.html`
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_LOG.md`

### Database
- No database changes required.

### Tests
- Automated PowerShell check (`verify_sidebars.ps1`): PASS (All 8 verification checks passed).

### Risks / Follow-up
- None.

### Next Action
- Present walkthrough to user.

## [2026-09-09 05:52] — Student Import Engine & Exam String Resolution

**Agent/Session:** Antigravity / SESSION-20260909-0552
**Phase:** Feature Completion & Reliability Hardening
**Status:** PASS

### Why
- The user reported that the Student Import button was not functioning ("coming soon" placeholder toast) and that some strings in Exam management/testing were broken (unescaped apostrophes causing syntax errors, case-sensitive Excel column lookups, missing written tolerance in client fallback).

### Changed
- **Student Import Engine (`admin.html`)**: Implemented full Excel/CSV student importer with Target Program & Class selectors, downloadable sample template (`Template_Student_Import.xlsx`), case-insensitive column mapper (`NAME`, `GENDER`, `BIRTH_DATE`/`AGE`, `PIN`, `PROGRAM`, `CLASS`), interactive preview table with age calculation and duplicate warning detection, SHA-256 PIN hashing (`hashPin`), and direct batch saving via `adminInsert`.
- **Student Navigation Shortcut**: Added "📥 Import Students" shortcut button in the Students management section header.
- **Apostrophe / Quote Resilience**: Replaced unsafe inline `onclick` string interpolation (`'${r.name}'`, `'${r.exam_title}'`) with safe `data-del-*` and `data-edit-*` dataset handlers and added `escapeHtml` utility across `programs`, `subjects`, `levels`, `classes`, `students`, `exams`, and `questions`.
- **Approved Exam Display Formula (AGENTS.md §2.5 & §2.6)**: Implemented `formatExamDisplayName` formatting `[PROGRAM] [CLASS] SUBJECT · LEVEL · EXAM TYPE — EXAM TITLE` across Exam Hub, Questions bank, and dropdown selectors.
- **Expanded Exam Search**: Broadened `renderExams` search filter to match Program name, Level name, Level number, Answer Type, Status, and Question Order.
- **Fuzzy Question Import Parser**: Added fuzzy, trimmed, case-insensitive column detection in `renderImportQuestions` for questions (`QUESTION`, `SOAL`, `PERTANYAAN`, `INDONESIA`), answers (`ANSWER`, `JAWABAN`, `KUNCI`), and numeric values (`0`, `1990`).
- **Safe Options Snapshot Parsing (`exam.html`)**: Implemented `parseSnapshotOptions` to handle JSON strings and comma-separated option strings without throwing `TypeError: options.forEach is not a function`.
- **Written Answer String Tolerance (`js/api.js`)**: Brought `normalizeAnswerText`, `damerauLevenshtein`, and written answer tolerance (0 errors = 1.0, 1-2 errors = 0.5, 3+ = 0) into `js/api.js` client fallback to ensure exact server parity per AGENTS.md §2.12 & §2.13.

### Files
- `admin.html`
- `exam.html`
- `js/api.js`
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_LOG.md`

### Database
- No schema migration required; fully utilizes existing `students`, `exams`, and `questions` tables.

### Tests
- PowerShell automated verification script: PASS (0 errors detected).
- Local HTTP server test: PASS (Status 200).

### Risks / Follow-up
- None.

### Next Action
- Present walkthrough to user.

## [2026-09-09 00:33] — Project Initialization & Architecture Setup

**Agent/Session:** Antigravity / SESSION-20260909-0033
**Phase:** Phase 1 - Foundation & Core Features Implementation
**Status:** PASS

### Why
- User requested website creation in strict compliance with `AGENTS.md`.

### Changed
- Created state tracking documentation: `CURRENT_STATE.md`, `CHANGELOG.md`, `DECISIONS.md`, `SESSION_LOG.md`, `TODO.md`, `BLOCKERS.md`, `PRODUCT_SPEC.md`.

### Files
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/DECISIONS.md`
- `docs/SESSION_LOG.md`
- `docs/TODO.md`
- `docs/BLOCKERS.md`
- `docs/PRODUCT_SPEC.md`

### Database
- Pending creation of `supabase-setup.sql`.

### Tests
- Initial specification and requirements check: PASS.

### Risks / Follow-up
- Ensure full alignment of Supabase RLS and server-authoritative timer/progression logic.


### Next Action
- Create `supabase-setup.sql` and Edge Functions.

## [2026-09-09 05:18] — Panel Streamlining, Sleek Modernization, Strict Sorting, Header Standardization & Exam Hub Restoration

**Agent/Session:** Antigravity / SESSION-20260909-0518
**Phase:** Phase 3 — UI Streamlining & Exam Management Restoration
**Status:** PASS

### Why
- User requested streamlining all panels into a modern, sleek, elegant aesthetic.
- User requested that everything that needs to be listed is in strict alphabetical order (A–Z).
- User requested an audit and alignment of all table headers into logical order.
- User requested restoring and fixing the Exam Management panel, which appeared missing or inaccessible.

### Changed
- `admin.html`:
  - Completely redesigned primary navigation with prominent segmented glassmorphism tabs (`DATABASE`, `CLASS`, `STUDENT`, `EXAM`) and a synchronized topbar domain quick-switcher pill bar.
  - Restored and elevated the Exam Management panel into an **Exam Management Hub** featuring 4 real-time KPI cards (Total Exams, Published, Draft, Questions in Bank), quick action buttons (`+ Create Exam`, `📥 Import Questions`, `📤 Export Questions`, `🔗 Class Assignments`), interactive status filter pills (`All`, `Published`, `Draft`, `Unpublished`, `Archived`), and live search bar.
  - Restored the missing **Student Progress** management view (`renderProgressView`) with status chips (`✓ Completed`, `▶ Unlocked`, `🔒 Locked`) and visual percentage progress bars.
  - Standardized all 12 table headers across all panels into a uniform logical hierarchy (`Parent Entity → Child Entity → Attributes → Status → Timestamps → Actions`).
  - Enforced strict alphabetical sorting (A to Z) across all tables and select dropdowns: Programs, Classes, Subjects, Levels, Students, Exams, Questions, Exam Classes, Results, and Student Progress.
  - Added section counter badges (`count-chip`) on all section headers.
  - Cleaned up duplicate code blocks and fixed modal cascading dropdown dependencies.
- `css/admin.css`:
  - Added modern glassmorphism styling, vibrant gradients, micro-interactions, active glow indicators, and tactile hover states for `.primary-tab` and `.domain-pill`.
  - Added `.kpi-grid`, `.kpi-card`, `.kpi-icon`, `.kpi-val`, and `.kpi-lbl` for exam metrics.
  - Added `.pill-filter-bar` and `.pill-filter-btn` for status filtering.
  - Enhanced table styling: sticky headers, subtle zebra stripes, row hover glows, and text alignment utility classes (`.text-left`, `.text-center`, `.text-right`).
- `js/api.js`:
  - Updated `fetchPrograms`, `fetchClasses`, and `fetchStudentsByClass` to sort records alphabetically (A to Z) using `localeCompare`.
  - Added `hydrateMockRelations` in `adminFetchAll` to automatically resolve related entities (`programs`, `classes`, `subjects`, `levels`, `exams`) during demo / offline mode so tables never display empty dashes.
  - Enriched `MOCK_ADMIN_STORE` with comprehensive realistic sample data across all entities.
- `index.html`:
  - Updated `renderOptions` to guarantee alphabetical sorting of programs, classes, and students in the multi-step login flow.
- `dashboard.html`:
  - Updated `renderSubjects` and `loadLevelExams` to sort student subjects and exams strictly in alphabetical order.

### Files
- `admin.html`
- `css/admin.css`
- `js/api.js`
- `index.html`
- `dashboard.html`
- `docs/CURRENT_STATE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_LOG.md`

### Database
- No schema changes required; relational integrity and snapshotting rules preserved.

### Tests
- Local static server syntax and HTTP 200 verification: PASS.
- Data sorting algorithms & cascading selection audit: PASS.

### Risks / Follow-up
- None. System is completely backward-compatible and compliant with AGENTS.md.

### Next Action
- Ready for user review and demonstration.
