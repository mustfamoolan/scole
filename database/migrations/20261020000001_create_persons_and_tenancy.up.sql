-- Migration: create_persons_and_tenancy
-- Up

CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    national_id_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    grandfather_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    nationality VARCHAR(50),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_persons_name ON persons (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_persons_deleted_at ON persons (deleted_at);

CREATE TABLE IF NOT EXISTS communication_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    channel_type VARCHAR(30) NOT NULL, -- email, phone, whatsapp, telegram
    channel_value VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_channels_person ON communication_channels (person_id);
CREATE INDEX IF NOT EXISTS idx_comm_channels_value ON communication_channels (channel_value);

CREATE TABLE IF NOT EXISTS tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_person UNIQUE (tenant_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_person ON tenant_memberships (person_id);

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL,
    enrollment_status VARCHAR(50) NOT NULL DEFAULT 'registered',
    medical_notes TEXT,
    special_education_needs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_student_tenant_person UNIQUE (tenant_id, person_id),
    CONSTRAINT uq_student_tenant_number UNIQUE (tenant_id, student_number)
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_tenant ON student_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_deleted_at ON student_profiles (deleted_at);

CREATE TABLE IF NOT EXISTS teacher_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    staff_number VARCHAR(50) NOT NULL,
    specialization VARCHAR(150),
    employment_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    hourly_rate NUMERIC(15, 4),
    monthly_salary NUMERIC(15, 4),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_teacher_tenant_person UNIQUE (tenant_id, person_id),
    CONSTRAINT uq_teacher_tenant_number UNIQUE (tenant_id, staff_number)
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_tenant ON teacher_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_deleted_at ON teacher_profiles (deleted_at);

CREATE TABLE IF NOT EXISTS guardian_student_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    guardian_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_grades BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_attendance BOOLEAN NOT NULL DEFAULT TRUE,
    can_receive_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    can_pickup_student BOOLEAN NOT NULL DEFAULT FALSE,
    is_financially_responsible BOOLEAN NOT NULL DEFAULT FALSE,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_guardian_student UNIQUE (tenant_id, guardian_person_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_student_tenant ON guardian_student_relations (tenant_id);
