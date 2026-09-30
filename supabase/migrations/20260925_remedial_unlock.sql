-- Migration for Phase 4: Remedial
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS is_remedial_unlocked BOOLEAN DEFAULT FALSE;
