-- Migration: 20260930_assessments_prerequisite.sql
-- Description: Adds prerequisite_id for Sequential Gating, and ensures program_id exists.

ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS prerequisite_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL;

ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_assessments_prerequisite_id ON public.assessments (prerequisite_id);

-- Make sure we notify postgrest schema reload
NOTIFY pgrst, 'reload schema';
