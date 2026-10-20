-- Migration: add_iraqi_student_registration_fields
-- Up

-- 1. Add Iraqi identity, mother lineage, and address fields to persons table
ALTER TABLE persons
ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS mother_father_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(100),
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS governorate VARCHAR(100),
ADD COLUMN IF NOT EXISTS city_district VARCHAR(100),
ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
ADD COLUMN IF NOT EXISTS street_alley VARCHAR(50),
ADD COLUMN IF NOT EXISTS house_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS nearest_landmark VARCHAR(255);

-- 2. Add General Register Number (رقم السجل العام الورقي), previous schooling, civil archive, and health to student_profiles
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS general_register_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS previous_school VARCHAR(200),
ADD COLUMN IF NOT EXISTS graduation_doc_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS identity_doc_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS civil_volume VARCHAR(50),
ADD COLUMN IF NOT EXISTS civil_page VARCHAR(50),
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS health_status VARCHAR(150);

-- 3. Create index on general_register_number for quick physical archive lookups
CREATE INDEX IF NOT EXISTS idx_student_profiles_general_reg 
ON student_profiles (tenant_id, general_register_number);
