-- ============================================================
-- TOP ENGLISH CLASS — Migration: Level System, Recalibrator & Exam Fixes
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Student Table: Add optional level_id
ALTER TABLE students ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES levels(id) ON DELETE SET NULL;

-- 2. Exams Table: Make level_id optional & add prerequisite_min_score
ALTER TABLE exams ALTER COLUMN level_id DROP NOT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS prerequisite_min_score NUMERIC(5,2) DEFAULT 60.0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'Daily';

-- 3. Questions Table: Add change tracking for recalibration
ALTER TABLE questions ADD COLUMN IF NOT EXISTS previous_correct_answer TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Site Settings & Audit Logs (Ensure present)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
