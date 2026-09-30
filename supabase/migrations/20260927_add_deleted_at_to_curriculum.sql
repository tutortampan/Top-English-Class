-- ============================================================
-- MIGRATION: ADD DELETED_AT FOR SOFT DELETES (CURRICULUM)
-- ============================================================

-- Add deleted_at to support api.js adminFetchAll soft delete filtering
ALTER TABLE public.assessment_questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
