-- Migration: enhance_teacher_payouts_integrity (HR-6)
-- Down

DROP INDEX IF EXISTS idx_uq_payout_txn_accrual;
DROP INDEX IF EXISTS idx_uq_payout_session;

ALTER TABLE teacher_payout_accruals 
DROP COLUMN IF EXISTS payroll_line_id;
