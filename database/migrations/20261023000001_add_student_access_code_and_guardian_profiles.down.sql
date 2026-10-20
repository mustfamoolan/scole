-- Migration: add_student_access_code_and_guardian_profiles
-- Down

DROP TABLE IF EXISTS guardian_profiles CASCADE;

DROP INDEX IF EXISTS idx_student_tenant_access_code;

ALTER TABLE student_profiles 
DROP COLUMN IF EXISTS access_code;
