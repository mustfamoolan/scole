-- 20261015000001_create_billing_tables.up.sql
-- Create plans, subscriptions, and payment receipts tables for SaaS billing
-- All monetary amounts are in whole Iraqi Dinars (IQD) as BIGINT without decimals/fils

-- 1. Plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    price_iqd BIGINT NOT NULL CHECK (price_iqd >= 0),
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    max_students INT NOT NULL DEFAULT 100 CHECK (max_students >= 0),
    max_teachers INT NOT NULL DEFAULT 10 CHECK (max_teachers >= 0),
    max_branches INT NOT NULL DEFAULT 1 CHECK (max_branches >= 1),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_url VARCHAR(255) DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans (is_active) WHERE deleted_at IS NULL;

-- 2. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_ends_at ON subscriptions (ends_at) WHERE deleted_at IS NULL;

-- 3. Payment receipts table (manual payment ledger)
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    receipt_number VARCHAR(64) NOT NULL UNIQUE,
    amount_iqd BIGINT NOT NULL CHECK (amount_iqd > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IQD' CHECK (currency = 'IQD'),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'manual_receipt', 'cheque', 'other')),
    reference_note TEXT,
    recorded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant ON payment_receipts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_receipts_recorded_by ON payment_receipts (recorded_by_user_id) WHERE deleted_at IS NULL;
