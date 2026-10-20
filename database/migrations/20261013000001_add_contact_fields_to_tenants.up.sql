-- 20261013000001_add_contact_fields_to_tenants.up.sql
-- Add essential contact fields to tenants table

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS address TEXT;
