-- ====================================================================
-- TOPSCORE LMS: MISSING SCHEMA MIGRATION V4.3.0
-- ====================================================================

-- 1. PILAR A: Admin & Professional Profiles
CREATE TABLE IF NOT EXISTS public.user_professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    bio TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.professional_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES public.user_professionals(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.work_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES public.user_professionals(id) ON DELETE CASCADE,
    company TEXT,
    role TEXT,
    start_date DATE,
    end_date DATE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. PILAR B: Organizational Relations
-- Fix: column programs.institution_id does not exist
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE;

-- Fix: column classes.institution_id does not exist
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE;

-- 3. PILAR C: Class -> Topic -> Assessment Hierarchy
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    module_id UUID,
    name TEXT NOT NULL,
    type TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Note: 'question_types' requested by UI
CREATE TABLE IF NOT EXISTS public.question_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT
);

-- Fix: Create missing class_meetings table and link relation to class_instances
CREATE TABLE IF NOT EXISTS public.class_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_instance_id UUID REFERENCES public.class_instances(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'scheduled',
    meeting_link TEXT,
    notes TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Grant permissions (Adjust policies as needed for RLS)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
