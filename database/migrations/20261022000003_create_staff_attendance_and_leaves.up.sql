-- Migration: create_staff_attendance_and_leaves (HR-5)
-- Up

-- 1. Staff Attendance Records
CREATE TABLE IF NOT EXISTS staff_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'present', -- present, late, absent, on_leave, excused
    late_minutes INT NOT NULL DEFAULT 0,
    notes TEXT,
    is_corrected BOOLEAN NOT NULL DEFAULT FALSE,
    correction_reason TEXT,
    corrected_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_staff_attendance_day UNIQUE (tenant_id, staff_profile_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_att_tenant ON staff_attendance_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_att_staff ON staff_attendance_records (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_att_date ON staff_attendance_records (attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_att_deleted_at ON staff_attendance_records (deleted_at);

-- 2. Staff Leave Requests
CREATE TABLE IF NOT EXISTS staff_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL, -- annual, sick, emergency, unpaid, maternity, paternity
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON staff_leave_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON staff_leave_requests (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON staff_leave_requests (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_deleted_at ON staff_leave_requests (deleted_at);
