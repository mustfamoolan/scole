package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// FeePolicy defines institutional fee structures for grade levels, courses, or services.
type FeePolicy struct {
	ID               uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Name             string          `gorm:"type:varchar(150);not null" json:"name"`
	TargetEntityType string          `gorm:"type:varchar(50);not null" json:"target_entity_type"` // grade, program, cohort, transportation, registration
	TargetEntityID   *uuid.UUID      `gorm:"type:uuid;index" json:"target_entity_id,omitempty"`
	BaseAmount       decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"base_amount"`
	Currency         string          `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	BillingFrequency string          `gorm:"type:varchar(50);not null;default:'one_time'" json:"billing_frequency"` // one_time, monthly, termly, annual
	IsActive         bool            `gorm:"not null;default:true" json:"is_active"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        gorm.DeletedAt  `gorm:"index" json:"-"`
}

func (FeePolicy) TableName() string {
	return "fee_policies"
}

// ChargeAccrual represents a legally recognized financial claim/receivable against a student or guardian.
type ChargeAccrual struct {
	ID               uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID uuid.UUID       `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	EnrollmentID     *uuid.UUID      `gorm:"type:uuid;index" json:"enrollment_id,omitempty"`
	FeePolicyID      *uuid.UUID      `gorm:"type:uuid;index" json:"fee_policy_id,omitempty"`
	ChargeType       string          `gorm:"type:varchar(50);not null" json:"charge_type"` // tuition_installment, course_fee, bus_fee, book_fee
	Description      string          `gorm:"type:varchar(255);not null" json:"description"`
	GrossAmount      decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"gross_amount"`
	DiscountAmount   decimal.Decimal `gorm:"type:numeric(15,4);not null;default:0.0000" json:"discount_amount"`
	NetDueAmount     decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"net_due_amount"`
	PaidAmount       decimal.Decimal `gorm:"type:numeric(15,4);not null;default:0.0000" json:"paid_amount"`
	Currency         string          `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	DueDate          time.Time       `gorm:"not null;index" json:"due_date"`
	Status           string          `gorm:"type:varchar(50);not null;default:'unpaid';index" json:"status"` // unpaid, partially_paid, paid, void, written_off
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`

	StudentProfile StudentProfile        `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
	FeePolicy      *FeePolicy            `gorm:"foreignKey:FeePolicyID" json:"fee_policy,omitempty"`
	Discounts      []ScholarshipDiscount `gorm:"foreignKey:ChargeAccrualID" json:"discounts,omitempty"`
	Allocations    []PaymentAllocation   `gorm:"foreignKey:ChargeAccrualID" json:"allocations,omitempty"`
}

func (ChargeAccrual) TableName() string {
	return "charge_accruals"
}

// ScholarshipDiscount represents an authorized financial discount, waiver, or scholarship applied to an accrual.
type ScholarshipDiscount struct {
	ID                  uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	ChargeAccrualID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"charge_accrual_id"`
	DiscountType        string          `gorm:"type:varchar(50);not null" json:"discount_type"` // percentage, fixed_amount, sibling_discount, staff_child, merit_scholarship
	DiscountValue       decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"discount_value"`
	CalculatedReduction decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"calculated_reduction"`
	Justification       string          `gorm:"type:varchar(255);not null" json:"justification"`
	ApprovedByUserID    uuid.UUID       `gorm:"type:uuid;not null" json:"approved_by_user_id"`
	AppliedAt           time.Time       `gorm:"not null" json:"applied_at"`
}

func (ScholarshipDiscount) TableName() string {
	return "scholarship_discounts"
}

// PaymentTransaction captures verified incoming funds received into a cash register or merchant account.
type PaymentTransaction struct {
	ID                uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID          uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	PayerPersonID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"payer_person_id"`
	ReceiptNumber     string          `gorm:"type:varchar(100);not null;index:idx_payment_receipt,unique" json:"receipt_number"`
	TotalAmount       decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"total_amount"`
	AllocatedAmount   decimal.Decimal `gorm:"type:numeric(15,4);not null;default:0.0000" json:"allocated_amount"`
	UnallocatedAmount decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"unallocated_amount"`
	Currency          string          `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	PaymentMethod     string          `gorm:"type:varchar(50);not null" json:"payment_method"` // cash, zain_cash, qi_card, bank_transfer, pos
	PaymentGatewayRef *string         `gorm:"type:varchar(150)" json:"payment_gateway_ref,omitempty"`
	PaymentDate       time.Time       `gorm:"not null;index" json:"payment_date"`
	CashierUserID     uuid.UUID       `gorm:"type:uuid;not null" json:"cashier_user_id"`
	Status            string          `gorm:"type:varchar(50);not null;default:'collected';index" json:"status"` // collected, refunded, partially_refunded, void
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`

	PayerPerson Person              `gorm:"foreignKey:PayerPersonID" json:"payer_person,omitempty"`
	Allocations []PaymentAllocation `gorm:"foreignKey:PaymentTransactionID" json:"allocations,omitempty"`
}

func (PaymentTransaction) TableName() string {
	return "payment_transactions"
}

// PaymentAllocation explicitly maps money received in a payment transaction to one specific charge accrual.
type PaymentAllocation struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	PaymentTransactionID uuid.UUID       `gorm:"type:uuid;not null;index" json:"payment_transaction_id"`
	ChargeAccrualID      uuid.UUID       `gorm:"type:uuid;not null;index" json:"charge_accrual_id"`
	AllocatedAmount      decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"allocated_amount"`
	AllocatedAt          time.Time       `gorm:"not null" json:"allocated_at"`
	AllocatedByUserID    uuid.UUID       `gorm:"type:uuid;not null" json:"allocated_by_user_id"`
}

