-- ============================================================
-- TOP ENGLISH CLASS — Migration: Normalize Answer Separators
-- Converts all pipe (|) and slash (/) delimiters in correct_answer
-- fields to the canonical semicolon (;) separator.
--
-- Affected columns:
--   questions.correct_answer
--   questions.previous_correct_answer
--   attempt_answers.correct_answer_snapshot
--
-- Safe to run multiple times (idempotent).
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ── 1. questions.correct_answer ─────────────────────────────
UPDATE questions
SET correct_answer = REGEXP_REPLACE(
    REGEXP_REPLACE(correct_answer, '\|', ';', 'g'),
    '/', ';', 'g'
)
WHERE correct_answer ~ '[|/]';

-- ── 2. questions.previous_correct_answer ────────────────────
UPDATE questions
SET previous_correct_answer = REGEXP_REPLACE(
    REGEXP_REPLACE(previous_correct_answer, '\|', ';', 'g'),
    '/', ';', 'g'
)
WHERE previous_correct_answer ~ '[|/]';

-- ── 3. attempt_answers.correct_answer_snapshot ──────────────
--    Snapshots are text columns; normalize so recalibrator
--    re-evaluations are consistent.
UPDATE attempt_answers
SET correct_answer_snapshot = REGEXP_REPLACE(
    REGEXP_REPLACE(correct_answer_snapshot, '\|', ';', 'g'),
    '/', ';', 'g'
)
WHERE correct_answer_snapshot ~ '[|/]';

-- ── Verification queries (run manually to confirm) ──────────
-- SELECT id, correct_answer FROM questions WHERE correct_answer ~ '[|/]';
-- SELECT id, correct_answer_snapshot FROM attempt_answers WHERE correct_answer_snapshot ~ '[|/]';
