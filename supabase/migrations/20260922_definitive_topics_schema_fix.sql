-- ====================================================================
-- TOPSCORE LMS: DEFINITIVE TOPICS TABLE SCHEMA FIX
-- Problem 1: topics.subject_id is NOT NULL but import sends class_id only
-- Problem 2: topics.class_id column doesn't exist (CREATE IF NOT EXISTS skipped)
-- Problem 3: RLS policies on anon role — authenticated admins blocked
-- Problem 4: question_types table has no RLS at all
-- ====================================================================

-- STEP 1: Add class_id to topics if missing
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- STEP 2: Make subject_id nullable (we now use class_id)
ALTER TABLE public.topics
  ALTER COLUMN subject_id DROP NOT NULL;

-- STEP 3: Add missing columns to topics that v430 expected
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- STEP 4: Add class_id to questions if missing
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- STEP 5: Fix RLS — DROP all old broken policies on topics
DROP POLICY IF EXISTS "anon_read_topics" ON public.topics;
DROP POLICY IF EXISTS "admin_all_topics" ON public.topics;
DROP POLICY IF EXISTS "service_role_all_topics" ON public.topics;
DROP POLICY IF EXISTS "topics_select_all" ON public.topics;
DROP POLICY IF EXISTS "topics_insert_authenticated" ON public.topics;
DROP POLICY IF EXISTS "topics_update_authenticated" ON public.topics;
DROP POLICY IF EXISTS "topics_delete_authenticated" ON public.topics;
DROP POLICY IF EXISTS "topics_all_service_role" ON public.topics;

-- STEP 6: Re-create correct topics RLS policies
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics_select_all"
  ON public.topics FOR SELECT
  USING (deleted_at IS NULL OR deleted_at IS NOT NULL);

CREATE POLICY "topics_insert_authenticated"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "topics_update_authenticated"
  ON public.topics FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "topics_delete_authenticated"
  ON public.topics FOR DELETE
  TO authenticated
  USING (TRUE);

CREATE POLICY "topics_all_service_role"
  ON public.topics FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- STEP 7: Fix RLS — DROP all old broken policies on questions
DROP POLICY IF EXISTS "anon_read_questions" ON public.questions;
DROP POLICY IF EXISTS "admin_all_questions" ON public.questions;
DROP POLICY IF EXISTS "service_role_all_questions" ON public.questions;
DROP POLICY IF EXISTS "questions_select_all" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_authenticated" ON public.questions;
DROP POLICY IF EXISTS "questions_update_authenticated" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_authenticated" ON public.questions;
DROP POLICY IF EXISTS "questions_all_service_role" ON public.questions;

-- STEP 8: Re-create correct questions RLS policies
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_select_all"
  ON public.questions FOR SELECT
  USING (TRUE);

CREATE POLICY "questions_insert_authenticated"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "questions_update_authenticated"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "questions_delete_authenticated"
  ON public.questions FOR DELETE
  TO authenticated
  USING (TRUE);

CREATE POLICY "questions_all_service_role"
  ON public.questions FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- STEP 9: Fix question_types RLS (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_types' AND table_schema = 'public') THEN
    ALTER TABLE public.question_types ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_read_question_types" ON public.question_types;
    DROP POLICY IF EXISTS "admin_all_question_types" ON public.question_types;
    DROP POLICY IF EXISTS "service_role_all_question_types" ON public.question_types;
    DROP POLICY IF EXISTS "question_types_select_all" ON public.question_types;
    DROP POLICY IF EXISTS "question_types_insert_authenticated" ON public.question_types;
    DROP POLICY IF EXISTS "question_types_update_authenticated" ON public.question_types;
    DROP POLICY IF EXISTS "question_types_all_service_role" ON public.question_types;

    CREATE POLICY "question_types_select_all"
      ON public.question_types FOR SELECT USING (TRUE);

    CREATE POLICY "question_types_insert_authenticated"
      ON public.question_types FOR INSERT TO authenticated WITH CHECK (TRUE);

    CREATE POLICY "question_types_update_authenticated"
      ON public.question_types FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

    CREATE POLICY "question_types_all_service_role"
      ON public.question_types FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- STEP 10: Grant table permissions explicitly to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO anon;
GRANT SELECT ON public.questions TO anon;
GRANT SELECT ON public.question_types TO anon;
