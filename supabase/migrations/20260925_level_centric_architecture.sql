-- ============================================================
-- MIGRATION: LEVEL-CENTRIC ARCHITECTURE (MODEL A)
-- Phase: Fase 1 (Skema Data Dasar)
-- ============================================================

-- 1. Create levels table
CREATE TABLE IF NOT EXISTS public.levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert Core Levels
INSERT INTO public.levels (level_number, name, description)
VALUES
    (0, 'All Levels', 'Placement Test / Daily Drill / Comprehensive Pool'),
    (1, '1st Level', 'Basic and Foundational'),
    (2, '2nd Level', 'Intermediate'),
    (3, '3rd Level', 'Advanced')
ON CONFLICT (level_number) DO NOTHING;

-- 3. Add level_id to classes
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;

-- 4. Add level_id to students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;
