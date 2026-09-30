-- ============================================================
-- DATA REPAIR: LINK ORPHANED ASSESSMENTS
-- ============================================================

-- If you have assessments that were created without an institution_id or program_id,
-- they will be "invisible" in the student dashboard (due to RLS and filtering).
-- 
-- IMPORTANT: You will need to replace 'YOUR-INSTITUTION-ID' and 'YOUR-PROGRAM-ID'
-- with actual UUIDs from your institutions and programs table.
-- 
-- To find them, you can run:
-- SELECT id, name FROM institutions;
-- SELECT id, name, institution_id FROM programs;

-- Add missing columns to enforce the lane
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

-- Update orphaned assessments
UPDATE public.assessments
SET 
  institution_id = (SELECT id FROM institutions LIMIT 1), -- fallback, replace with specific ID if needed
  program_id = (SELECT id FROM programs LIMIT 1) -- fallback, replace with specific ID if needed
WHERE 
  institution_id IS NULL OR program_id IS NULL;
