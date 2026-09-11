# CURRENT STATE

Last Updated: 2026-09-11 13:25 UTC
Current Phase: Phase 24 — Subject Box Positioned Directly Under Welcome Banner
Current Task: Verification and documentation complete.
Status: COMPLETE

## Completed
- **Subject Box Positioned Directly Under Welcome Banner (Phase 24 - Student Dashboard)**:
  - Removed the unrequested "Academic Overview" side-card and its duplicate subject counter tile.
  - Positioned the My Subjects section (`.subjects-section`) directly beneath the Welcome Banner (`.welcome-banner`).
  - Streamlined the page hierarchy into a clean 3-tier structure:
    1. Welcome Banner (Photo + Grade/Score on top, Student Greeting Card on bottom, uniform 386px width).
    2. My Subjects Box (`.subjects-grid` with interactive subject cards).
    3. My Completed Exams Section (`.completed-exams-section` at dashboard bottom with summary metrics bar and history table).
  - Maintained hidden DOM elements (`#overview-exams-count`, `#overview-subjects-count`, `#overview-mic-status`, `#stat-exams-done`) to prevent any null reference errors in background event listeners.
- **Relocated & Expanded Completed Exams Section (Phase 23 - Student Dashboard)**:
  - Cleaned the top hero area: removed `stat-exams-done` text from greeting card to keep the student card focused on identity and session status.
  - Converted Overview Card Tile 1 to `📚 Assigned Subjects` (`#overview-subjects-count`).
  - Added dedicated `<section class="completed-exams-section">` at the bottom of `dashboard.html` below "My Subjects".
  - Implemented 3 summary metric cards: Completed Exams count, Average Score %, and Highest Score %.
  - Implemented detailed completed exams history table displaying: Exam Title & Type, Subject badge, Score %, Grade badge with official tier colors, Completion Date, and Status (Passed ≥60% / Retake Needed).
  - Added empty state handling with friendly call-to-action when 0 exams are completed.
  - Added responsive styling and horizontal scrolling for mobile devices in `dashboard.html` and `css/dashboard.css`.
  - Updated `fetchAllStudentAttempts()` in `js/api.js` to retrieve nested `subjects(name)` for complete exam context.
- **Batch-Grouped Student Management & Collapse State (Phase 21 - Admin)**:
  - Transformed students table in `admin.html` into hierarchical batch-grouped lists with student count chips.
  - Added collapsible batch headers remembering state per session via `sessionStorage` (`tec_expanded_batches`).
  - Added "▼ Expand All" and "▲ Collapse All" batch shortcuts in the filter bar.
  - Search filter automatically expands matching batches for instant results.
  - Made every student row clickable with hover effect and dedicated `👤 Profile` action button.
- **Individual Student Profile & Answer Inspector (Phase 21 - Admin)**:
  - Created `openStudentProfile(studentId, batchStudentIds)` full-screen view in `admin.html`.
  - Added 4 key performance cards: Exams Completed, ✅ Correct Answers, ❌ Incorrect Answers (+ minor spelling error counts), and Average Score with Global Grade badge.
  - Correct and incorrect totals strictly calculated using the student's highest-scoring attempt per unique exam.
  - Added exam history table with expandable accordion rows revealing question-by-question student answers vs. expected answers with evaluation badges.
  - Added batch navigation bar with position indicator (`X of Y`) and Previous/Next buttons.
  - Implemented keyboard arrow shortcut navigation (`ArrowLeft` / `ArrowRight`) to browse students within the batch.
