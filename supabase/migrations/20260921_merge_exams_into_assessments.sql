-- ============================================================
-- TOP ENGLISH CLASS — Migrate Legacy Exams to Assessments
-- ============================================================

-- 1. Ensure a "Legacy Exam" module exists for the required module_id
INSERT INTO modules (id, name, module_type, description)
VALUES (
  '00000000-0000-0000-0000-000000000099', 
  'Legacy Exam', 
  'LEGACY_EXAM', 
  'Migrated legacy exams that have not been assigned to a specific AI module.'
)
ON CONFLICT (module_type) DO NOTHING;

-- 2. Migrate data from the `exams` table into the `assessments` table
-- We map exam_title -> name, and time_limit_minutes -> time_limit_seconds
INSERT INTO assessments (
  id,
  module_id,
  institution_id,
  class_id,
  assessment_type,
  name,
  time_limit_seconds,
  payload,
  created_at,
  updated_at
)
SELECT 
  id,
  '00000000-0000-0000-0000-000000000099', -- Link to Legacy module
  institution_id,
  class_id,
  COALESCE(exam_status, 'LEGACY'),        -- Store status in assessment_type
  exam_title,
  time_limit_minutes * 60,
  jsonb_build_object(
    'exam_type', exam_type,
    'answer_type', answer_type,
    'question_order', question_order,
    'minimum_required_score', minimum_required_score
  ),
  created_at,
  updated_at
FROM exams
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  time_limit_seconds = EXCLUDED.time_limit_seconds,
  payload = EXCLUDED.payload,
  updated_at = NOW();

-- 3. Ensure attempts are linked to assessment_id (in case they were only linked to exam_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'exam_id') THEN
    UPDATE attempts SET assessment_id = exam_id WHERE assessment_id IS NULL AND exam_id IS NOT NULL;
  END IF;
END $$;
