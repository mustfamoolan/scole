-- Migration: create_contracts_and_credentials (HR-3)
-- Up

-- 1. Employment contracts table
CREATE TABLE IF NOT EXISTS employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    contract_number VARCHAR(100) NOT NULL,
    contract_type VARCHAR(50) NOT NULL, -- full_time, part_time, per_session, contractor, temporary
    base_salary NUMERIC(15, 4),
    hourly_rate NUMERIC(15, 4),
    default_session_rate NUMERIC(15, 4),
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- draft, active, renewed, terminated, expired
    signed_at TIMESTAMP WITH TIME ZONE,
    terms_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_contract_tenant_number UNIQUE (tenant_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON employment_contracts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_staff ON employment_contracts (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON employment_contracts (deleted_at);

-- Partial unique index ensuring strictly ONE active contract per staff member
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_active_contract 
ON employment_contracts (tenant_id, staff_profile_id) 
WHERE (status = 'active' AND deleted_at IS NULL);

-- 2. Staff qualifications & credentials table
CREATE TABLE IF NOT EXISTS staff_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    qualification_type VARCHAR(50) NOT NULL, -- bachelor, master, phd, diploma, certificate, teaching_license
    title VARCHAR(200) NOT NULL,
    institution_name VARCHAR(200) NOT NULL,
    graduation_year INT,
    document_url VARCHAR(500),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_qualifications_tenant ON staff_qualifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_staff ON staff_qualifications (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_deleted_at ON staff_qualifications (deleted_at);

-- 3. Confidential documents & attachments table
CREATE TABLE IF NOT EXISTS staff_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    document_category VARCHAR(50) NOT NULL, -- identity, contract_scan, credential, clearance, medical, other
    title VARCHAR(200) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_staff_docs_tenant ON staff_documents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_docs_staff ON staff_documents (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_docs_expires ON staff_documents (expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_docs_deleted_at ON staff_documents (deleted_at);
