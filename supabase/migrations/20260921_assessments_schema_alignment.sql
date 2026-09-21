-- ====================================================================
-- DEFINITIVE SCHEMA ALIGNMENT MIGRATION (v2)
-- 
-- Fixes:
-- 1. module_id is NOT NULL on assessments — must provide a default module
-- 2. Add class_id, assessment_type, category, status, etc.
-- 3. Migrate legacy exams with proper module_id fallback
-- ====================================================================

-- Step 1: Make module_id nullable (exams from legacy don't have modules)
ALTER TABLE public.assessments
  ALTER COLUMN module_id DROP NOT NULL;

-- Step 2: Add missing columns that frontend code expects
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_type TEXT;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'ASSESSMENT';
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT 'MULTIPLE_CHOICE';
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS question_order TEXT DEFAULT 'sequential';
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS minimum_required_score NUMERIC DEFAULT 0;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 0;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS level_id UUID;
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS retake_allowed BOOLEAN DEFAULT TRUE;

-- Step 3: Migrate legacy exams into assessments (no module_id required)
INSERT INTO public.assessments (
  id, class_id, assessment_type, name, display_name, answer_type,
  question_order, time_limit_seconds, status, category, minimum_required_score,
  max_attempts, program_id, retake_allowed, created_at, updated_at, deleted_at
)
SELECT
  e.id,
  e.class_id,
  e.exam_type,
  e.exam_title,
  e.display_name,
  COALESCE(e.answer_type, 'MULTIPLE_CHOICE'),
  COALESCE(e.question_order, 'sequential'),
  COALESCE(e.time_limit_minutes * 60, 3600),
  UPPER(COALESCE(e.exam_status, 'DRAFT')),
  'ASSESSMENT',
  COALESCE(e.minimum_required_score, 0),
  COALESCE(e.max_attempts, 0),
  CASE WHEN EXISTS (SELECT 1 FROM public.programs WHERE id = e.program_id) THEN e.program_id ELSE NULL END,
  COALESCE(e.retake_allowed, TRUE),
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.exams e
WHERE NOT EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = e.id);

-- Step 4: Sync assessment_id on attempts
UPDATE public.attempts a
SET assessment_id = a.exam_id
WHERE a.assessment_id IS NULL
  AND a.exam_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.assessments WHERE id = a.exam_id);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_assessments_class_id ON public.assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_program_id ON public.assessments(program_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);

-- Step 6: Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