- **Uniform Hero Grid & UI Alignment Overhaul (Phase 22 - Student & Admin)**:
  - Redesigned the top welcome area into a balanced 2-column hero grid:
    - **Left Column (386px)**: Student Showcase & Greeting Widget:
      - Top Row: 230px squircle photo on left + two stacked stat boxes (Grade on top, Score on bottom, no labels) on right.
      - Bottom Row: Greeting & Details card with uniform 386px width matching the top row's exact edges.
    - **Right Column (Flex 1)**: Academic Overview & Readiness Card:
      - Sized uniformly with matching height, 24px border radius, and elevation.
      - Displays completed exams, live microphone capability status, and guidance banner.
  - Made `.subject-card` elements in `dashboard.css` uniform in height (`min-height: 190px; display: flex; flex-direction: column; justify-content: space-between; border-radius: var(--radius-xl);`).
  - Removed outdated conflicting media queries from `dashboard.css`.
  - Applied the exact same balanced 2-column hero layout to individual student profiles in `admin.html`.
- **Independent & Optional Level System (Phases 3 & 4)**:
  - Decoupled Level selection from forced subject filtering.
  - Made Level optional and manual across all academic programs.
  - Fixed disabled Level dropdown bug for non-CEC programs.
  - Added optional `level_id` to student CRUD forms and student list table.
  - Added `supabase/migrations/20260910_recalibrator_and_level_fixes.sql` with resilient client schema fallbacks.
- **Centralized Excel Parser & Aliases (Phases 5, 6, 7)**:
  - Created `js/excel-parser.js` supporting standardized header aliases (`HEADER_ALIASES`).
  - Implemented `parseExcelWorkbook`, `processStudentImportRows`, and `processQuestionImportRows`.
  - Added vocabulary word type extraction (`TYPE` e.g. `1 - VERB`) and preservation in question metadata.
  - Integrated `level_id` into student import with automatic schema fallback.
- **Authoritative Centralized Grading Engine (Phases 9, 10, 11)**:
  - Created `js/grading.js` enforcing passing threshold (`>= minScore`, default 60%), percentage calculation, and centralized grade distribution (S, A, B, C, D, E, F).
  - Multi-answer vocabulary support with `;` and `|` delimiters.
  - Hyphen tolerance normalization (e.g. `check-in` vs `checkin` scored as full credit).
  - Damerau-Levenshtein edit distance for minor spelling errors (<= 2 edits).
  - Removed all legacy hardcoded 100% threshold rules.
- **Media & Hardware Compatibility (Phase 12)**:
  - Built `testMicrophoneCapability` and `getSupportedAudioMimeType` in `js/speech.js`.
  - Clean stream track disposal to prevent recording indicators remaining active.
  - Added First-Entry Student Photo & Microphone Setup Modal in `dashboard.html` with live webcam preview, snapshot capture, file upload fallback, and upfront microphone readiness testing.
  - Added Microphone Status button in dashboard header for instant device diagnostics.
  - Added subject-level exam fallback (`fetchExamsForStudentSubject`) so non-leveled programs are fully accessible.
- **Exam Recalibrator Engine & UI (Phases 13, 14, 15, 16, 17)**:
  - Added dedicated Exam Recalibrator tab in Admin navigation (`admin.html`).
  - Added `previewRecalibrateExam` and `applyRecalibrateExam` in `js/api.js`.
  - Recalculates historical scores using updated correct answers and tolerance without modifying original questions.
  - Audit logging of recalculation events.
- **Exam Runner Polish (Phase 8)**:
  - Modern word-type badge (`🏷️ 1 - VERB`) rendered above vocabulary questions in `exam.html`.
- **Comprehensive Integration Testing (Phase 18)**:
  - Verified via `scratch/test_master_verification.ps1` (41/41 checks passed, 0 failures).

## In Progress
- None.

## Not Started
- None.

## Current Architecture
- Static HTML5 + CSS3 + Modular ES6 JavaScript frontend.
- Supabase PostgreSQL + Storage + REST API backend.
- Authoritative modules: `js/grading.js`, `js/excel-parser.js`, `js/speech.js`, `js/api.js`, `js/session.js`.

## Tests
- Command: `powershell -ExecutionPolicy Bypass -File "scratch/test_master_verification.ps1"`
- Result: 41 PASSED, 0 FAILED.
