-- 20261014000001_create_domains_table.up.sql
-- Create domains table for custom domain management, verification, and tenant routing

CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    domain VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
    verification_token VARCHAR(128) NOT NULL,
    verification_method VARCHAR(32) NOT NULL DEFAULT 'dns_txt',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Unique index ensuring no domain can be assigned to multiple tenants (active non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_domain_active 
ON domains (LOWER(domain)) 
WHERE deleted_at IS NULL;

-- Index for tenant domain queries
CREATE INDEX IF NOT EXISTS idx_domains_tenant_id 
ON domains (tenant_id) 
WHERE deleted_at IS NULL;

-- Fast index for routing queries (domain + status)
CREATE INDEX IF NOT EXISTS idx_domains_domain_status 
ON domains (LOWER(domain), status) 
WHERE deleted_at IS NULL;