func (PaymentAllocation) TableName() string {
	return "payment_allocations"
}

// RefundTransaction models money returned to a payer with strict backward pointer to the original payment.
type RefundTransaction struct {
	ID                  uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	OriginalPaymentID   uuid.UUID       `gorm:"type:uuid;not null;index" json:"original_payment_id"`
	ChargeAccrualID     *uuid.UUID      `gorm:"type:uuid;index" json:"charge_accrual_id,omitempty"`
	RefundReceiptNumber string          `gorm:"type:varchar(100);not null;index:idx_refund_receipt,unique" json:"refund_receipt_number"`
	RefundAmount        decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"refund_amount"`
	Currency            string          `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	RefundMethod        string          `gorm:"type:varchar(50);not null" json:"refund_method"`
	Reason              string          `gorm:"type:text;not null" json:"reason"`
	ApprovedByUserID    uuid.UUID       `gorm:"type:uuid;not null" json:"approved_by_user_id"`
	RefundedAt          time.Time       `gorm:"not null" json:"refunded_at"`
}

func (RefundTransaction) TableName() string {
	return "refund_transactions"
}

// SessionPackage models prepaid packs of teaching/coaching sessions (Scenario 9/Private Tutors).
type SessionPackage struct {
	ID                   uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	FeePolicyID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"fee_policy_id"`
	PaymentTransactionID *uuid.UUID `gorm:"type:uuid;index" json:"payment_transaction_id,omitempty"`
	TotalSessionsGranted int        `gorm:"not null" json:"total_sessions_granted"`
	SessionsConsumed     int        `gorm:"not null;default:0" json:"sessions_consumed"`
	SessionsRemaining    int        `gorm:"not null" json:"sessions_remaining"`
	ExpiresAt            *time.Time `json:"expires_at,omitempty"`
	Status               string     `gorm:"type:varchar(50);not null;default:'active'" json:"status"` // active, fully_consumed, expired
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (SessionPackage) TableName() string {
	return "session_packages"
}

// TeacherPayoutAccrual tracks compensation earned by an instructor per session, percentage, or contract.
type TeacherPayoutAccrual struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID       `gorm:"type:uuid;not null;index" json:"tenant_id"`
	TeacherProfileID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"teacher_profile_id"`
	ActualClassSessionID *uuid.UUID      `gorm:"type:uuid;index" json:"actual_class_session_id,omitempty"`
	PayoutCalcModel      string          `gorm:"type:varchar(50);not null" json:"payout_calc_model"` // per_session, revenue_percentage, monthly_fixed
	CalculatedAmount     decimal.Decimal `gorm:"type:numeric(15,4);not null" json:"calculated_amount"`
	Currency             string          `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	AccrualDate          time.Time       `gorm:"not null" json:"accrual_date"`
	Status               string          `gorm:"type:varchar(50);not null;default:'pending'" json:"status"` // pending, approved, paid, void
	PayrollLineID        *uuid.UUID      `gorm:"type:uuid;index" json:"payroll_line_id,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`

	TeacherProfile TeacherProfile `gorm:"foreignKey:TeacherProfileID" json:"teacher_profile,omitempty"`
}

func (TeacherPayoutAccrual) TableName() string {
	return "teacher_payout_accruals"
}

// TeacherPayoutTransaction captures the actual payout execution to the teacher.
type TeacherPayoutTransaction struct {
	ID                  uuid.UUID            `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID            `gorm:"type:uuid;not null;index" json:"tenant_id"`
	PayoutAccrualID     uuid.UUID            `gorm:"type:uuid;not null;index" json:"payout_accrual_id"`
	PayoutReceiptNumber string               `gorm:"type:varchar(100);not null;index:idx_payout_receipt,unique" json:"payout_receipt_number"`
	AmountPaid          decimal.Decimal      `gorm:"type:numeric(15,4);not null" json:"amount_paid"`
	PaymentMethod       string               `gorm:"type:varchar(50);not null" json:"payment_method"`
	PaidAt              time.Time            `gorm:"not null" json:"paid_at"`
	AuthorizedByUserID  uuid.UUID            `gorm:"type:uuid;not null" json:"authorized_by_user_id"`
	CreatedAt           time.Time            `json:"created_at"`

	PayoutAccrual TeacherPayoutAccrual `gorm:"foreignKey:PayoutAccrualID" json:"payout_accrual,omitempty"`
}

func (TeacherPayoutTransaction) TableName() string {
	return "teacher_payout_transactions"
}
