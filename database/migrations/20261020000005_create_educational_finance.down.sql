-- Migration: create_educational_finance
-- Down

DROP TABLE IF EXISTS teacher_payout_transactions CASCADE;
DROP TABLE IF EXISTS teacher_payout_accruals CASCADE;
DROP TABLE IF EXISTS session_packages CASCADE;
DROP TABLE IF EXISTS refund_transactions CASCADE;
DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS scholarship_discounts CASCADE;
DROP TABLE IF EXISTS charge_accruals CASCADE;
DROP TABLE IF EXISTS fee_policies CASCADE;
