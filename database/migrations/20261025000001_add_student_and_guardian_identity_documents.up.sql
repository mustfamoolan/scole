-- Migration: add_student_and_guardian_identity_documents
-- Up

ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS id_card_front_url TEXT,
ADD COLUMN IF NOT EXISTS id_card_back_url TEXT,
ADD COLUMN IF NOT EXISTS guardian_id_front_url TEXT,
ADD COLUMN IF NOT EXISTS guardian_id_back_url TEXT;
