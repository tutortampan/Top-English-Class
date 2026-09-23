-- ============================================================
-- TOP ENGLISH CLASS — Supabase PostgreSQL Schema (V1 Setup)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 0. CLEAN RESET (Drops previous tables)
-- ============================================================
DROP TABLE IF EXISTS question_usage_history CASCADE;
DROP TABLE IF EXISTS challenge_definition_questions CASCADE;
DROP TABLE IF EXISTS challenge_definition_topics CASCADE;
DROP TABLE IF EXISTS challenge_instances CASCADE;
DROP TABLE IF EXISTS additional_members CASCADE;
DROP TABLE IF EXISTS class_instances CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS question_types CASCADE;
DROP TABLE IF EXISTS attempt_answers CASCADE;
DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS challenge_definition_programs CASCADE;
DROP TABLE IF EXISTS exam_programs CASCADE;
DROP TABLE IF EXISTS challenge_definitions CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS program_subjects CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS exam_sections CASCADE;

-- ============================================================
-- 1. CORE HIERARCHY TABLES
-- ============================================================

-- INSTITUTIONS
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  map_location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- PROGRAMS
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- BATCHES
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enrollment_date DATE,
  actual_final_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- STUDENTS
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  program_id UUID NOT NULL REFERENCES programs(id),
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  batch_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  pin_hash TEXT NOT NULL,
  photo_url TEXT,
  photo_status TEXT NOT NULL DEFAULT 'not_set' CHECK (photo_status IN ('not_set', 'pending', 'set')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ENROLLMENTS (Flexible Student <-> Batch History)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, batch_id)
);

-- ============================================================
-- 2. CENTRALIZED CONTENT (QUESTION BANK)
-- ============================================================

-- CLASSES (Global)
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

-- TOPICS (Global per Subject)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- CLASS INSTANCES (Batch + Subject/Class)
CREATE TABLE class_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
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

-- QUESTION TYPES (Configurable + System Suggestions)
CREATE TABLE question_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS (Central Question Bank)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_type TEXT,
  question_text TEXT NOT NULL,
  accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 3. CHALLENGE DEFINITIONS & CHALLENGE INSTANCES
-- ============================================================

-- CHALLENGE DEFINITIONS (Evaluations & Exams)
CREATE TABLE challenge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id),
  class_id UUID REFERENCES classes(id),
  challenge_definition_type TEXT NOT NULL DEFAULT 'EVALUATION' CHECK (challenge_definition_type IN ('EVALUATION', 'EXAM')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  question_order TEXT NOT NULL DEFAULT 'RANDOM' CHECK (question_order IN ('RANDOM', 'SEQUENTIAL')),
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  working_duration_minutes INT NOT NULL DEFAULT 60,
  prerequisite_assessment_id UUID REFERENCES challenge_definitions(id) ON DELETE SET NULL,
  prerequisite_min_score NUMERIC(5,2) DEFAULT 60.0,
  retake_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ASSESSMENT_TOPICS (Topics included in Assessment)
CREATE TABLE challenge_definition_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_definition_id, topic_id)
);

-- ASSESSMENT_QUESTIONS (Frozen snapshot when Published)
CREATE TABLE challenge_definition_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  question_text_snapshot TEXT NOT NULL,
  accepted_answers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic_snapshot TEXT NOT NULL,
  question_type_snapshot TEXT,
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHALLENGE INSTANCES (Access Control: Batch or Student)
CREATE TABLE challenge_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  challenge_instance_type TEXT NOT NULL CHECK (challenge_instance_type IN ('BATCH', 'STUDENT')),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assignment_target CHECK (
    (challenge_instance_type = 'BATCH' AND batch_id IS NOT NULL AND student_id IS NULL) OR
    (challenge_instance_type = 'STUDENT' AND student_id IS NOT NULL AND batch_id IS NULL)
  )
);

-- ASSESSMENT_PROGRAMS (Backwards Compatibility)
CREATE TABLE challenge_definition_programs (
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (challenge_definition_id, program_id)
);

-- ============================================================
-- 4. ATTEMPTS & EXECUTION
-- ============================================================

-- ATTEMPTS
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  challenge_definition_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
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

-- ATTEMPT_ANSWERS
CREATE TABLE attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  question_snapshot JSONB NOT NULL,
  topic_snapshot TEXT,
  question_type_snapshot TEXT,
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

-- QUESTION_USAGE_HISTORY (Analytics Tracking)
CREATE TABLE question_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  challenge_definition_id UUID REFERENCES challenge_definitions(id) ON DELETE SET NULL,
  attempt_id UUID REFERENCES attempts(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  class_name TEXT,
  topic_name TEXT
);

-- ============================================================
-- 5. SYSTEM SETTINGS & AUDIT
-- ============================================================

