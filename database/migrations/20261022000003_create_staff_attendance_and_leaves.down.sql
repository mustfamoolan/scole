-- Migration: create_staff_attendance_and_leaves (HR-5)
-- Down

DROP TABLE IF EXISTS staff_leave_requests CASCADE;
DROP TABLE IF EXISTS staff_attendance_records CASCADE;
