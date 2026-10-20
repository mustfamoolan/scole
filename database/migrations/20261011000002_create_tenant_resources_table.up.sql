-- 20261011000002_create_tenant_resources_table.up.sql
-- Create tenant_resources table with foreign key constraint and tenant scoping index

CREATE TABLE IF NOT EXISTS tenant_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_id ON tenant_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_resources_deleted_at ON tenant_resources(deleted_at);
