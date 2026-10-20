-- Migration: add_teacher_access_code
-- Up

ALTER TABLE teacher_profiles 
ADD COLUMN IF NOT EXISTS access_code VARCHAR(50);

UPDATE teacher_profiles 
SET access_code = 'TCH-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6))
WHERE access_code IS NULL OR access_code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_tenant_access_code 
ON teacher_profiles (tenant_id, access_code);
