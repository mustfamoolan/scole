-- Migration: create_persons_and_tenancy
-- Down

DROP TABLE IF EXISTS guardian_student_relations CASCADE;
DROP TABLE IF EXISTS teacher_profiles CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS tenant_memberships CASCADE;
DROP TABLE IF EXISTS communication_channels CASCADE;
DROP TABLE IF EXISTS persons CASCADE;
