-- Migration: create_assessments_grades_and_behavior
-- Up

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    actual_session_id UUID NOT NULL REFERENCES actual_class_sessions(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL, -- present, absent_unexcused, absent_excused, late, left_early
    minutes_late INT NOT NULL DEFAULT 0,
    excuse_document VARCHAR(500),
    excuse_notes TEXT,
    recorded_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_actual_session UNIQUE (student_profile_id, actual_session_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records (student_profile_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records (record_date);

CREATE TABLE IF NOT EXISTS assessment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    adopted_curriculum_id UUID NOT NULL REFERENCES adopted_curricula(id) ON DELETE CASCADE,
    academic_term_id UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    total_max_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    passing_score NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    policy_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_assessment_plans_curriculum ON assessment_plans (adopted_curriculum_id);

CREATE TABLE IF NOT EXISTS assessment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assessment_plan_id UUID NOT NULL REFERENCES assessment_plans(id) ON DELETE CASCADE,
    class_section_id UUID REFERENCES class_sections(id) ON DELETE CASCADE,
    study_cohort_id UUID REFERENCES study_cohorts(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- quiz, midterm_exam, final_exam, homework, project
    max_score NUMERIC(5, 2) NOT NULL,
    weight_percentage NUMERIC(5, 2) NOT NULL,
    assessment_date DATE NOT NULL,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessment_items_plan ON assessment_items (assessment_plan_id);

CREATE TABLE IF NOT EXISTS student_grade_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assessment_item_id UUID NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    raw_score NUMERIC(5, 2) NOT NULL,
    final_score NUMERIC(5, 2) NOT NULL,
    grade_letter VARCHAR(10),
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    is_excused BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted', -- draft, submitted, approved, revised
    recorded_by_user_id UUID NOT NULL,
    approved_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_assessment_item UNIQUE (student_profile_id, assessment_item_id)
);

CREATE INDEX IF NOT EXISTS idx_student_grades_tenant ON student_grade_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_student ON student_grade_records (student_profile_id);

CREATE TABLE IF NOT EXISTS grade_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_grade_record_id UUID NOT NULL REFERENCES student_grade_records(id) ON DELETE CASCADE,
    previous_score NUMERIC(5, 2) NOT NULL,
    new_score NUMERIC(5, 2) NOT NULL,
    change_reason TEXT NOT NULL,
    approved_ref_number VARCHAR(100),
    modified_by_user_id UUID NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grade_audit_record ON grade_audit_logs (student_grade_record_id);

CREATE TABLE IF NOT EXISTS behavior_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL,
    incident_type VARCHAR(50) NOT NULL, -- positive_merit, minor_misconduct, serious_violation
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    reported_by_user_id UUID NOT NULL,
    is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'under_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_behavior_tenant ON behavior_incidents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_behavior_student ON behavior_incidents (student_profile_id);
