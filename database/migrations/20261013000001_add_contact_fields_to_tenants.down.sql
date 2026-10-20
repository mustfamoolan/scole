-- 20261013000001_add_contact_fields_to_tenants.down.sql
-- Remove contact fields from tenants table

ALTER TABLE tenants 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS address;
