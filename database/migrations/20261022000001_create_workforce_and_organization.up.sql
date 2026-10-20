-- Migration: create_workforce_and_organization (HR-2)
-- Up

-- 1. Positions catalog
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    is_managerial BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_position_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_positions_deleted_at ON positions (deleted_at);

-- 2. Staff profiles
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    staff_number VARCHAR(50) NOT NULL,
    employment_status VARCHAR(50) NOT NULL DEFAULT 'active',
    hire_date DATE NOT NULL,
    termination_date DATE,
    primary_branch_id UUID,
    direct_manager_staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_staff_tenant_person UNIQUE (tenant_id, person_id),
    CONSTRAINT uq_staff_tenant_number UNIQUE (tenant_id, staff_number),
    CONSTRAINT chk_staff_not_self_manager CHECK (id != direct_manager_staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_tenant ON staff_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_person ON staff_profiles (person_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_manager ON staff_profiles (direct_manager_staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_deleted_at ON staff_profiles (deleted_at);

-- 3. Departments table (now referencing staff_profiles directly)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    manager_staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_dept_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_deleted_at ON departments (deleted_at);

-- 4. Position assignments (History preserving)
CREATE TABLE IF NOT EXISTS position_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'primary',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pos_assign_tenant ON position_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_staff ON position_assignments (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_position ON position_assignments (position_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_dept ON position_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_deleted_at ON position_assignments (deleted_at);

-- Partial unique index ensuring strictly ONE active primary position per staff member
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_primary_active_pos 
ON position_assignments (tenant_id, staff_profile_id) 
WHERE (is_primary = TRUE AND status = 'active' AND deleted_at IS NULL);

-- 5. Extend existing teacher_profiles to optionally link with staff_profiles
ALTER TABLE teacher_profiles 
ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_staff ON teacher_profiles (staff_profile_id);
