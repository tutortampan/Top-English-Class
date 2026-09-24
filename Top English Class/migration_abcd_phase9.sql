-- ============================================================
-- TOP ENGLISH CLASS — ABCD Architecture Migration (Phase 6 & 9)
-- Non-Destructive Data Migration Script
-- Run this in Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. CREATE NEW A/B/C/D TABLES
-- ------------------------------------------------------------

-- CLASSES (Formerly Subjects)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- CLASS INSTANCES (Batch + Subject/Class)
CREATE TABLE class_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  start_date DATE,
  estimated_finish DATE,
  actual_finish DATE,
  recurring_schedule JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ADDITIONAL MEMBERS
CREATE TABLE additional_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_instance_id, student_id)
);

-- CLASS MEETINGS (For Phase 6 Class Scheduling)
CREATE TABLE class_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  meeting_number INT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  actual_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHALLENGE DEFINITIONS (Reusable Templates, formerly Assessments)
CREATE TABLE challenge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL DEFAULT 'EVALUATION',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'ARCHIVED')),
  question_order TEXT NOT NULL DEFAULT 'RANDOM' CHECK (question_order IN ('RANDOM', 'SEQUENTIAL')),
  working_duration_minutes INT NOT NULL DEFAULT 60,
  default_max_attempts INT,
  default_result_policy TEXT NOT NULL DEFAULT 'HIGHEST_SCORE' CHECK (default_result_policy IN ('HIGHEST_SCORE', 'LATEST', 'FIRST')),
  default_question_mode TEXT NOT NULL DEFAULT 'FIXED' CHECK (default_question_mode IN ('FIXED', 'RANDOM_DRAW')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- CHALLENGE INSTANCES (Actual deliveries attached to Class Instances)
CREATE TABLE challenge_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  title_override TEXT, -- e.g., "Weekly Evaluation #1"
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  working_duration_minutes INT NOT NULL DEFAULT 60,
  max_attempts INT,
  result_policy TEXT NOT NULL DEFAULT 'HIGHEST_SCORE',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  assigned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- CHALLENGE ATTEMPTS (Formerly Attempts)
CREATE TABLE challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  challenge_instance_id UUID NOT NULL REFERENCES challenge_instances(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (LOWER(status) IN ('not_started','in_progress','submitted','auto_submitted','expired','cancelled','pending_evaluation','evaluated')),
  score NUMERIC(5,2),
  correct_count INT DEFAULT 0,
  total_questions INT DEFAULT 0,
  percentage NUMERIC(5,2),
  grade TEXT,
  effective_score NUMERIC(5,2),
  is_best_score BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHALLENGE ATTEMPT ANSWERS (Formerly Attempt Answers)
CREATE TABLE challenge_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_attempt_id UUID NOT NULL REFERENCES challenge_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  question_snapshot JSONB NOT NULL,
  topic_snapshot TEXT,
  word_type_snapshot TEXT,
  accepted_answers_snapshot JSONB,
  correct_answer_snapshot TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  similarity_score NUMERIC(4,3),
  evaluation_result TEXT CHECK (evaluation_result IN ('correct','minor_spelling_error','incorrect',NULL)),
  score NUMERIC(5,2),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- CHALLENGE DEFINITION QUESTIONS (Frozen snapshot when Published, formerly Assessment Questions)
CREATE TABLE challenge_definition_questions (
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE (challenge_definition_id, question_id)
);

-- ------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definition_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_classes" ON classes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_class_instances" ON class_instances FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_additional_members" ON additional_members FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_class_meetings" ON class_meetings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_challenge_definitions" ON challenge_definitions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_challenge_instances" ON challenge_instances FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_challenge_attempts" ON challenge_attempts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_challenge_attempt_answers" ON challenge_attempt_answers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_challenge_definition_questions" ON challenge_definition_questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "admin_all_classes" ON classes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_class_instances" ON class_instances FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_additional_members" ON additional_members FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_class_meetings" ON class_meetings FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_challenge_definitions" ON challenge_definitions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_challenge_instances" ON challenge_instances FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_challenge_attempts" ON challenge_attempts FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_challenge_attempt_answers" ON challenge_attempt_answers FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_challenge_definition_questions" ON challenge_definition_questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ------------------------------------------------------------
-- 3. DATA MIGRATION (COPYING EXISTING RECORDS NON-DESTRUCTIVELY)
-- ------------------------------------------------------------

-- A. Copy Subjects to Classes (only id and name are guaranteed to exist in subjects)
INSERT INTO classes (id, name, description, status, is_active, created_at, updated_at)
SELECT
  s.id,
  s.name,
  NULL::TEXT          AS description,
  'active'::TEXT      AS status,
  TRUE::BOOLEAN       AS is_active,
  s.created_at,
  s.created_at        AS updated_at
FROM subjects s
ON CONFLICT (id) DO NOTHING;

-- B–H: Conditional migration — skips gracefully if legacy source tables don't exist
DO $$
BEGIN

  -- B. Migrate legacy "exams" to challenge_definitions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exams') THEN
    INSERT INTO challenge_definitions (id, class_id, title, description, challenge_type, status, question_order, working_duration_minutes, default_max_attempts, created_at, updated_at, deleted_at)
    SELECT id, subject_id,
           COALESCE(exam_title, 'Untitled'), NULL, 'EVALUATION',
           CASE WHEN UPPER(COALESCE(exam_status, '')) IN ('PUBLISHED', 'ACTIVE') THEN 'READY' ELSE 'DRAFT' END,
           'RANDOM', COALESCE(time_limit_minutes, 60), NULL, created_at, created_at, NULL
    FROM exams
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated exams -> challenge_definitions';
  ELSE
    RAISE NOTICE 'Table exams not found, skipping B.';
  END IF;

  -- B2. Migrate legacy "assessments" to challenge_definitions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    INSERT INTO challenge_definitions (id, class_id, title, description, challenge_type, status, question_order, working_duration_minutes, default_max_attempts, created_at, updated_at, deleted_at)
    SELECT id, subject_id,
           COALESCE(title, 'Untitled'), NULL,
           COALESCE(assessment_type, 'EVALUATION'),
           CASE WHEN UPPER(COALESCE(status, '')) IN ('PUBLISHED', 'ACTIVE') THEN 'READY' ELSE 'DRAFT' END,
           'RANDOM', 60, NULL, created_at, created_at, NULL
    FROM assessments
    WHERE subject_id IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated assessments -> challenge_definitions';
  ELSE
    RAISE NOTICE 'Table assessments not found, skipping B2.';
  END IF;

  -- C. Create Class Instances from assessment_programs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessment_programs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    INSERT INTO class_instances (batch_id, subject_id, status)
    SELECT DISTINCT
      (SELECT b.id FROM batches b WHERE b.program_id = ap.program_id ORDER BY b.created_at LIMIT 1),
      asm.subject_id,
      'active'
    FROM assessment_programs ap
    JOIN assessments asm ON ap.assessment_id = asm.id
    WHERE asm.subject_id IS NOT NULL
      AND (SELECT b.id FROM batches b WHERE b.program_id = ap.program_id ORDER BY b.created_at LIMIT 1) IS NOT NULL
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created class_instances from assessment_programs';
  ELSE
    RAISE NOTICE 'Table assessment_programs or assessments not found, skipping C.';
  END IF;

  -- D. Alternative: Create Class Instances from assignments table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    INSERT INTO class_instances (batch_id, subject_id, status)
    SELECT DISTINCT a.batch_id, asm.subject_id, 'active'
    FROM assignments a
    JOIN assessments asm ON a.assessment_id = asm.id
    WHERE a.batch_id IS NOT NULL AND asm.subject_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created class_instances from assignments';
  END IF;

  -- E. Create Challenge Instances from assessment_programs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessment_programs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    INSERT INTO challenge_instances (id, class_instance_id, challenge_definition_id, title_override, status, created_at, updated_at)
    SELECT
      gen_random_uuid(), ci.id, ap.assessment_id, asm.title, 'ACTIVE', NOW(), NOW()
    FROM assessment_programs ap
    JOIN assessments asm ON ap.assessment_id = asm.id
    JOIN class_instances ci
      ON ci.subject_id = asm.subject_id
      AND ci.batch_id = (SELECT b.id FROM batches b WHERE b.program_id = ap.program_id ORDER BY b.created_at LIMIT 1)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created challenge_instances from assessment_programs';
  END IF;

  -- F. Migrate Attempts to Challenge Attempts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attempts')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    INSERT INTO challenge_attempts (id, student_id, challenge_instance_id, attempt_number, started_at, submitted_at, status, score, percentage, grade, is_best_score, created_at, updated_at)
    SELECT
      atm.id, atm.student_id, ci.id, atm.attempt_number,
      atm.started_at, atm.submitted_at, atm.status, atm.score,
      atm.percentage, atm.grade, atm.is_best_score, atm.created_at, atm.updated_at
    FROM attempts atm
    JOIN students s ON atm.student_id = s.id
    JOIN assessments asm ON atm.assessment_id = asm.id
    JOIN class_instances cls ON s.batch_id = cls.batch_id AND asm.subject_id = cls.subject_id
    JOIN challenge_instances ci ON ci.class_instance_id = cls.id AND ci.challenge_definition_id = asm.id
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated attempts -> challenge_attempts';
  ELSE
    RAISE NOTICE 'Table attempts or assessments not found, skipping F.';
  END IF;

  -- G. Migrate Attempt Answers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attempt_answers') THEN
    INSERT INTO challenge_attempt_answers (id, challenge_attempt_id, question_id, question_snapshot, student_answer, is_correct, evaluation_result, score, created_at, updated_at)
    SELECT 
      aa.id, 
      aa.attempt_id, 
      aa.question_id, 
      aa.question_snapshot, 
      aa.student_answer, 
      NULL::BOOLEAN AS is_correct, 
      NULL::TEXT AS evaluation_result, 
      aa.score, 
      aa.created_at, 
      aa.updated_at
    FROM attempt_answers aa
    JOIN challenge_attempts ca ON aa.attempt_id = ca.id
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Migrated attempt_answers -> challenge_attempt_answers';
  ELSE
    RAISE NOTICE 'Table attempt_answers not found, skipping G.';
  END IF;

  -- H. Migrate Assessment Questions to Challenge Definition Questions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessment_questions') THEN
    INSERT INTO challenge_definition_questions (challenge_definition_id, question_id)
    SELECT assessment_id, question_id
    FROM assessment_questions
    WHERE question_id IS NOT NULL
    ON CONFLICT (challenge_definition_id, question_id) DO NOTHING;
    RAISE NOTICE 'Migrated assessment_questions -> challenge_definition_questions';
  ELSE
    RAISE NOTICE 'Table assessment_questions not found, skipping H.';
  END IF;

END $$;

-- NOTE: Legacy tables are NOT dropped. They remain intact as backups.
-- Migration complete. New ABCD tables created successfully.

