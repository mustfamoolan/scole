package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrAccrualNotFound       = errors.New("charge accrual not found in this tenant")
	ErrPaymentNotFound       = errors.New("payment transaction not found in this tenant")
	ErrAllocationExceedsDue  = errors.New("allocated amount exceeds remaining due amount on accrual")
	ErrAllocationExceedsPaid = errors.New("sum of allocations exceeds total payment amount")
	ErrRefundExceedsPaid     = errors.New("refund amount exceeds unrefunded payment balance")
	ErrInvalidPayer          = errors.New("payer person not found")
	ErrInvalidPolicy         = errors.New("fee policy not found in this tenant")
	ErrNegativeAmount        = errors.New("financial amounts must be strictly positive")
)

type EducationalFinanceService struct {
	db *gorm.DB
}

func NewEducationalFinanceService(db *gorm.DB) *EducationalFinanceService {
	return &EducationalFinanceService{db: db}
}

type CreateChargeRequest struct {
	StudentProfileID uuid.UUID       `json:"student_profile_id"`
	EnrollmentID     *uuid.UUID      `json:"enrollment_id,omitempty"`
	FeePolicyID      *uuid.UUID      `json:"fee_policy_id,omitempty"`
	ChargeType       string          `json:"charge_type"`
	Description      string          `json:"description"`
	GrossAmount      decimal.Decimal `json:"gross_amount"`
	Currency         string          `json:"currency"`
	DueDate          time.Time       `json:"due_date"`
}

// CreateChargeAccrual posts an official educational fee accrual against a student after verifying all tenant ownership.
func (s *EducationalFinanceService) CreateChargeAccrual(ctx context.Context, tenantID uuid.UUID, req CreateChargeRequest) (*models.ChargeAccrual, error) {
	if req.GrossAmount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrNegativeAmount
	}

	// 1. Verify student profile belongs to tenant
	var student models.StudentProfile
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, req.StudentProfileID).First(&student).Error; err != nil {
		return nil, ErrStudentNotFound
	}

	// 2. If enrollment provided, verify it belongs to tenant
	if req.EnrollmentID != nil {
		var enrollment models.AcademicEnrollment
		if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, *req.EnrollmentID).First(&enrollment).Error; err != nil {
			return nil, ErrEnrollmentNotFound
		}
	}

	// 3. If fee policy provided, verify it belongs to tenant
	if req.FeePolicyID != nil {
		var policy models.FeePolicy
		if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, *req.FeePolicyID).First(&policy).Error; err != nil {
			return nil, ErrInvalidPolicy
		}
	}

	curr := req.Currency
	if curr == "" {
		curr = "IQD"
	}

	accrual := &models.ChargeAccrual{
		ID:               uuid.New(),
		TenantID:         tenantID,
		StudentProfileID: req.StudentProfileID,
		EnrollmentID:     req.EnrollmentID,
		FeePolicyID:      req.FeePolicyID,
		ChargeType:       req.ChargeType,
		Description:      req.Description,
		GrossAmount:      req.GrossAmount,
		DiscountAmount:   decimal.Zero,
		NetDueAmount:     req.GrossAmount,
		PaidAmount:       decimal.Zero,
		Currency:         curr,
		DueDate:          req.DueDate,
		Status:           "unpaid",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(accrual).Error; err != nil {
		return nil, fmt.Errorf("failed to create charge accrual: %w", err)
	}

	return accrual, nil
}

type AllocationItem struct {
	ChargeAccrualID uuid.UUID       `json:"charge_accrual_id"`
	Amount          decimal.Decimal `json:"amount"`
}

type CollectPaymentRequest struct {
	PayerPersonID     uuid.UUID        `json:"payer_person_id"`
	ReceiptNumber     string           `json:"receipt_number"`
	TotalAmount       decimal.Decimal  `json:"total_amount"`
	Currency          string           `json:"currency"`
	PaymentMethod     string           `json:"payment_method"`
	PaymentGatewayRef *string          `json:"payment_gateway_ref,omitempty"`
	CashierUserID     uuid.UUID        `json:"cashier_user_id"`
	Allocations       []AllocationItem `json:"allocations"`
}

