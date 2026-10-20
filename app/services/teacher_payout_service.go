package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrPayoutAccrualNotFound       = errors.New("teacher payout accrual not found")
	ErrAccrualAlreadyApproved = errors.New("payout accrual is already approved or processed")
	ErrAccrualNotApproved     = errors.New("payout accrual must be approved before disbursement")
	ErrAccrualAlreadyPaid     = errors.New("payout accrual has already been fully paid and closed")
	ErrCannotVoidPaidAccrual  = errors.New("cannot void a payout accrual that has already been paid")
	ErrInvalidPayoutAmount   = errors.New("payout amount must be positive and equal to or less than accrual balance")
)

type TeacherPayoutService struct {
	db *gorm.DB
}

func NewTeacherPayoutService(db *gorm.DB) *TeacherPayoutService {
	return &TeacherPayoutService{db: db}
}

// ApprovePayoutAccrual transitions a pending accrual to approved state.
func (s *TeacherPayoutService) ApprovePayoutAccrual(ctx context.Context, tenantID, accrualID, approvedByUserID uuid.UUID) (*models.TeacherPayoutAccrual, error) {
	var accrual models.TeacherPayoutAccrual

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&accrual, "id = ? AND tenant_id = ?", accrualID, tenantID).Error; err != nil {
			return ErrPayoutAccrualNotFound
		}

		if accrual.Status != "pending" {
			return ErrAccrualAlreadyApproved
		}

		accrual.Status = "approved"
		accrual.UpdatedAt = time.Now()

		return tx.Save(&accrual).Error
	})

	if err != nil {
		return nil, err
	}

	return &accrual, nil
}

// ExecutePayoutRequest holds payment method and execution parameters.
type ExecutePayoutRequest struct {
	PaymentMethod string           `json:"payment_method"` // cash, zain_cash, bank_transfer, cheque
	AmountPaid    *decimal.Decimal `json:"amount_paid,omitempty"`
}

// ExecutePayout disburses approved payout with row-level locking to prevent concurrent double-spend.
func (s *TeacherPayoutService) ExecutePayout(ctx context.Context, tenantID, accrualID, authorizedByUserID uuid.UUID, req ExecutePayoutRequest) (*models.TeacherPayoutTransaction, error) {
	payMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if payMethod == "" {
		payMethod = "cash"
	}

	var transaction models.TeacherPayoutTransaction

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Row-level lock to prevent concurrent double disbursement
		var accrual models.TeacherPayoutAccrual
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&accrual, "id = ? AND tenant_id = ?", accrualID, tenantID).Error; err != nil {
			return ErrPayoutAccrualNotFound
		}

		// 2. Validate Status
		if accrual.Status == "paid" {
			return ErrAccrualAlreadyPaid
		}
		if accrual.Status == "void" {
			return errors.New("cannot pay a voided payout accrual")
		}
		if accrual.Status != "approved" {
			return ErrAccrualNotApproved
		}

		// 3. Amount verification
		amountToPay := accrual.CalculatedAmount
		if req.AmountPaid != nil {
			if req.AmountPaid.IsNegative() || req.AmountPaid.IsZero() || req.AmountPaid.GreaterThan(accrual.CalculatedAmount) {
				return ErrInvalidPayoutAmount
			}
			amountToPay = *req.AmountPaid
		}

		// 4. Generate unique receipt number
		receiptNumber := fmt.Sprintf("PAY-%s-%s", time.Now().Format("20060102"), strings.ToUpper(uuid.New().String()[:8]))

		// 5. Create Payout Transaction
		transaction = models.TeacherPayoutTransaction{
			TenantID:            tenantID,
			PayoutAccrualID:     accrual.ID,
			PayoutReceiptNumber: receiptNumber,
			AmountPaid:          amountToPay,
			PaymentMethod:       payMethod,
			PaidAt:              time.Now(),
			AuthorizedByUserID:  authorizedByUserID,
		}

		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("failed to create payout transaction: %w", err)
		}

		// 6. Close Accrual
		accrual.Status = "paid"
		accrual.UpdatedAt = time.Now()
		if err := tx.Save(&accrual).Error; err != nil {
			return fmt.Errorf("failed to close payout accrual: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &transaction, nil
}

// VoidPayoutAccrual voids an unclosed payout accrual.
func (s *TeacherPayoutService) VoidPayoutAccrual(ctx context.Context, tenantID, accrualID, authorizedByUserID uuid.UUID, reason string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var accrual models.TeacherPayoutAccrual
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&accrual, "id = ? AND tenant_id = ?", accrualID, tenantID).Error; err != nil {
			return ErrPayoutAccrualNotFound
		}

		if accrual.Status == "paid" {
			return ErrCannotVoidPaidAccrual
		}

		accrual.Status = "void"
		accrual.UpdatedAt = time.Now()

		return tx.Save(&accrual).Error
	})
}

// ListTeacherAccruals lists payout accruals for a specific teacher.
func (s *TeacherPayoutService) ListTeacherAccruals(ctx context.Context, tenantID, teacherProfileID uuid.UUID, status string) ([]models.TeacherPayoutAccrual, error) {
	var list []models.TeacherPayoutAccrual
	query := s.db.WithContext(ctx).Where("tenant_id = ? AND teacher_profile_id = ?", tenantID, teacherProfileID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("accrual_date DESC, created_at DESC").Find(&list).Error
	return list, err
}

// ListTeacherTransactions lists disbursement receipts for a specific teacher.
func (s *TeacherPayoutService) ListTeacherTransactions(ctx context.Context, tenantID, teacherProfileID uuid.UUID) ([]models.TeacherPayoutTransaction, error) {
	var list []models.TeacherPayoutTransaction
	err := s.db.WithContext(ctx).
		Joins("JOIN teacher_payout_accruals ON teacher_payout_accruals.id = teacher_payout_transactions.payout_accrual_id").
		Where("teacher_payout_transactions.tenant_id = ? AND teacher_payout_accruals.teacher_profile_id = ?", tenantID, teacherProfileID).
		Order("teacher_payout_transactions.paid_at DESC").
		Find(&list).Error
	return list, err
}
