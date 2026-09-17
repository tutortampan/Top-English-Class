-- ============================================================
-- Migration: Create assessment_results table (TopsCore LMS TAEE)
-- Date: 2026-09-17
-- Description: Stores AI evaluation engine payloads with final_score (INTEGER)
--              and complete structured evaluation object in raw_evaluation_json (JSONB)
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  assessment_id UUID,
  module_type VARCHAR(50) NOT NULL,
  final_score INTEGER NOT NULL DEFAULT 0,
  raw_evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast queries by student and assessment
CREATE INDEX IF NOT EXISTS idx_assessment_results_student_id ON assessment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment_id ON assessment_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_module_type ON assessment_results(module_type);

-- Row Level Security (RLS)
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assessment_results' AND policyname = 'Allow read on assessment_results'
  ) THEN
    CREATE POLICY "Allow read on assessment_results" ON assessment_results FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assessment_results' AND policyname = 'Allow insert on assessment_results'
  ) THEN
    CREATE POLICY "Allow insert on assessment_results" ON assessment_results FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assessment_results' AND policyname = 'Allow update on assessment_results'
  ) THEN
    CREATE POLICY "Allow update on assessment_results" ON assessment_results FOR UPDATE USING (true);
  END IF;
END $$;
