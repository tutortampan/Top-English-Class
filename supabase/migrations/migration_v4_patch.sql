-- =============================================================================
-- TOPS CORE - ARCHITECTURE PATCH V4 (OPTION C, EXCEPTIONS, SERVER CRON)
-- =============================================================================

-- 1. Extend additional_members table for Option C Hybrid Rule
ALTER TABLE IF EXISTS additional_members
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DROPPED', 'TRANSFERRED')),
    ADD COLUMN IF NOT EXISTS dropped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Create exception-based attendance tracking table
CREATE TABLE IF NOT EXISTS class_meeting_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    original_date DATE NOT NULL,
    exception_type TEXT NOT NULL CHECK (exception_type IN ('CANCELED', 'RESCHEDULED', 'MISSED')),
    rescheduled_date DATE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_exceptions_class ON class_meeting_exceptions(class_instance_id, original_date);

-- 3. Server Authority routine to auto-close expired attempts
CREATE OR REPLACE FUNCTION auto_close_expired_attempts()
RETURNS void AS $$
BEGIN
    UPDATE challenge_attempts
    SET status = 'auto_submitted', submitted_at = COALESCE(expires_at, expected_end_at, NOW())
    WHERE status = 'in_progress' AND COALESCE(expires_at, expected_end_at) < NOW();
END;
$$ LANGUAGE plpgsql;
