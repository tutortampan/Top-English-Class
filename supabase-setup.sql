-- ============================================================
-- TOP ENGLISH CLASS — Supabase PostgreSQL Schema (Clean Setup)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 0. CLEAN RESET (Drops previous partial / conflicting tables)
-- ============================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS attempt_answers CASCADE;
DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS exam_classes CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS class_subjects CASCADE;
DROP TABLE IF EXISTS levels CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS programs CASCADE;

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- PROGRAMS
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- CLASSES
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- SUBJECTS
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- LEVELS
CREATE TABLE levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  level_number INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (subject_id, level_number)
);

-- CLASS_SUBJECTS (Many-to-Many: Class <-> Subject)
CREATE TABLE class_subjects (
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, subject_id)
);

-- BATCHES (Hierarchy: Program -> Class -> Batch)
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- STUDENTS
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id),
  class_id UUID NOT NULL REFERENCES classes(id),
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

-- EXAMS
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  level_id UUID NOT NULL REFERENCES levels(id),
  prerequisite_exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('Daily', 'Weekly', 'Monthly', 'Final')),
  exam_order TEXT NOT NULL DEFAULT '1',
  exam_title TEXT NOT NULL,
  display_name TEXT GENERATED ALWAYS AS (exam_type || ' — ' || exam_title) STORED,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('speech_to_text', 'dropdown', 'multiple_choice', 'written')),
  exam_status TEXT NOT NULL DEFAULT 'published' CHECK (exam_status IN ('draft', 'published', 'unpublished', 'archived')),
  question_order TEXT NOT NULL DEFAULT 'sequential' CHECK (question_order IN ('sequential', 'random')),
  time_limit_minutes INT NOT NULL DEFAULT 60,
  minimum_required_score NUMERIC(5,2) NOT NULL DEFAULT 60.0,
  retake_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Idempotent migrations for existing installations:
ALTER TABLE exams ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS prerequisite_exam_id UUID REFERENCES exams(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_order TEXT DEFAULT '1';

-- EXAM_CLASSES (Many-to-Many: Exam <-> Class)
CREATE TABLE exam_classes (
  exam_id UUID NOT NULL REFERENCES exams(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (exam_id, class_id)
);

-- QUESTIONS
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id),
  question_order INT NOT NULL,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('speech_to_text', 'dropdown', 'multiple_choice', 'written')),
  options_json JSONB,
  correct_answer TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (exam_id, question_order)
);

