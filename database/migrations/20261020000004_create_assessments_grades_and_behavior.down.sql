-- Migration: create_assessments_grades_and_behavior
-- Down

DROP TABLE IF EXISTS behavior_incidents CASCADE;
DROP TABLE IF EXISTS grade_audit_logs CASCADE;
DROP TABLE IF EXISTS student_grade_records CASCADE;
DROP TABLE IF EXISTS assessment_items CASCADE;
DROP TABLE IF EXISTS assessment_plans CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
