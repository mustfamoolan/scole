-- Migration: create_contracts_and_credentials (HR-3)
-- Down

DROP TABLE IF EXISTS staff_documents CASCADE;
DROP TABLE IF EXISTS staff_qualifications CASCADE;
DROP TABLE IF EXISTS employment_contracts CASCADE;