-- ATTEMPTS
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  exam_id UUID NOT NULL REFERENCES exams(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_end_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','submitted','auto_submitted','expired','cancelled')),
  score NUMERIC(5,2),
  percentage NUMERIC(5,2),
  grade TEXT,
  effective_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ATTEMPT_ANSWERS
CREATE TABLE attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id),
  question_id UUID REFERENCES questions(id),
  question_snapshot JSONB NOT NULL,
  options_snapshot JSONB,
  correct_answer_snapshot TEXT NOT NULL,
  student_answer TEXT,
  evaluation_result TEXT CHECK (evaluation_result IN ('correct','minor_spelling_error','incorrect',NULL)),
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROGRESS
CREATE TABLE progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  level_id UUID NOT NULL REFERENCES levels(id),
  is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id, level_id)
);

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
-- 2. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_levels_updated_at BEFORE UPDATE ON levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_exams_updated_at BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attempts_updated_at BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attempt_answers_updated_at BEFORE UPDATE ON attempt_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_progress_updated_at BEFORE UPDATE ON progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX idx_classes_program_id ON classes(program_id);
CREATE INDEX idx_batches_class_id ON batches(class_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_batch_id ON students(batch_id);
CREATE INDEX idx_students_program_id ON students(program_id);
CREATE INDEX idx_exams_subject_id ON exams(subject_id);
CREATE INDEX idx_exams_level_id ON exams(level_id);
CREATE INDEX idx_questions_exam_id ON questions(exam_id);
CREATE INDEX idx_attempts_student_id ON attempts(student_id);
CREATE INDEX idx_attempts_exam_id ON attempts(exam_id);
CREATE INDEX idx_attempt_answers_attempt_id ON attempt_answers(attempt_id);
CREATE INDEX idx_progress_student_id ON progress(student_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all_programs" ON programs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_classes" ON classes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_batches" ON batches FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_subjects" ON subjects FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_levels" ON levels FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_class_subjects" ON class_subjects FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_students" ON students FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_exams" ON exams FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_exam_classes" ON exam_classes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_questions" ON questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_attempts" ON attempts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_attempt_answers" ON attempt_answers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_progress" ON progress FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_site_settings" ON site_settings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_audit_logs" ON audit_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Public read for reference data
CREATE POLICY "public_read_programs" ON programs FOR SELECT TO anon USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "public_read_classes" ON classes FOR SELECT TO anon USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "public_read_batches" ON batches FOR SELECT TO anon USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "public_read_subjects" ON subjects FOR SELECT TO anon USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "public_read_levels" ON levels FOR SELECT TO anon USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "public_read_students_by_class" ON students FOR SELECT TO anon USING (is_active = TRUE AND deleted_at IS NULL);
CREATE POLICY "public_read_site_settings" ON site_settings FOR SELECT TO anon USING (TRUE);

-- Admin CRUD policies (anon — for admin console)
CREATE POLICY "admin_all_programs" ON programs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_classes" ON classes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_batches" ON batches FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_subjects" ON subjects FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_levels" ON levels FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_class_subjects" ON class_subjects FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_students" ON students FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_exams" ON exams FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_exam_classes" ON exam_classes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_attempts" ON attempts FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_attempt_answers" ON attempt_answers FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_progress" ON progress FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "admin_all_audit_logs" ON audit_logs FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- 5. SEED: DEFAULT SETTINGS & DEMO DATA
-- ============================================================
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'TOP ENGLISH CLASS'),
  ('site_theme', 'dark'),
  ('login_background_url', NULL),
  ('passing_threshold', '60');

-- Demo Program
INSERT INTO programs (id, name, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'General English Program', TRUE);

-- Permanent Default Programs, Classes & Subjects:
-- 1. CEC with Camp Class & Vocabularies Subject
INSERT INTO programs (id, name, is_active)
VALUES ('24d52c09-f2e6-4bbe-b8ab-3eaa41c8b333', 'CEC', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO classes (id, program_id, name, is_active)
VALUES ('d4c6d85a-44b7-4121-acae-28f7b9e70dcd', '24d52c09-f2e6-4bbe-b8ab-3eaa41c8b333', 'Camp', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO subjects (id, program_id, name, is_active)
VALUES ('99316504-99dd-444c-88bd-6ce073f878d3', '24d52c09-f2e6-4bbe-b8ab-3eaa41c8b333', 'Vocabularies', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

-- 2. Sheraton with Morning & Afternoon Classes & Vocabularies Subject
INSERT INTO programs (id, name, is_active)
VALUES ('e92fb031-a19f-42e7-a855-2d3132d24d57', 'Sheraton', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO classes (id, program_id, name, is_active)
VALUES ('7654cefa-a788-47f5-8daf-1e94ed2650dc', 'e92fb031-a19f-42e7-a855-2d3132d24d57', 'Morning', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO classes (id, program_id, name, is_active)
VALUES ('55082441-ed93-4cc9-8fd9-2904c8b4b4d9', 'e92fb031-a19f-42e7-a855-2d3132d24d57', 'Afternoon', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO subjects (id, program_id, name, is_active)
VALUES ('0105eed1-1b27-490a-bf56-4024ae67f579', 'e92fb031-a19f-42e7-a855-2d3132d24d57', 'Vocabularies', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

-- 3. Tamata with Hospitality Class & Vocabularies Subject
INSERT INTO programs (id, name, is_active)
VALUES ('f526eb6f-d9cc-42d4-809a-239e3458b711', 'Tamata', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO classes (id, program_id, name, is_active)
VALUES ('7b331178-ddea-4df4-a2c7-cc7edcf63417', 'f526eb6f-d9cc-42d4-809a-239e3458b711', 'Hospitality', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

INSERT INTO subjects (id, program_id, name, is_active)
VALUES ('b985ce63-308f-4577-80fa-863dcdcddfc0', 'f526eb6f-d9cc-42d4-809a-239e3458b711', 'Vocabularies', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL;

-- Demo Class
INSERT INTO classes (id, program_id, name, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Class A', TRUE);

-- Demo Batch
INSERT INTO batches (id, class_id, name, is_active)
VALUES ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Batch 1', TRUE);

-- Demo Subject
INSERT INTO subjects (id, program_id, name, is_active)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'English Grammar & Vocabulary', TRUE);

-- Assign Subject to Class
INSERT INTO class_subjects (class_id, subject_id)
VALUES ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- Demo Level
INSERT INTO levels (id, subject_id, name, level_number, is_active)
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Level 1 - Beginner', 1, TRUE);

-- Demo Student (PIN: 1234 -> SHA-256 hash: 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4)
INSERT INTO students (id, program_id, class_id, batch_id, name, gender, birth_date, pin_hash, is_active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '77777777-7777-7777-7777-777777777777',
  'John Doe',
  'male',
  '2012-05-15',
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  TRUE
);


