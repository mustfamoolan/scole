-- Migration: add_student_access_code_and_guardian_profiles
-- Up

-- 1. Add easy access_code to student_profiles
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS access_code VARCHAR(50);

-- Populate existing students with generated access_code if null
UPDATE student_profiles 
SET access_code = 'STU-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6))
WHERE access_code IS NULL OR access_code = '';

-- Make access_code unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_tenant_access_code 
ON student_profiles (tenant_id, access_code);

-- 2. Create guardian_profiles table
CREATE TABLE IF NOT EXISTS guardian_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    access_code VARCHAR(50) NOT NULL,
    occupation VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_guardian_tenant_person UNIQUE (tenant_id, person_id),
    CONSTRAINT uq_guardian_tenant_access_code UNIQUE (tenant_id, access_code)
);

CREATE INDEX IF NOT EXISTS idx_guardian_profiles_tenant ON guardian_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_guardian_profiles_deleted_at ON guardian_profiles (deleted_at);
