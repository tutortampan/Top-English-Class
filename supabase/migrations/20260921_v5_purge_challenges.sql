-- ============================================================
-- TOP ENGLISH CLASS - V5 Architecture DB Migration
-- Purge "Challenge" terminology and establish "category"
-- ============================================================

-- 1. Add 'category' to assessments (replaces legacy payload->>exam_type or challenge_type)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS category TEXT;

-- Move legacy types into the new category column
UPDATE public.assessments 
SET category = payload->>'exam_type' 
WHERE category IS NULL AND payload ? 'exam_type';

-- 2. Rename tables from "challenge" to "assessment"
ALTER TABLE IF EXISTS public.challenge_instances RENAME TO assessment_instances;
ALTER TABLE IF EXISTS public.challenge_attempts RENAME TO assessment_attempts;
ALTER TABLE IF EXISTS public.challenge_attempt_answers RENAME TO assessment_attempt_answers;

-- 3. Rename foreign keys and columns inside the renamed tables
-- Assessment Instances
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_instances' AND column_name = 'challenge_definition_id') THEN
    ALTER TABLE public.assessment_instances RENAME COLUMN challenge_definition_id TO assessment_id;
  END IF;
END $$;

-- Assessment Attempts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_attempts' AND column_name = 'challenge_instance_id') THEN
    ALTER TABLE public.assessment_attempts RENAME COLUMN challenge_instance_id TO assessment_instance_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_attempts' AND column_name = 'challenge_definition_id') THEN
    ALTER TABLE public.assessment_attempts RENAME COLUMN challenge_definition_id TO assessment_id;
  END IF;
END $$;

-- Assessment Attempt Answers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_attempt_answers' AND column_name = 'challenge_attempt_id') THEN
    ALTER TABLE public.assessment_attempt_answers RENAME COLUMN challenge_attempt_id TO assessment_attempt_id;
  END IF;
END $$;

-- 4. If a 'challenge_definitions' table exists, migrate its data into 'assessments'
-- (Assuming assessments is the single source of truth now)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_definitions') THEN
    INSERT INTO public.assessments (id, class_id, category, name, type, created_at)
    SELECT 
      id, 
      class_id, 
      challenge_type, 
      title, 
      'PUBLISHED', 
      created_at
    FROM public.challenge_definitions
    ON CONFLICT (id) DO NOTHING;
    
    -- Drop it after migration to prevent future use
    -- DROP TABLE public.challenge_definitions; (Left commented out for safety, admin can drop manually)
  END IF;
END $$;
