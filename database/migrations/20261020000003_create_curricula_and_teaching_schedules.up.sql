-- Migration: create_curricula_and_teaching_schedules
-- Up

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects (code);

CREATE TABLE IF NOT EXISTS curriculum_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    publisher VARCHAR(150),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_curriculum_def_subject ON curriculum_definitions (subject_id);

CREATE TABLE IF NOT EXISTS curriculum_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_definition_id UUID NOT NULL REFERENCES curriculum_definitions(id) ON DELETE CASCADE,
    edition_name VARCHAR(100) NOT NULL,
    year_published INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    total_teaching_hours INT NOT NULL DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_curriculum_editions_def ON curriculum_editions (curriculum_definition_id);

CREATE TABLE IF NOT EXISTS adopted_curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    curriculum_edition_id UUID NOT NULL REFERENCES curriculum_editions(id) ON DELETE RESTRICT,
    study_grade_id UUID REFERENCES study_grades(id) ON DELETE CASCADE,
    study_cohort_id UUID REFERENCES study_cohorts(id) ON DELETE CASCADE,
    academic_cycle_id UUID NOT NULL REFERENCES academic_cycles(id) ON DELETE CASCADE,
    weekly_sessions_count INT NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adopted_curricula_tenant ON adopted_curricula (tenant_id);

CREATE TABLE IF NOT EXISTS book_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_edition_id UUID NOT NULL REFERENCES curriculum_editions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    isbn VARCHAR(50),
    authors VARCHAR(255),
    digital_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_books_edition ON book_editions (curriculum_edition_id);

CREATE TABLE IF NOT EXISTS teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    teacher_profile_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    adopted_curriculum_id UUID NOT NULL REFERENCES adopted_curricula(id) ON DELETE CASCADE,
    class_section_id UUID REFERENCES class_sections(id) ON DELETE CASCADE,
    study_cohort_id UUID REFERENCES study_cohorts(id) ON DELETE CASCADE,
    is_lead_teacher BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments (teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_curriculum ON teacher_assignments (adopted_curriculum_id);

CREATE TABLE IF NOT EXISTS planned_schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    teacher_assignment_id UUID NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL, -- 0=Sunday, 1=Monday...
    start_time VARCHAR(10) NOT NULL, -- "08:30"
    end_time VARCHAR(10) NOT NULL,   -- "09:15"
    room_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_assignment ON planned_schedule_slots (teacher_assignment_id);

CREATE TABLE IF NOT EXISTS actual_class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    planned_schedule_slot_id UUID REFERENCES planned_schedule_slots(id) ON DELETE SET NULL,
    teacher_assignment_id UUID NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
    substitute_teacher_id UUID REFERENCES teacher_profiles(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    actual_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- scheduled, in_progress, completed, cancelled, rescheduled_makeup
    cancellation_reason TEXT,
    lesson_topic_delivered VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_actual_sessions_tenant ON actual_class_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_actual_sessions_date ON actual_class_sessions (session_date);
