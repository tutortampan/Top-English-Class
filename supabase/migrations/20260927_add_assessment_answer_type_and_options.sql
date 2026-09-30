-- ============================================================
-- MIGRATION: ADD ANSWER TYPE & OPTIONS TO ASSESSMENTS
-- ============================================================

-- Add answer_type and options_snapshot to assessment_questions
ALTER TABLE public.assessment_questions ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT 'written';
ALTER TABLE public.assessment_questions ADD COLUMN IF NOT EXISTS options_snapshot JSONB DEFAULT '[]'::jsonb;
