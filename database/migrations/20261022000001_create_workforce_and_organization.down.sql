-- Migration: create_workforce_and_organization (HR-2)
-- Down

ALTER TABLE IF EXISTS teacher_profiles 
DROP COLUMN IF EXISTS staff_profile_id;

DROP TABLE IF EXISTS position_assignments CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS staff_profiles CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
