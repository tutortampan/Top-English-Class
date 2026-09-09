# PRODUCT SPECIFICATION — TOP ENGLISH CLASS

## 1. Overview
TOP ENGLISH CLASS is an online English assessment and testing platform. It manages programs, classes, subjects, levels, exams, questions, student attempts, progression, and admin operations.

## 2. Core Hierarchy
- Program -> Class -> Student
- Program -> Subject -> Level -> Exam -> Question
- Student + Exam -> Attempt -> Attempt Answer
- Student + Subject + Level -> Progress

## 3. Key Non-Negotiable Requirements
- **Admin Navigation**: Exactly four primary tabs (`DATABASE`, `CLASS`, `STUDENT`, `EXAM`).
- **Student Business ID**: No business-facing Student ID anywhere. UUID internal PK only.
- **Student Login**: Program -> Class -> Student Name -> Personal PIN. Hashed pin validation.
- **Exam Reuse across Classes**: Many-to-many relationship `exam_classes`. Display name formula: `PROGRAM + CLASS + SUBJECT + LEVEL + EXAM TYPE + EXAM TITLE`.
- **Level Progression Threshold**: 60% default passing score. Unlock next level only when ALL exams in current level are completed with score >= 60%. Retakes use highest score.
- **Overall Score**: Average of all available takeable completed exams.
- **Grading Scale**: F (0-10%), E (11-30%), D (31-50%), C (51-70%), B (71-90%), A (91-99%), S (100%).
- **Answer Types**: Speech to Text, Drop-down, Multiple Choice, Written.
- **Written Answer Tolerance Engine**: Damerau-Levenshtein edit distance (0 errors = 1.0, 1-2 errors = 0.5, 3+ errors = 0.0).
- **Server Authoritative Timer**: Server sets `started_at` & `expected_end_at`. UI visual timer countdown only. Server enforces deadline.
- **Historical Snapshot**: `attempt_answers` stores question and option snapshots upon attempt start/submission to maintain history without Exam Version entities.
- **Soft Delete**: `deleted_at` on historical business entities.
- **Audit Log**: Log admin mutations and security events.
