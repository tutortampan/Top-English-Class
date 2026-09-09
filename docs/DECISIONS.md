# ARCHITECTURAL DECISIONS LOG

## DECISION-001 — Static Frontend + Supabase Backend Stack Architecture

Date: 2026-09-09
Status: ACCEPTED

### Context
`AGENTS.md` mandates a static HTML5 + CSS + modular ES JavaScript frontend with Supabase (PostgreSQL, RLS, Storage, Edge Functions) as the server-authoritative backend. No traditional backend frameworks (Django, Express, Docker, Redis) are allowed.

### Decision
Use Vanilla ES Modules JavaScript frontend with Supabase JS SDK, backed by Supabase Edge Functions for all privileged actions (authentication, exam start, answer evaluation, submit, progression calculation).

### Consequences
- Clean separation of concerns.
- Server-authoritative timer, scoring, and level progression logic.
- Lightweight deployment to static web hosts (Netlify/Vercel) and Supabase backend.

---

## DECISION-002 — Student Identification & Authentication Scheme

Date: 2026-09-09
Status: ACCEPTED

### Context
AGENTS.md rule 2.2 states there is NO business-facing Student ID. Rule 2.3 mandates Student Login via: Program -> Class -> Student Name -> Personal PIN.

### Decision
Store student identification using internal primary key (UUID). Student login parameters use hashed PIN (`pin_hash`) verified server-side.

---

## DECISION-003 — Exam Class Availability & Display Naming Formula

Date: 2026-09-09
Status: ACCEPTED

### Context
Rule 2.5 allows an Exam to be assigned to multiple Classes within the same Program via `exam_classes` (many-to-many).
Rule 2.6 establishes display naming formula: `PROGRAM + CLASS + SUBJECT + LEVEL + EXAM TYPE + EXAM TITLE`.

### Decision
Store structured foreign keys and attributes separately in `exams` and `exam_classes` tables while dynamically generating display names.

---

## DECISION-004 — Written Answer Tolerance Algorithm

Date: 2026-09-09
Status: ACCEPTED

### Context
Rule 2.13 mandates deterministic server-authoritative written answer tolerance using Damerau-Levenshtein edit distance.

### Decision
- 0 edit distance -> Full point (1.0) ("Correct")
- 1-2 edit distance -> Half point (0.5) ("Minor Spelling Error")
- 3+ edit distance -> Zero point (0.0) ("Incorrect")
Normalized string pre-processing applies (trimming, lowercasing, whitespace collapse, punctuation stripping).

---

## DECISION-005 — Autonomous PowerShell Command Execution

Date: 2026-09-09
Status: ACCEPTED

### Context
User instruction: "from now always allow powershell -command". Continuous manual confirmation interrupts agentic testing, database diagnostics, and automation tasks.

### Decision
Agents are authorized and instructed to execute `powershell` commands proactively for diagnostics, verification, health checks, and build tasks across the workspace without requesting confirmation for standard non-destructive operations. Recorded in `.agents/rules/powershell.md`.

---

## DECISION-006 — Direct Program-Level Inheritance for Subjects and Exams (Batch as Student Grouping)

Date: 2026-09-09
Status: ACCEPTED

### Context
User requirement: "The relation between between Student, and Exam are about Program, Class, level. So when creating The exams those are the data needed to be determined, batch is impportant for gruouping the student." followed by "the exams only need to be created, no need assigned feature.subject assignment feature also not needed, the. put in the plan".
Prior rules (Rule 2.4 and Rule 2.5) envisioned manual assignment of subjects to classes (`class_subjects`) and exams to classes (`exam_classes`). This introduced unnecessary operational friction and orphaned exams.

### Decision
1. **Direct Program-Level Hierarchy**:
   - **Subjects**: Belong directly to a Program (`programs -> subjects`). All classes and students within a Program automatically inherit all Subjects in that Program. Manual Subject-to-Class assignment is eliminated.
   - **Exams**: Belong directly to `Program -> Subject -> Level` (`programs -> subjects -> levels -> exams`). When an exam is created and published, it is immediately available to all students enrolled in that Program who have unlocked that Level. Manual Exam-to-Class assignment is eliminated.
2. **Batch as Student Grouping**:
   - Hierarchy: `Program -> Class -> Batch -> Student`.
   - Batch does not branch or duplicate curriculum/exams.
   - Batch is essential for student grouping, tracking, filtering, and reporting in:
     - **Results View (`renderResults`)**: Batch column + cascading Program/Class/Batch filters.
     - **Student Progress View (`renderProgressView`)**: Batch column + cascading Program/Class/Batch filters.
     - **Student Management & Import**: Organizing cohorts within a Class.
3. **UI Streamlining**:
   - Removed obsolete "Subject Assignments" and "Exam Assignments" sub-tabs from admin navigation and views.
   - Streamlined `fetchStudentSubjects` and `fetchExamsForStudentLevel` to query directly by Program and Level.

---

## DECISION-007 — Level Structural Hierarchy Alignment and Permanent Default Master Data

Date: 2026-09-09
Status: ACCEPTED

### Context
1. User requested: *"Add class option when adding levels. the the hierarchy of optiion shown must fokllow the structure hierarchy. analyze this first then execute."*
2. User requested: *"The Stored Programs Are "CEC with Camp Class" and "Sheraton with "Morning", and "Afternoon" as class", Program "Tamata" with "Hospitality" Class., The Stored Subject are "Vocabularies". These are default. Stored it permanently unless I delete it. analyze and implement"*

### Decision
1. **Level Form Hierarchy**:
   The options in the Add/Edit Level modal MUST strictly follow top-to-bottom structural hierarchy:
   `Program` → `Class` → `Subject` → `Level Number` → `Level Name` → `Active`.
   - Program selection cascades to populate both Class and Subject options simultaneously.
   - Class selection allows targeting a specific class within the Program, or leaving optional (`All Classes`).
   - Editing a Level automatically resolves Program from `record.program_id || record.subjects?.program_id` and preselects Class and Subject.
2. **Permanent Default Master Data**:
   The default curriculum master data is permanently persisted in Supabase PostgreSQL:
   - Program **"CEC"** with Class **"Camp"** and Subject **"Vocabularies"**.
   - Program **"Sheraton"** with Classes **"Morning"** & **"Afternoon"** and Subject **"Vocabularies"**.
   - Program **"Tamata"** with Class **"Hospitality"** and Subject **"Vocabularies"**.
   - These records remain active and permanent unless explicitly deleted by the user.
3. **Database Schema & Resilience**:
   - Added `class_id UUID REFERENCES classes(id) ON DELETE SET NULL` to `levels` in `supabase-setup.sql`.
   - The frontend submit handler incorporates graceful fallback: if the database schema cache rejects `class_id`, the level is saved without crashing.

