-- Migration: add_student_and_guardian_identity_documents
-- Down

ALTER TABLE student_profiles
DROP COLUMN IF EXISTS photo_url,
DROP COLUMN IF EXISTS id_card_front_url,
DROP COLUMN IF EXISTS id_card_back_url,
DROP COLUMN IF EXISTS guardian_id_front_url,
DROP COLUMN IF EXISTS guardian_id_back_url;
