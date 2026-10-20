-- Migration: add_iraqi_student_registration_fields
-- Down

DROP INDEX IF EXISTS idx_student_profiles_general_reg;

ALTER TABLE student_profiles
DROP COLUMN IF EXISTS general_register_number,
DROP COLUMN IF EXISTS previous_school,
DROP COLUMN IF EXISTS graduation_doc_number,
DROP COLUMN IF EXISTS identity_doc_type,
DROP COLUMN IF EXISTS civil_volume,
DROP COLUMN IF EXISTS civil_page,
DROP COLUMN IF EXISTS emergency_contact_name,
DROP COLUMN IF EXISTS emergency_contact_phone,
DROP COLUMN IF EXISTS health_status;

ALTER TABLE persons
DROP COLUMN IF EXISTS mother_name,
DROP COLUMN IF EXISTS mother_father_name,
DROP COLUMN IF EXISTS place_of_birth,
DROP COLUMN IF EXISTS blood_type,
DROP COLUMN IF EXISTS governorate,
DROP COLUMN IF EXISTS city_district,
DROP COLUMN IF EXISTS neighborhood,
DROP COLUMN IF EXISTS street_alley,
DROP COLUMN IF EXISTS house_number,
DROP COLUMN IF EXISTS nearest_landmark;