-- SITE_SETTINGS
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT_LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. TRIGGERS & FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_class_instances_updated_at BEFORE UPDATE ON class_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assessments_updated_at BEFORE UPDATE ON challenge_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attempts_updated_at BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attempt_answers_updated_at BEFORE UPDATE ON attempt_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definition_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definition_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_definition_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all_institutions" ON institutions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_programs" ON programs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_batches" ON batches FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_students" ON students FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_enrollments" ON enrollments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_class_instances" ON class_instances FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_additional_members" ON additional_members FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_subjects" ON classes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_topics" ON topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_word_types" ON question_types FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_questions" ON questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessments" ON challenge_definitions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_topics" ON challenge_definition_topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_questions" ON challenge_definition_questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assignments" ON challenge_instances FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_programs" ON challenge_definition_programs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_attempts" ON attempts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_attempt_answers" ON attempt_answers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_question_usage_history" ON question_usage_history FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_site_settings" ON site_settings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_audit_logs" ON audit_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Admin & Public policies (anon)
CREATE POLICY "admin_all_institutions" ON institutions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_programs" ON programs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_batches" ON batches FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_students" ON students FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_enrollments" ON enrollments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_class_instances" ON class_instances FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_additional_members" ON additional_members FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_subjects" ON classes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_topics" ON topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_word_types" ON question_types FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessments" ON challenge_definitions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_topics" ON challenge_definition_topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_questions" ON challenge_definition_questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assignments" ON challenge_instances FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_programs" ON challenge_definition_programs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_attempts" ON attempts FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_attempt_answers" ON attempt_answers FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_question_usage_history" ON question_usage_history FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_site_settings" ON site_settings FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_audit_logs" ON audit_logs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- 8. DEFAULT SEED DATA
-- ============================================================
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'TOP ENGLISH CLASS'),
  ('site_theme', 'dark'),
  ('login_background_url', NULL),
  ('passing_threshold', '60');

-- Default Word Types
INSERT INTO question_types (name, is_system, is_active) VALUES
  ('Noun', TRUE, TRUE),
  ('Verb', TRUE, TRUE),
  ('Adjective', TRUE, TRUE),
  ('Adverb', TRUE, TRUE),
  ('Pronoun', TRUE, TRUE),
  ('Preposition', TRUE, TRUE),
  ('Conjunction', TRUE, TRUE),
  ('Interjection', TRUE, TRUE),
  ('Determiner', TRUE, TRUE),
  ('Article', TRUE, TRUE),
  ('Phrase', TRUE, TRUE),
  ('Expression', TRUE, TRUE),
  ('Idiom', TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Global Subjects
INSERT INTO classes (id, name, code, status, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Vocabulary', 'VOC', 'active', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'Grammar', 'GRM', 'active', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'Speaking', 'SPK', 'active', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. PHASE 4 A-AFFAIRS (Professional Profiles & CV)
-- ============================================================

CREATE TABLE user_professionals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  cv_data JSONB, -- For CV generator specific layouts
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE work_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_professional_id UUID REFERENCES user_professionals(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE professional_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_professional_id UUID REFERENCES user_professionals(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers for Phase 4
CREATE TRIGGER trg_user_professionals_updated_at BEFORE UPDATE ON user_professionals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_work_records_updated_at BEFORE UPDATE ON work_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_professional_skills_updated_at BEFORE UPDATE ON professional_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for Phase 4
ALTER TABLE user_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_user_professionals" ON user_professionals FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_work_records" ON work_records FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_professional_skills" ON professional_skills FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_user_professionals" ON user_professionals FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_work_records" ON work_records FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_professional_skills" ON professional_skills FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 1. Add batch_joined_at to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Trigger function to track batch changes and manage additional_members
CREATE OR REPLACE FUNCTION trg_student_batch_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If batch_id changed (or is being set for the first time)
    IF (OLD.batch_id IS DISTINCT FROM NEW.batch_id) THEN
        -- Update the timestamp for joining the new batch
        NEW.batch_joined_at = NOW();

        -- If the student is LEAVING an old batch (not just being created)
        IF OLD.batch_id IS NOT NULL THEN
            -- Automatically insert them into additional_members for any ACTIVE class instances of the old batch
            -- so that the tutor does not lose access to their grading sheet.
            INSERT INTO additional_members (class_instance_id, student_id)
            SELECT id, OLD.id
            FROM class_instances
            WHERE batch_id = OLD.batch_id
              AND status = 'active'
            ON CONFLICT (class_instance_id, student_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_student_batch_change ON students;
CREATE TRIGGER trigger_student_batch_change
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION trg_student_batch_change();

ALTER TABLE students ADD COLUMN IF NOT EXISTS education TEXT;
