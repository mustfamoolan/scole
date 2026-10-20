-- Migration: Create daily_homeworks, homework_submissions, and student_school_homeworks tables
CREATE TABLE IF NOT EXISTS student_school_homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    student_profile_id UUID NOT NULL,
    class_section_id UUID,
    study_grade_id UUID,
    subject_name VARCHAR(150) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    submitted_by VARCHAR(50) NOT NULL DEFAULT 'student',
    teacher_profile_id UUID,
    teacher_comment TEXT,
    is_seen BOOLEAN NOT NULL DEFAULT false,
    seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_school_hw_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_school_hw_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_school_hw_section FOREIGN KEY (class_section_id) REFERENCES class_sections(id) ON DELETE SET NULL,
    CONSTRAINT fk_school_hw_grade FOREIGN KEY (study_grade_id) REFERENCES study_grades(id) ON DELETE SET NULL,
    CONSTRAINT fk_school_hw_teacher FOREIGN KEY (teacher_profile_id) REFERENCES teacher_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_school_hw_tenant ON student_school_homeworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_hw_student ON student_school_homeworks(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_school_hw_section ON student_school_homeworks(class_section_id);
CREATE INDEX IF NOT EXISTS idx_school_hw_created_at ON student_school_homeworks(created_at);

CREATE TABLE IF NOT EXISTS daily_homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    teacher_assignment_id UUID NOT NULL,
    class_section_id UUID,
    study_grade_id UUID,
    title VARCHAR(255) NOT NULL,
    lesson_topic VARCHAR(255),
    description TEXT,
    attachment_urls JSONB DEFAULT '[]'::jsonb,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_daily_homeworks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_homeworks_assignment FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_homeworks_tenant ON daily_homeworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_homeworks_assignment ON daily_homeworks(teacher_assignment_id);
CREATE INDEX IF NOT EXISTS idx_daily_homeworks_section ON daily_homeworks(class_section_id);
CREATE INDEX IF NOT EXISTS idx_daily_homeworks_due_date ON daily_homeworks(due_date);

CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    daily_homework_id UUID NOT NULL,
    student_profile_id UUID NOT NULL,
    submitted_by VARCHAR(50) NOT NULL DEFAULT 'student',
    submission_text TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    teacher_rating VARCHAR(50),
    teacher_feedback TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_hw_sub_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_hw_sub_homework FOREIGN KEY (daily_homework_id) REFERENCES daily_homeworks(id) ON DELETE CASCADE,
    CONSTRAINT fk_hw_sub_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT uq_hw_student UNIQUE (daily_homework_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_hw_sub_tenant ON homework_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hw_sub_homework ON homework_submissions(daily_homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_sub_student ON homework_submissions(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_hw_sub_status ON homework_submissions(review_status);
