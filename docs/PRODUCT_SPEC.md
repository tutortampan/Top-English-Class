# PRODUCT SPECIFICATION — TOPSCORE LMS

## 1. Overview
TopsCore is an institutional, data-efficient, low-egress English Learning Management System (LMS) powered by an AI Assessment Engine. It manages Institutions, Programs, Subjects, Levels, Modules, Assessments, Student Submissions, Progression, and Admin Operations. All user interfaces, prompts, and system messages are in Direct English Only.

## 2. Core Hierarchy
- INSTITUTION -> PROGRAM -> Batch -> Class -> Users (Students/Teachers)
- INSTITUTION -> Subject -> Level -> Module -> Assessment
- Student + Assessment -> Submission (Evaluated via AI Pipeline)
- Student + Subject + Level -> Progress

## 3. Key Non-Negotiable Requirements
- **Admin Navigation**: Exactly four primary tabs (`DATABASE`, `PROGRAM`, `STUDENT`, `EXAM` / `CHALLENGES`).
- **Student Business ID**: No business-facing Student ID anywhere. UUID internal PK only (maps to auth.users).
- **Student Login**: INSTITUTION -> PROGRAM -> Student Name -> Personal PIN. Hashed pin validation.
- **Smart Auto-Naming**: Assessments use the formula: `[Institution] - [Program] - [Module Name] - [Type]`. Manual override is allowed.
- **Scoring & Retakes**: Unlimited retakes bounded by availability windows. The main report card stores the **HIGHEST** score. Global average strictly counts unopened/unattempted available modules as 0. Teachers have manual override privileges.
- **Prerequisites**: Dynamic multi-level prerequisites supporting 0 to N parent assessments, minimum score thresholds, and aggregate average score thresholds.
- **Stateless AI Media Pipeline**: Supabase stores ONLY structured text/JSON. Media (audio/photos) is processed transiently in the browser, sent directly to the AI API for evaluation via Edge Functions, and immediately discarded.
- **Grading Scale**: F (0-10%), E (11-30%), D (31-50%), C (51-70%), B (71-90%), A (91-99%), S (100%).
- **The 8 Assessment Modules**: 
  1. Tell Me What You See (Visual Pronouns)
  2. Let me tell you something (Narrative Tense)
  3. Conversation-based
  4. Multiple Choice
  5. Read Aloud / Pronunciation
  6. Turn-based Roleplay (Realtime/WebSockets)
  7. Speaking Performance (5 Pillars: Fluency, Pronunciation, Vocabulary, Grammar, Comprehension)
  8. Vocabulary Mastery
- **Server Authoritative Timer**: Server sets `available_from` & `available_until` and `time_limit`. UI visual timer countdown only.
- **Historical Snapshot**: `exam_history` logs every attempt payload and AI evaluation in JSON.
- **Soft Delete**: `deleted_at` on historical business entities.
- **Audit Log**: Log admin mutations and security events.
