-- 20261017000001_add_branding_to_tenants.down.sql
-- Remove branding fields from tenants table

ALTER TABLE tenants 
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS favicon_url,
DROP COLUMN IF EXISTS primary_color;
