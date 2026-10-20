-- 20261014000001_create_domains_table.down.sql
-- Drop domains table and related indexes

DROP INDEX IF EXISTS idx_domains_domain_status;
DROP INDEX IF EXISTS idx_domains_tenant_id;
DROP INDEX IF EXISTS uq_domains_domain_active;
DROP TABLE IF EXISTS domains;
