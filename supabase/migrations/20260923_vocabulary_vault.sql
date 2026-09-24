-- ====================================================================
-- TOPSCORE LMS: VOCABULARY VAULT & VOCAB MASTERY ENGINE
-- Migration: 20260923_vocabulary_vault.sql
-- 
-- Creates:
--   1. public.vocabulary_vault table (word repository)
--   2. Columns on assessments: module_type, schedule_mode, window_start, window_end, question_order, payload
--   3. get_server_time_wita() RPC for authoritative WITA clock sync
--   4. Full RLS policies for vocabulary_vault
-- ====================================================================

-- ============================================================
-- STEP 1: Create vocabulary_vault table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vocabulary_vault (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT        NOT NULL,
  indonesian  TEXT        NOT NULL,
  english     TEXT        NOT NULL,
  word_type   TEXT        NOT NULL DEFAULT 'Verb',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_vault_topic_deleted
  ON public.vocabulary_vault (topic, deleted_at);

CREATE INDEX IF NOT EXISTS idx_vault_indonesian_deleted
  ON public.vocabulary_vault (indonesian, deleted_at);

CREATE INDEX IF NOT EXISTS idx_vault_english_deleted
  ON public.vocabulary_vault (english, deleted_at);

-- ============================================================
-- STEP 2: Enable RLS on vocabulary_vault
-- ============================================================
ALTER TABLE public.vocabulary_vault ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies first
DROP POLICY IF EXISTS "vault_select_all"         ON public.vocabulary_vault;
DROP POLICY IF EXISTS "vault_insert_authenticated" ON public.vocabulary_vault;
DROP POLICY IF EXISTS "vault_update_authenticated" ON public.vocabulary_vault;
DROP POLICY IF EXISTS "vault_delete_authenticated" ON public.vocabulary_vault;
DROP POLICY IF EXISTS "vault_all_service_role"   ON public.vocabulary_vault;

-- Read: everyone (anon & authenticated)
CREATE POLICY "vault_select_all"
  ON public.vocabulary_vault FOR SELECT
  USING (TRUE);

-- Write: authenticated only
CREATE POLICY "vault_insert_authenticated"
  ON public.vocabulary_vault FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "vault_update_authenticated"
  ON public.vocabulary_vault FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "vault_delete_authenticated"
  ON public.vocabulary_vault FOR DELETE
  TO authenticated
  USING (TRUE);

-- Service role bypass
CREATE POLICY "vault_all_service_role"
  ON public.vocabulary_vault FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Grants
GRANT SELECT ON public.vocabulary_vault TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary_vault TO authenticated;
GRANT ALL ON public.vocabulary_vault TO service_role;

-- ============================================================
-- STEP 3: Add missing columns to assessments table
-- ============================================================

-- module_type: distinguishes VOCAB_MASTERY from AI modules
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS module_type TEXT;

-- schedule_mode: 'flexible' (due date) or 'fixed' (sync window)
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT DEFAULT 'flexible';

-- window_start / window_end: WITA-aware scheduling window (stored as TIMESTAMPTZ)
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS window_end TIMESTAMPTZ;

-- question_order: 'random' (default) or 'sequential'
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS question_order TEXT DEFAULT 'random';

-- payload: JSONB blob for module-specific metadata
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS payload JSONB;

-- ============================================================
-- STEP 4: Add metadata column to questions table (for topic/word_type snapshots)
-- ============================================================
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================================
-- STEP 5: Create get_server_time_wita() RPC
-- Returns the current server timestamp as TIMESTAMPTZ.
-- Frontend interprets it in +08:00 context.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_server_time_wita()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NOW() AT TIME ZONE 'Asia/Makassar';
$$;

-- Grant execute to all roles for time sync
GRANT EXECUTE ON FUNCTION public.get_server_time_wita() TO anon, authenticated, service_role;

-- ============================================================
-- STEP 6: Add level_number column to levels if missing
-- (Required for checkAndTriggerLevelUp max-level detection)
-- ============================================================
ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS level_number INTEGER DEFAULT 1;

-- ============================================================
-- STEP 7: Add program completion flag to students if missing
-- ============================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS program_status TEXT DEFAULT 'IN_PROGRESS';

-- ============================================================
-- DONE
-- ============================================================
