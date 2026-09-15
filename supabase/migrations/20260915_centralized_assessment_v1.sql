-- ============================================================
-- TOP ENGLISH CLASS — Centralized Assessment System V1 Migration
-- Strictly Safe & Non-Destructive: Preserves all historical questions, exams, and attempts
-- ============================================================

-- 1. GLOBAL SUBJECTS: Ensure Global Subjects can exist without institution_id
ALTER TABLE IF EXISTS subjects ALTER COLUMN institution_id DROP NOT NULL;
ALTER TABLE IF EXISTS subjects DROP CONSTRAINT IF EXISTS subjects_institution_id_fkey;
ALTER TABLE IF EXISTS subjects ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE IF EXISTS subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS subjects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure standard global 'Vocabulary' subject exists
INSERT INTO subjects (id, name, code, status, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Vocabulary', 'VOC', 'active', TRUE)
ON CONFLICT (id) DO UPDATE SET name = 'Vocabulary', status = 'active', is_active = TRUE;

-- 2. WORD_TYPES: Configurable Validation Dictionary
CREATE TABLE IF NOT EXISTS word_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default standardized word types
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
ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- 3. TOPICS: Global Content Organization
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);

-- Create a General Topic for Vocabulary if none exists
INSERT INTO topics (id, subject_id, name, code, status)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'General Vocabulary', 'GEN-VOC', 'active')
ON CONFLICT (id) DO UPDATE SET name = 'General Vocabulary', status = 'active';

-- 4. EVOLVE EXAMS TO ASSESSMENTS (Preserve all existing exam records)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exams') AND
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessments') THEN
    ALTER TABLE exams RENAME TO assessments;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_programs') AND
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessment_programs') THEN
    ALTER TABLE exam_programs RENAME TO assessment_programs;
  END IF;
END $$;

-- Update assessments columns
ALTER TABLE IF EXISTS assessments ALTER COLUMN institution_id DROP NOT NULL;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS assessment_type TEXT DEFAULT 'EVALUATION';
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS availability_start TIMESTAMPTZ;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS availability_end TIMESTAMPTZ;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS working_duration_minutes INT DEFAULT 60;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS prerequisite_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Backfill title & duration from legacy exam fields
UPDATE assessments SET title = exam_title WHERE title IS NULL AND exam_title IS NOT NULL;
UPDATE assessments SET working_duration_minutes = time_limit_minutes WHERE working_duration_minutes IS NULL AND time_limit_minutes IS NOT NULL;
UPDATE assessments SET status = 'PUBLISHED' WHERE (status IS NULL OR status = 'DRAFT') AND exam_status = 'published';

-- Backward compatibility view so legacy queries to 'exams' table continue working
CREATE OR REPLACE VIEW exams AS SELECT * FROM assessments;

-- 5. ASSESSMENT_TOPICS (Many-to-Many: Assessment <-> Topics)
CREATE TABLE IF NOT EXISTS assessment_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_topics_assessment_id ON assessment_topics(assessment_id);

-- 6. ASSESSMENT_QUESTIONS (Immutable Question Snapshot on Publish)
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id UUID,
  question_text_snapshot TEXT NOT NULL,
  accepted_answers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic_snapshot TEXT NOT NULL,
  word_type_snapshot TEXT,
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);

