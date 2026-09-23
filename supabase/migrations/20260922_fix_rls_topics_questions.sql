-- ====================================================================
-- TOPSCORE LMS: FIX RLS POLICIES FOR TOPICS TABLE
-- Problem: admin_all_topics policy was granted to 'anon' role only.
-- Authenticated admin users were being blocked on INSERT/UPDATE/DELETE.
-- Also: v430 migration created a duplicate topics table - this patch
-- ensures RLS on the correct unified table is fixed.
-- ====================================================================

-- Step 1: Drop the broken anon-only policies on topics
DROP POLICY IF EXISTS "anon_read_topics" ON public.topics;
DROP POLICY IF EXISTS "admin_all_topics" ON public.topics;
DROP POLICY IF EXISTS "service_role_all_topics" ON public.topics;

-- Step 2: Re-create correct policies
-- Allow anyone (including students) to READ topics
CREATE POLICY "topics_select_all"
  ON public.topics FOR SELECT
  USING (TRUE);

-- Allow authenticated users (admins) to INSERT topics
CREATE POLICY "topics_insert_authenticated"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Allow authenticated users (admins) to UPDATE topics
CREATE POLICY "topics_update_authenticated"
  ON public.topics FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Allow authenticated users (admins) to DELETE (soft-delete) topics
CREATE POLICY "topics_delete_authenticated"
  ON public.topics FOR DELETE
  TO authenticated
  USING (TRUE);

-- Allow service_role full access (for Edge Functions)
CREATE POLICY "topics_all_service_role"
  ON public.topics FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Step 3: Also fix questions table RLS (same pattern - needed for import INSERT)
DROP POLICY IF EXISTS "anon_read_questions" ON public.questions;
DROP POLICY IF EXISTS "admin_all_questions" ON public.questions;
DROP POLICY IF EXISTS "service_role_all_questions" ON public.questions;

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

-- Step 4: Fix question_types table (word types - also written during import)
DROP POLICY IF EXISTS "anon_read_question_types" ON public.question_types;
DROP POLICY IF EXISTS "admin_all_question_types" ON public.question_types;

CREATE POLICY "question_types_select_all"
  ON public.question_types FOR SELECT
  USING (TRUE);

CREATE POLICY "question_types_insert_authenticated"
  ON public.question_types FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "question_types_update_authenticated"
  ON public.question_types FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "question_types_all_service_role"
  ON public.question_types FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
