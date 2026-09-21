-- ====================================================================
-- FIX: Add assessment_id column to attempts with proper FK
-- The attempts table currently only has exam_id (FK -> exams).
-- This migration adds assessment_id (FK -> assessments) and
-- copies existing exam_id values over.
-- ====================================================================

-- 1. Add assessment_id column to attempts
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS assessment_id UUID;

-- 2. Add FK constraint ONLY if assessments table has those IDs
-- First copy data from exam_id where the exam was migrated to assessments
UPDATE public.attempts a
SET assessment_id = a.exam_id
WHERE a.assessment_id IS NULL
  AND a.exam_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.assessments WHERE id = a.exam_id);

-- 3. Now add the FK constraint (only rows that have values must be valid)
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_assessment_id_fkey
  FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE SET NULL;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_attempts_assessment_id ON public.attempts(assessment_id);

-- 5. Reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
