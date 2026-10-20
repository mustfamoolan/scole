-- Revert migration: Drop daily_homeworks and homework_submissions tables
DROP TABLE IF EXISTS homework_submissions CASCADE;
DROP TABLE IF EXISTS daily_homeworks CASCADE;
