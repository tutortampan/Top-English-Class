-- ============================================================
-- MIGRATION: Phase 3 Terminology Changes
-- Safely renames legacy schema to the new A/B/C/D Terminology
-- ============================================================

-- 1. Rename Subjects to Classes
ALTER TABLE IF EXISTS subjects RENAME TO classes;
ALTER TABLE IF EXISTS topics RENAME COLUMN subject_id TO class_id;
ALTER TABLE IF EXISTS class_instances RENAME COLUMN subject_id TO class_id;
ALTER TABLE IF EXISTS questions RENAME COLUMN subject_id TO class_id;
ALTER TABLE IF EXISTS assessments RENAME COLUMN subject_id TO class_id;

-- 2. Rename Word Types to Question Types
ALTER TABLE IF EXISTS word_types RENAME TO question_types;
ALTER TABLE IF EXISTS questions RENAME COLUMN word_type TO question_type;
ALTER TABLE IF EXISTS assessment_questions RENAME COLUMN word_type_snapshot TO question_type_snapshot;
ALTER TABLE IF EXISTS attempt_answers RENAME COLUMN word_type_snapshot TO question_type_snapshot;

-- 3. Rename Assessments to Challenge Definitions
ALTER TABLE IF EXISTS assessments RENAME TO challenge_definitions;
ALTER TABLE IF EXISTS assessment_topics RENAME TO challenge_definition_topics;
ALTER TABLE IF EXISTS assessment_questions RENAME TO challenge_definition_questions;
ALTER TABLE IF EXISTS assessment_programs RENAME TO challenge_definition_programs;

ALTER TABLE IF EXISTS challenge_definition_topics RENAME COLUMN assessment_id TO challenge_definition_id;
ALTER TABLE IF EXISTS challenge_definition_questions RENAME COLUMN assessment_id TO challenge_definition_id;
ALTER TABLE IF EXISTS challenge_definition_programs RENAME COLUMN assessment_id TO challenge_definition_id;
ALTER TABLE IF EXISTS assignments RENAME COLUMN assessment_id TO challenge_definition_id;
ALTER TABLE IF EXISTS attempts RENAME COLUMN assessment_id TO challenge_definition_id;
ALTER TABLE IF EXISTS question_usage_history RENAME COLUMN assessment_id TO challenge_definition_id;

ALTER TABLE IF EXISTS challenge_definitions RENAME COLUMN assessment_type TO challenge_definition_type;

-- 4. Rename Assignments to Challenge Instances
ALTER TABLE IF EXISTS assignments RENAME TO challenge_instances;
ALTER TABLE IF EXISTS challenge_instances RENAME COLUMN assignment_type TO challenge_instance_type;

-- 5. Add new columns to Blueprints
ALTER TABLE IF EXISTS institutions ADD COLUMN IF NOT EXISTS map_location TEXT;
ALTER TABLE IF EXISTS batches ADD COLUMN IF NOT EXISTS actual_final_date DATE;

-- Note: RLS policies and trigger functions must be re-applied or updated manually to reflect new names.
