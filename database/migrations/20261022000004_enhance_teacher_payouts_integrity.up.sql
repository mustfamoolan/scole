-- Migration: enhance_teacher_payouts_integrity (HR-6)
-- Up

-- 1. Add payroll_line_id to teacher_payout_accruals for future payroll integration
ALTER TABLE teacher_payout_accruals 
ADD COLUMN IF NOT EXISTS payroll_line_id UUID;

CREATE INDEX IF NOT EXISTS idx_payout_accrual_payroll ON teacher_payout_accruals (payroll_line_id);

-- 2. Partial unique index preventing double-accrual for the same class session
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_payout_session 
ON teacher_payout_accruals (tenant_id, actual_class_session_id) 
WHERE (actual_class_session_id IS NOT NULL AND status != 'void');

-- 3. Unique index ensuring an accrual is paid strictly once
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_payout_txn_accrual 
ON teacher_payout_transactions (tenant_id, payout_accrual_id);
