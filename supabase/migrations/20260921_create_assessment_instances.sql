-- ====================================================================
-- Create assessment_instances table
-- This is the V5 assignment table that links assessments to class instances
-- (replaces the legacy exam_programs and challenge_instances tables)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.assessment_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  class_instance_id UUID REFERENCES public.class_instances(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  title_override TEXT,
  availability_start TIMESTAMP WITH TIME ZONE,
  availability_end TIMESTAMP WITH TIME ZONE,
  working_duration_minutes INTEGER,
  max_attempts INTEGER DEFAULT 0,
  result_policy TEXT DEFAULT 'HIGHEST',
  status TEXT DEFAULT 'ACTIVE',
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_assessment_instances_assessment_id ON public.assessment_instances(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_student_id ON public.assessment_instances(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_batch_id ON public.assessment_instances(batch_id);

-- Migrate existing exam_programs data into assessment_instances
-- (exam_programs uses exam_id which maps to assessments.id after migration)
INSERT INTO public.assessment_instances (
  id, assessment_id, status, created_at
)
SELECT
  gen_random_uuid(),
  ep.exam_id,
  'ACTIVE',
  NOW()
FROM public.exam_programs ep
WHERE EXISTS (SELECT 1 FROM public.assessments WHERE id = ep.exam_id)
ON CONFLICT DO NOTHING;

-- Reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
