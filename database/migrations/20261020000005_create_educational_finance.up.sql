-- Migration: create_educational_finance
-- Up

CREATE TABLE IF NOT EXISTS fee_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    target_entity_type VARCHAR(50) NOT NULL, -- grade, program, cohort, transportation, registration
    target_entity_id UUID,
    base_amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    billing_frequency VARCHAR(50) NOT NULL DEFAULT 'one_time',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_fee_policies_tenant ON fee_policies (tenant_id);

CREATE TABLE IF NOT EXISTS charge_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES academic_enrollments(id) ON DELETE SET NULL,
    fee_policy_id UUID REFERENCES fee_policies(id) ON DELETE SET NULL,
    charge_type VARCHAR(50) NOT NULL, -- tuition_installment, course_fee, bus_fee, book_fee
    description VARCHAR(255) NOT NULL,
    gross_amount NUMERIC(15, 4) NOT NULL,
    discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    net_due_amount NUMERIC(15, 4) NOT NULL,
    paid_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- unpaid, partially_paid, paid, void, written_off
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_charge_accruals_tenant ON charge_accruals (tenant_id);
CREATE INDEX IF NOT EXISTS idx_charge_accruals_student ON charge_accruals (student_profile_id);
CREATE INDEX IF NOT EXISTS idx_charge_accruals_due_date ON charge_accruals (due_date);

CREATE TABLE IF NOT EXISTS scholarship_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    charge_accrual_id UUID NOT NULL REFERENCES charge_accruals(id) ON DELETE CASCADE,
    discount_type VARCHAR(50) NOT NULL, -- percentage, fixed_amount, sibling_discount, staff_child, merit_scholarship
    discount_value NUMERIC(15, 4) NOT NULL,
    calculated_reduction NUMERIC(15, 4) NOT NULL,
    justification VARCHAR(255) NOT NULL,
    approved_by_user_id UUID NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scholarships_accrual ON scholarship_discounts (charge_accrual_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payer_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(100) NOT NULL,
    total_amount NUMERIC(15, 4) NOT NULL,
    allocated_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unallocated_amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    payment_method VARCHAR(50) NOT NULL, -- cash, zain_cash, qi_card, bank_transfer, pos
    payment_gateway_ref VARCHAR(150),
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cashier_user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'collected', -- collected, refunded, partially_refunded, void
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_tenant_receipt UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payer ON payment_transactions (payer_person_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions (payment_date);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    charge_accrual_id UUID NOT NULL REFERENCES charge_accruals(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(15, 4) NOT NULL,
    allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    allocated_by_user_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_alloc_txn ON payment_allocations (payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_accrual ON payment_allocations (charge_accrual_id);

CREATE TABLE IF NOT EXISTS refund_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    original_payment_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
    charge_accrual_id UUID REFERENCES charge_accruals(id) ON DELETE SET NULL,
    refund_receipt_number VARCHAR(100) NOT NULL,
    refund_amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    refund_method VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    approved_by_user_id UUID NOT NULL,
    refunded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_refund_tenant_receipt UNIQUE (tenant_id, refund_receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON refund_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_original ON refund_transactions (original_payment_id);

CREATE TABLE IF NOT EXISTS session_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    fee_policy_id UUID NOT NULL REFERENCES fee_policies(id) ON DELETE RESTRICT,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    total_sessions_granted INT NOT NULL,
    sessions_consumed INT NOT NULL DEFAULT 0,
    sessions_remaining INT NOT NULL,
    expires_at DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_packages_student ON session_packages (student_profile_id);

CREATE TABLE IF NOT EXISTS teacher_payout_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    teacher_profile_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    actual_class_session_id UUID REFERENCES actual_class_sessions(id) ON DELETE SET NULL,
    payout_calc_model VARCHAR(50) NOT NULL, -- per_session, revenue_percentage, monthly_fixed
    calculated_amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
    accrual_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, paid, void
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teacher_payout_accruals_teacher ON teacher_payout_accruals (teacher_profile_id);

CREATE TABLE IF NOT EXISTS teacher_payout_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payout_accrual_id UUID NOT NULL REFERENCES teacher_payout_accruals(id) ON DELETE CASCADE,
    payout_receipt_number VARCHAR(100) NOT NULL,
    amount_paid NUMERIC(15, 4) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    authorized_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payout_tenant_receipt UNIQUE (tenant_id, payout_receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_payout_transactions_tenant ON teacher_payout_transactions (tenant_id);