-- 7. ASSIGNMENTS (Batch and Student Level Access Control)
CREATE TABLE IF NOT EXISTS assignments (
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
CREATE INDEX IF NOT EXISTS idx_assignments_assessment_id ON assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_batch_id ON assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student_id ON assignments(student_id);

-- 8. ENROLLMENTS (Flexible Student <-> Batch History)
CREATE TABLE IF NOT EXISTS enrollments (
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
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch_id ON enrollments(batch_id);

-- Backfill initial enrollments from existing students table
INSERT INTO enrollments (student_id, batch_id, status)
SELECT id, batch_id, 'active'
FROM students
WHERE batch_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (student_id, batch_id) DO NOTHING;

-- 9. EVOLVE QUESTIONS TABLE (Central Question Bank — NON-DESTRUCTIVE)
ALTER TABLE IF EXISTS questions ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS word_type TEXT;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Backfill existing questions to global Vocabulary subject & General topic
UPDATE questions 
SET subject_id = '00000000-0000-0000-0000-000000000001'
WHERE subject_id IS NULL;

UPDATE questions 
SET topic_id = '00000000-0000-0000-0000-000000000010'
WHERE topic_id IS NULL;

-- Backfill accepted_answers from correct_answer if empty
UPDATE questions
SET accepted_answers = jsonb_build_array(correct_answer)
WHERE (accepted_answers = '[]'::jsonb OR accepted_answers IS NULL) AND correct_answer IS NOT NULL;

-- Extract word_type from metadata if present
UPDATE questions
SET word_type = metadata->>'type'
WHERE word_type IS NULL AND metadata->>'type' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);

-- 10. EVOLVE ATTEMPTS TABLE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'assessment_id') THEN
    ALTER TABLE attempts ADD COLUMN assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE attempts SET assessment_id = exam_id WHERE assessment_id IS NULL AND exam_id IS NOT NULL;

ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE attempts SET expires_at = expected_end_at WHERE expires_at IS NULL AND expected_end_at IS NOT NULL;

ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS correct_count INT DEFAULT 0;
ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS total_questions INT DEFAULT 0;
ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS is_best_score BOOLEAN DEFAULT FALSE;

-- Calculate and backfill is_best_score for existing attempts
WITH best_ranks AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, COALESCE(assessment_id, exam_id)
           ORDER BY COALESCE(percentage, 0) DESC, created_at DESC
         ) as rank
  FROM attempts
  WHERE LOWER(status) IN ('submitted', 'auto_submitted', 'evaluated')
)
UPDATE attempts a
SET is_best_score = (r.rank = 1)
FROM best_ranks r
WHERE a.id = r.id;

-- 11. EVOLVE ATTEMPT_ANSWERS TABLE
ALTER TABLE IF EXISTS attempt_answers DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey;
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS topic_snapshot TEXT;
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS word_type_snapshot TEXT;
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS accepted_answers_snapshot JSONB;
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS similarity_score NUMERIC(4,3);
ALTER TABLE IF EXISTS attempt_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;

-- Backfill is_correct from score
UPDATE attempt_answers
SET is_correct = (score >= 1.0)
WHERE is_correct IS NULL AND score IS NOT NULL;

-- 12. QUESTION_USAGE_HISTORY (Analytics Tracking)
CREATE TABLE IF NOT EXISTS question_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID,
  assessment_id UUID,
  attempt_id UUID,
  student_id UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject_name TEXT,
  topic_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_quh_question_id ON question_usage_history(question_id);
CREATE INDEX IF NOT EXISTS idx_quh_assessment_id ON question_usage_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_quh_student_id ON question_usage_history(student_id);

-- 13. ROW LEVEL SECURITY POLICIES
ALTER TABLE IF EXISTS word_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS question_usage_history ENABLE ROW LEVEL SECURITY;

-- Standard policies for anon and service_role
CREATE POLICY "anon_read_word_types" ON word_types FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_word_types" ON word_types FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_word_types" ON word_types FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_topics" ON topics FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_topics" ON topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_topics" ON topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_questions" ON questions FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_questions" ON questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_assessments" ON assessments FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_assessments" ON assessments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessments" ON assessments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_assessment_topics" ON assessment_topics FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_assessment_topics" ON assessment_topics FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_topics" ON assessment_topics FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_assessment_questions" ON assessment_questions FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_assessment_questions" ON assessment_questions FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assessment_questions" ON assessment_questions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_assignments" ON assignments FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_assignments" ON assignments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_assignments" ON assignments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_enrollments" ON enrollments FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_enrollments" ON enrollments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_enrollments" ON enrollments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_read_question_usage_history" ON question_usage_history FOR SELECT TO anon USING (TRUE);
CREATE POLICY "admin_all_question_usage_history" ON question_usage_history FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_question_usage_history" ON question_usage_history FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 14. SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
