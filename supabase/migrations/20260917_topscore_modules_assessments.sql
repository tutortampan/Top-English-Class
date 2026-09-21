-- TopsCore LMS Architecture - Core Tables
-- Replaces/Extends the previous basic exams setup

-- Strict Constraint: Keeping existing `students`, `classes`, etc.
-- We do NOT create a unified students table here. We link directly to `students`.

-- 2. Modules (Defines the 8 Assessment Types)
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  module_type VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  config_schema JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the 8 core AI modules
INSERT INTO modules (name, module_type, description) VALUES
('Point & Speak!', 'POINT_AND_SPEAK', 'Student takes a live photo and speaks a description using correct demonstrative pronoun, to-be, article, adjectives, and noun.'),
('Storytelling', 'STORYTELLING', 'Highly flexible storytelling engine assessing student stories against configured constraints (duration, sentences, tense, pillars).'),
('Conversation-based', 'CONVERSATIONAL', 'Open conversational module.'),
('Multiple Choice', 'MULTIPLE_CHOICE', 'Standard multiple choice quiz.'),
('Read Aloud / Pronunciation', 'READ_ALOUD', 'Student reads text aloud for pronunciation and fluency scoring.'),
('Turn-based Roleplay (Realtime/WebSockets)', 'TURN_BASED_ROLEPLAY', 'Interactive realtime AI roleplay.'),
('Speaking Performance (5 Pillars)', 'SPEAKING_MONOLOGUE', 'Full speaking evaluation on 5 pillars (Fluency, Pronunciation, Vocab, Grammar, Comprehension).'),
('Vocabulary Mastery', 'VOCAB_MASTERY', 'Vocabulary and spelling evaluation.')
ON CONFLICT (module_type) DO UPDATE 
SET name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- 3. Assessments (Smart Auto-Naming & Multi-Prerequisites)
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id),
  institution_id UUID REFERENCES institutions(id),
  class_id UUID REFERENCES classes(id),
  topic_id UUID REFERENCES topics(id),
  batch_id UUID REFERENCES batches(id),
  assessment_type VARCHAR(50), -- e.g., 'Task', 'Quiz', 'Exam', 'Milestone'
  
  -- The name will be dynamically generated via UI, or explicitly overridden
  name VARCHAR(255), 
  auto_name_override BOOLEAN DEFAULT FALSE,
  
  -- Availability & Rules
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  time_limit_seconds INTEGER,
  
  -- Module Specific Configuration & Prerequisite rules
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  prerequisite_rules JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 4. Student Submissions (Attempt history & AI Payloads)
CREATE TABLE IF NOT EXISTS student_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  
  status VARCHAR(20) DEFAULT 'IN_PROGRESS', 
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  
  -- AI Evaluation Results
  overall_score NUMERIC(5,2),
  ai_transcript TEXT,
  ai_feedback JSONB, 
  
  -- Manual Override
  teacher_override_score NUMERIC(5,2),
  teacher_override_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Exam History (Detailed Audit Logs for every attempt)
CREATE TABLE IF NOT EXISTS exam_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  action_type VARCHAR(50) NOT NULL, 
  old_payload JSONB,
  new_payload JSONB,
  acted_by UUID REFERENCES students(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled and set up basic policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on modules" ON modules;
CREATE POLICY "Allow public read on modules" ON modules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full access on assessments" ON assessments;
CREATE POLICY "Allow full access on assessments" ON assessments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow student read/write submissions" ON student_submissions;
CREATE POLICY "Allow student read/write submissions" ON student_submissions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow students to read their own profile" ON students;
CREATE POLICY "Allow students to read their own profile" ON students FOR SELECT USING (true); -- Refine in production

DROP POLICY IF EXISTS "Allow audit writes" ON exam_history;
CREATE POLICY "Allow audit writes" ON exam_history FOR ALL USING (true);
