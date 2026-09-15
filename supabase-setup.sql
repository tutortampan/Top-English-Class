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
DROP TABLE IF EXISTS assessment_questions CASCADE;
DROP TABLE IF EXISTS assessment_topics CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS word_types CASCADE;
DROP TABLE IF EXISTS attempt_answers CASCADE;
DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS assessment_programs CASCADE;
DROP TABLE IF EXISTS exam_programs CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS program_subjects CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
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

-- SUBJECTS (Global)
CREATE TABLE subjects (
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
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- WORD TYPES (Configurable + System Suggestions)
CREATE TABLE word_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS (Central Question Bank)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  word_type TEXT,
  question_text TEXT NOT NULL,
  accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 3. ASSESSMENTS & ASSIGNMENTS
-- ============================================================

-- ASSESSMENTS (Evaluations & Exams)
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id),
  subject_id UUID REFERENCES subjects(id),
  assessment_type TEXT NOT NULL DEFAULT 'EVALUATION' CHECK (assessment_type IN ('EVALUATION', 'EXAM')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  question_order TEXT NOT NULL DEFAULT 'RANDOM' CHECK (question_order IN ('RANDOM', 'SEQUENTIAL')),
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  working_duration_minutes INT NOT NULL DEFAULT 60,
  prerequisite_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  prerequisite_min_score NUMERIC(5,2) DEFAULT 60.0,
  retake_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ASSESSMENT_TOPICS (Topics included in Assessment)
CREATE TABLE assessment_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, topic_id)
);

-- ASSESSMENT_QUESTIONS (Frozen snapshot when Published)
CREATE TABLE assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  question_text_snapshot TEXT NOT NULL,
  accepted_answers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic_snapshot TEXT NOT NULL,
  word_type_snapshot TEXT,
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ASSIGNMENTS (Access Control: Batch or Student)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('BATCH', 'STUDENT')),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assignment_target CHECK (
    (assignment_type = 'BATCH' AND batch_id IS NOT NULL AND student_id IS NULL) OR
    (assignment_type = 'STUDENT' AND student_id IS NOT NULL AND batch_id IS NULL)
  )
);

-- ASSESSMENT_PROGRAMS (Backwards Compatibility)
CREATE TABLE assessment_programs (
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assessment_id, program_id)
);

-- ============================================================
-- 4. ATTEMPTS & EXECUTION
-- ============================================================

-- ATTEMPTS
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
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

-- QUESTION_USAGE_HISTORY (Analytics Tracking)
CREATE TABLE question_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  attempt_id UUID REFERENCES attempts(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject_name TEXT,
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
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assessments_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
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
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_programs ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "service_role_all_subjects" ON subjects FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_topics" ON topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_word_types" ON word_types FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_questions" ON questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessments" ON assessments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_topics" ON assessment_topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_questions" ON assessment_questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assignments" ON assignments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_programs" ON assessment_programs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
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
CREATE POLICY "admin_all_subjects" ON subjects FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_topics" ON topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_word_types" ON word_types FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessments" ON assessments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_topics" ON assessment_topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_questions" ON assessment_questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assignments" ON assignments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_assessment_programs" ON assessment_programs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
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
INSERT INTO word_types (name, is_system, is_active) VALUES
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
INSERT INTO subjects (id, name, code, status, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Vocabulary', 'VOC', 'active', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'Grammar', 'GRM', 'active', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'Speaking', 'SPK', 'active', TRUE)
ON CONFLICT (id) DO NOTHING;
