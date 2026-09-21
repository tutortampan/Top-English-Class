-- ============================================================
-- TOP ENGLISH CLASS: Add missing columns to assessments table
-- ============================================================
-- The live assessments table is missing class_id, topic_id, and assessment_type.
-- These were defined in 20260917_topscore_modules_assessments.sql but that 
-- migration used IF NOT EXISTS and the table already existed from v430.
-- Run this in the Supabase Dashboard SQL editor.

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(50);

-- Backfill assessment_type from payload JSONB where it was stored during creation
UPDATE public.assessments
  SET assessment_type = payload->>'type'
  WHERE assessment_type IS NULL AND payload->>'type' IS NOT NULL;
