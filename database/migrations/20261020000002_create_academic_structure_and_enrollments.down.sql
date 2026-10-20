-- Migration: create_academic_structure_and_enrollments
-- Down

DROP TABLE IF EXISTS enrollment_status_histories CASCADE;
DROP TABLE IF EXISTS academic_enrollments CASCADE;
DROP TABLE IF EXISTS study_cohorts CASCADE;
DROP TABLE IF EXISTS class_sections CASCADE;
DROP TABLE IF EXISTS study_grades CASCADE;
DROP TABLE IF EXISTS educational_programs CASCADE;
DROP TABLE IF EXISTS academic_terms CASCADE;
DROP TABLE IF EXISTS academic_cycles CASCADE;
