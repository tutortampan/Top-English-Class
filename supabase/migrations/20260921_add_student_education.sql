-- Add education column to students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS education TEXT;

-- Add status to topics
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
