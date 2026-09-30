-- Phase 1: Database Audit & Historical Data Restoration

-- 1.3: Re-parent orphaned historical assessments to correct class_id
-- We have identified that some assessments (e.g., from Camp 131 / August) were 
-- assigned to obsolete "Vocabulary" classes that have no level_id.
-- We must remap them to the active "Vocabulary Mastery" class for the 3rd Level.

UPDATE public.assessments
SET class_id = '440d06ff-6365-45b7-95a8-4a621ee33583' -- Correct 3rd Level Vocabulary Mastery Class
WHERE class_id IN (
    '00000000-0000-0000-0000-000000000001',
    'f29c808b-1292-4566-8bdd-dd13aa4e7b62'
) AND level_id = '51589e1a-d96e-496e-92a3-d9d350483555';

-- If there are any other assessments assigned to null class_id, let's fix them if they belong to 3rd level
UPDATE public.assessments
SET class_id = '440d06ff-6365-45b7-95a8-4a621ee33583'
WHERE class_id IS NULL AND level_id = '51589e1a-d96e-496e-92a3-d9d350483555';

-- And any batches missing program_id or current_level_id that match '131' or 'camp'
-- Let's update batch 'c0648c2d-34f2-4151-bf04-dabf2c5a78b9' (131) just in case (though it has them)
-- Actually, the diagnosis showed 131 DOES have program_id and level_id.
