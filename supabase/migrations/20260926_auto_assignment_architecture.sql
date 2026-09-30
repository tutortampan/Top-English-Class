-- ============================================================
-- MIGRATION: LEVEL-CENTRIC ARCHITECTURE - PHASE 2 (AUTO ASSIGNMENT)
-- ============================================================

-- 1. Ensure current_level_id exists on batches
ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS current_level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;

-- 2. Ensure level_id exists on classes
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;

-- 3. Fix assessment status casing for Edge Function compatibility
UPDATE public.assessments SET status = 'PUBLISHED' WHERE status = 'published'; 
UPDATE public.assessments SET status = 'DRAFT' WHERE status = 'draft'; 
UPDATE public.assessments SET status = 'UNPUBLISHED' WHERE status = 'unpublished'; 
UPDATE public.assessments SET status = 'ARCHIVED' WHERE status = 'archived';
