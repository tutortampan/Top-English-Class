-- Migration: Remove Levels

-- 1. Remove level_id from exams
ALTER TABLE exams DROP COLUMN IF EXISTS level_id;

-- 2. Clean up progress table constraint
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_student_id_subject_id_level_id_key;

-- 2a. Remove duplicates in progress table if a student had progress in multiple levels of the same subject.
-- We keep the one with the most recent updated_at.
DELETE FROM progress p1
USING progress p2
WHERE p1.student_id = p2.student_id 
  AND p1.subject_id = p2.subject_id 
  AND p1.updated_at < p2.updated_at;

-- 2b. Add new unique constraint
ALTER TABLE progress ADD CONSTRAINT progress_student_id_subject_id_key UNIQUE (student_id, subject_id);

-- 2c. Drop the column
ALTER TABLE progress DROP COLUMN IF EXISTS level_id;

-- 3. Drop levels table
DROP TABLE IF EXISTS levels CASCADE;

-- 4. Recreate index on exams without level_id if needed. (idx_exams_level_id was dropped automatically).