// CollectPaymentAndAllocate atomically receives payment and allocates it across student accruals with row-level locking.
func (s *EducationalFinanceService) CollectPaymentAndAllocate(ctx context.Context, tenantID uuid.UUID, req CollectPaymentRequest) (*models.PaymentTransaction, error) {
	if req.TotalAmount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrNegativeAmount
	}

	totalAllocated := decimal.Zero
	for _, item := range req.Allocations {
		if item.Amount.LessThanOrEqual(decimal.Zero) {
			return nil, ErrNegativeAmount
		}
		totalAllocated = totalAllocated.Add(item.Amount)
	}

	if totalAllocated.GreaterThan(req.TotalAmount) {
		return nil, ErrAllocationExceedsPaid
	}

	// Verify payer person exists
	var payer models.Person
	if err := s.db.WithContext(ctx).Where("id = ?", req.PayerPersonID).First(&payer).Error; err != nil {
		return nil, ErrInvalidPayer
	}

	curr := req.Currency
	if curr == "" {
		curr = "IQD"
	}

	var payment *models.PaymentTransaction

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		payment = &models.PaymentTransaction{
			ID:                uuid.New(),
			TenantID:          tenantID,
			PayerPersonID:     req.PayerPersonID,
			ReceiptNumber:     req.ReceiptNumber,
			TotalAmount:       req.TotalAmount,
			AllocatedAmount:   totalAllocated,
			UnallocatedAmount: req.TotalAmount.Sub(totalAllocated),
			Currency:          curr,
			PaymentMethod:     req.PaymentMethod,
			PaymentGatewayRef: req.PaymentGatewayRef,
			PaymentDate:       time.Now(),
			CashierUserID:     req.CashierUserID,
			Status:            "collected",
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}

		if err := tx.Create(payment).Error; err != nil {
			return fmt.Errorf("failed to create payment transaction: %w", err)
		}

		// Process allocations with FOR UPDATE lock on each accrual
		for _, alloc := range req.Allocations {
			var accrual models.ChargeAccrual
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("tenant_id = ? AND id = ?", tenantID, alloc.ChargeAccrualID).
				First(&accrual).Error; err != nil {
				return ErrAccrualNotFound
			}

			remainingDue := accrual.NetDueAmount.Sub(accrual.PaidAmount)
			if alloc.Amount.GreaterThan(remainingDue) {
				return ErrAllocationExceedsDue
			}

			// Create allocation record
			record := models.PaymentAllocation{
				ID:                   uuid.New(),
				TenantID:             tenantID,
				PaymentTransactionID: payment.ID,
				ChargeAccrualID:      accrual.ID,
				AllocatedAmount:      alloc.Amount,
				AllocatedAt:          time.Now(),
				AllocatedByUserID:    req.CashierUserID,
			}
			if err := tx.Create(&record).Error; err != nil {
				return fmt.Errorf("failed to create payment allocation: %w", err)
			}

			// Update accrual paid_amount and status atomically
			newPaid := accrual.PaidAmount.Add(alloc.Amount)
			newStatus := "partially_paid"
			if newPaid.GreaterThanOrEqual(accrual.NetDueAmount) {
				newStatus = "paid"
			}

			if err := tx.Model(&accrual).Updates(map[string]interface{}{
				"paid_amount": newPaid,
				"status":      newStatus,
				"updated_at":  time.Now(),
			}).Error; err != nil {
				return fmt.Errorf("failed to update charge accrual: %w", err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return payment, nil
}

type ProcessRefundRequest struct {
	OriginalPaymentID   uuid.UUID       `json:"original_payment_id"`
	ChargeAccrualID     *uuid.UUID      `json:"charge_accrual_id,omitempty"`
	RefundReceiptNumber string          `json:"refund_receipt_number"`
	RefundAmount        decimal.Decimal `json:"refund_amount"`
	Currency            string          `json:"currency"`
	RefundMethod        string          `json:"refund_method"`
	Reason              string          `json:"reason"`
	ApprovedByUserID    uuid.UUID       `json:"approved_by_user_id"`
}

// ProcessRefund processes a partial or full refund with row locking and cumulative refund cap verification.
func (s *EducationalFinanceService) ProcessRefund(ctx context.Context, tenantID uuid.UUID, req ProcessRefundRequest) (*models.RefundTransaction, error) {
	if req.RefundAmount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrNegativeAmount
	}

	var refund *models.RefundTransaction

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Lock payment row with FOR UPDATE
		var payment models.PaymentTransaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("tenant_id = ? AND id = ?", tenantID, req.OriginalPaymentID).
			First(&payment).Error; err != nil {
			return ErrPaymentNotFound
		}

		// 2. Query cumulative existing refunds for this payment
		var existingRefunds []models.RefundTransaction
		if err := tx.Where("tenant_id = ? AND original_payment_id = ?", tenantID, req.OriginalPaymentID).
			Find(&existingRefunds).Error; err != nil {
			return fmt.Errorf("failed to calculate existing refunds: %w", err)
		}

		totalAlreadyRefunded := decimal.Zero
		for _, r := range existingRefunds {
			totalAlreadyRefunded = totalAlreadyRefunded.Add(r.RefundAmount)
		}

		availableToRefund := payment.TotalAmount.Sub(totalAlreadyRefunded)
		if req.RefundAmount.GreaterThan(availableToRefund) {
			return ErrRefundExceedsPaid
		}

		// 3. Verify ChargeAccrual if specified
		if req.ChargeAccrualID != nil {
			var accrual models.ChargeAccrual
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("tenant_id = ? AND id = ?", tenantID, *req.ChargeAccrualID).
				First(&accrual).Error; err != nil {
				return ErrAccrualNotFound
			}

			adjustedPaid := accrual.PaidAmount.Sub(req.RefundAmount)
			if adjustedPaid.LessThan(decimal.Zero) {
				adjustedPaid = decimal.Zero
			}
			accrualStatus := "partially_paid"
			if adjustedPaid.IsZero() {
				accrualStatus = "unpaid"
			}
			if err := tx.Model(&accrual).Updates(map[string]interface{}{
				"paid_amount": adjustedPaid,
				"status":      accrualStatus,
				"updated_at":  time.Now(),
			}).Error; err != nil {
				return fmt.Errorf("failed to adjust charge accrual paid amount: %w", err)
			}
		}

		curr := req.Currency
		if curr == "" {
			curr = payment.Currency
		}

		refund = &models.RefundTransaction{
			ID:                  uuid.New(),
			TenantID:            tenantID,
			OriginalPaymentID:   req.OriginalPaymentID,
			ChargeAccrualID:     req.ChargeAccrualID,
			RefundReceiptNumber: req.RefundReceiptNumber,
			RefundAmount:        req.RefundAmount,
			Currency:            curr,
			RefundMethod:        req.RefundMethod,
			Reason:              req.Reason,
			ApprovedByUserID:    req.ApprovedByUserID,
			RefundedAt:          time.Now(),
		}

		if err := tx.Create(refund).Error; err != nil {
			return fmt.Errorf("failed to create refund transaction: %w", err)
		}

		// 4. Update payment status accurately based on cumulative refunded amount
		newTotalRefunded := totalAlreadyRefunded.Add(req.RefundAmount)
		newStatus := "partially_refunded"
		if newTotalRefunded.GreaterThanOrEqual(payment.TotalAmount) {
			newStatus = "refunded"
		}

		if err := tx.Model(&payment).Updates(map[string]interface{}{
			"status":     newStatus,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("failed to update payment status: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return refund, nil
}
