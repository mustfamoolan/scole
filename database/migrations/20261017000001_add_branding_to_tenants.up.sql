-- 20261017000001_add_branding_to_tenants.up.sql
-- Add branding and visual identity fields to tenants table

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#4f46e5';
