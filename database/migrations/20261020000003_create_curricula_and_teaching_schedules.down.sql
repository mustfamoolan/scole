-- Migration: create_curricula_and_teaching_schedules
-- Down

DROP TABLE IF EXISTS actual_class_sessions CASCADE;
DROP TABLE IF EXISTS planned_schedule_slots CASCADE;
DROP TABLE IF EXISTS teacher_assignments CASCADE;
DROP TABLE IF EXISTS book_editions CASCADE;
DROP TABLE IF EXISTS adopted_curricula CASCADE;
DROP TABLE IF EXISTS curriculum_editions CASCADE;
DROP TABLE IF EXISTS curriculum_definitions CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
