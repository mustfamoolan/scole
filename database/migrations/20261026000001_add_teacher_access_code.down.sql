-- Migration: add_teacher_access_code
-- Down

DROP INDEX IF EXISTS idx_teacher_tenant_access_code;
ALTER TABLE teacher_profiles DROP COLUMN IF EXISTS access_code;
