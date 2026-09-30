-- ============================================================
-- TopsCore - Drop Obsolete Legacy Tables Migration
-- Drops tables that have been fully replaced or renamed (like challenge definitions)
-- ============================================================

DO $$$
BEGIN
  -- We assume data has already been migrated by earlier scripts (e.g., 20260921_v5_purge_challenges.sql)

  DROP TABLE IF EXISTS public.challenge_definitions CASCADE;
  DROP TABLE IF EXISTS public.challenge_definition_topics CASCADE;
  DROP TABLE IF EXISTS public.challenge_definition_questions CASCADE;
  DROP TABLE IF EXISTS public.challenge_definition_programs CASCADE;

  -- The following tables were renamed in a previous migration, 
  -- but we add DROP IF EXISTS just in case old versions were left behind.
  DROP TABLE IF EXISTS public.challenge_instances CASCADE;
  DROP TABLE IF EXISTS public.challenge_attempts CASCADE;
  DROP TABLE IF EXISTS public.challenge_attempt_answers CASCADE;
  
  -- Any other known obsolete tables
  DROP TABLE IF EXISTS public.exams CASCADE;
  DROP TABLE IF EXISTS public.exam_classes CASCADE;

END $$$;
