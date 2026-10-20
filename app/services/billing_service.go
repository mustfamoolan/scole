package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var (
	ErrInvalidBillingCycle = errors.New("invalid billing cycle; must be monthly, quarterly, or yearly")
	ErrInvalidPaymentMethod = errors.New("invalid payment method; must be cash, bank_transfer, manual_receipt, cheque, or other")
)

// CreatePlanRequest defines parameters for creating a subscription plan.
type CreatePlanRequest struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Description  string `json:"description"`
	PriceIQD     int64  `json:"price_iqd"` // Strictly whole Iraqi Dinars (no fils)
	BillingCycle string `json:"billing_cycle"`
	MaxStudents  int    `json:"max_students"`
	MaxTeachers  int    `json:"max_teachers"`
	MaxBranches  int    `json:"max_branches"`
	Features     string `json:"features,omitempty"`
	ImageURL     string `json:"image_url,omitempty"`
}

// UpdatePlanRequest defines parameters for updating an existing plan.
type UpdatePlanRequest struct {
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	PriceIQD     *int64  `json:"price_iqd,omitempty"`
	BillingCycle string  `json:"billing_cycle,omitempty"`
	MaxStudents  *int    `json:"max_students,omitempty"`
	MaxTeachers  *int    `json:"max_teachers,omitempty"`
	MaxBranches  *int    `json:"max_branches,omitempty"`
	Features     string  `json:"features,omitempty"`
	ImageURL     *string `json:"image_url,omitempty"`
	IsActive     *bool   `json:"is_active,omitempty"`
}

// RecordPaymentRequest defines parameters for adding a manual receipt to the ledger.
type RecordPaymentRequest struct {
	SubscriptionID *uuid.UUID `json:"subscription_id,omitempty"`
	AmountIQD      int64      `json:"amount_iqd"` // Strictly whole Iraqi Dinars (no fils)
	PaymentMethod  string     `json:"payment_method"`
	ReferenceNote  string     `json:"reference_note,omitempty"`
}

// BillingService coordinates plans, subscriptions, limit enforcement, and financial ledgering.
type BillingService struct {
	db          *gorm.DB
	planRepo    repositories.PlanRepository
	subRepo     repositories.SubscriptionRepository
	receiptRepo repositories.PaymentReceiptRepository
	tenantRepo  repositories.TenantRepository
	auditService AuditService
}

// NewBillingService creates a new BillingService.
func NewBillingService(
	db *gorm.DB,
	p repositories.PlanRepository,
	s repositories.SubscriptionRepository,
	r repositories.PaymentReceiptRepository,
	t repositories.TenantRepository,
) *BillingService {
	return &BillingService{
		db:          db,
		planRepo:    p,
		subRepo:     s,
		receiptRepo: r,
		tenantRepo:  t,
	}
}

// SetAuditService sets the audit logger.
func (s *BillingService) SetAuditService(audit AuditService) {
	s.auditService = audit
}

// generateReceiptNumber produces a unique, auditable sequential receipt identifier.
func generateReceiptNumber() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return fmt.Sprintf("RCP-%s-%s", time.Now().Format("20060102"), strings.ToUpper(hex.EncodeToString(b)))
}

// CreatePlan adds a new pricing tier with whole Iraqi Dinars pricing.
func (s *BillingService) CreatePlan(ctx context.Context, req CreatePlanRequest) (*models.Plan, error) {
	normSlug := models.NormalizeSlug(req.Slug)
	if normSlug == "" {
		return nil, models.ErrInvalidPlanSlug
	}
	if req.PriceIQD < 0 {
		return nil, models.ErrInvalidPlanPrice
	}

	cycle := strings.ToLower(strings.TrimSpace(req.BillingCycle))
	if cycle == "" {
		cycle = models.BillingCycleMonthly
	}
	if cycle != models.BillingCycleMonthly && cycle != models.BillingCycleQuarterly && cycle != models.BillingCycleYearly {
		return nil, ErrInvalidBillingCycle
	}

	features := req.Features
	if strings.TrimSpace(features) == "" {
		features = "{}"
	}

	plan := &models.Plan{
		Name:         strings.TrimSpace(req.Name),
		Slug:         normSlug,
		Description:  strings.TrimSpace(req.Description),
		PriceIQD:     req.PriceIQD,
		BillingCycle: cycle,
		MaxStudents:  req.MaxStudents,
		MaxTeachers:  req.MaxTeachers,
		MaxBranches:  req.MaxBranches,
		Features:     features,
		ImageURL:     strings.TrimSpace(req.ImageURL),
		IsActive:     true,
	}

	if err := s.planRepo.Create(ctx, plan); err != nil {
		zap.L().Error("Failed to create plan", zap.Error(err), zap.String("slug", normSlug))
		return nil, err
	}

	return plan, nil
}

// ListActivePlans returns active public plans.
func (s *BillingService) ListActivePlans(ctx context.Context) ([]models.Plan, error) {
	return s.planRepo.ListActive(ctx)
}

// ListAllPlans returns paginated plans for platform administrators.
func (s *BillingService) ListAllPlans(ctx context.Context, page, limit int) ([]models.Plan, int64, error) {
	return s.planRepo.ListAll(ctx, page, limit)
}

// UpdatePlan updates an existing pricing plan and limits.
func (s *BillingService) UpdatePlan(ctx context.Context, planID uuid.UUID, req UpdatePlanRequest) (*models.Plan, error) {
	plan, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) != "" {
		plan.Name = strings.TrimSpace(req.Name)
	}
	if req.Description != "" {
		plan.Description = strings.TrimSpace(req.Description)
	}
	if req.PriceIQD != nil {
		if *req.PriceIQD < 0 {
			return nil, models.ErrInvalidPlanPrice
		}
		plan.PriceIQD = *req.PriceIQD
	}
	if req.BillingCycle != "" {
		cycle := strings.ToLower(strings.TrimSpace(req.BillingCycle))
		if cycle != models.BillingCycleMonthly && cycle != models.BillingCycleQuarterly && cycle != models.BillingCycleYearly {
			return nil, ErrInvalidBillingCycle
		}
		plan.BillingCycle = cycle
	}
	if req.MaxStudents != nil {
		plan.MaxStudents = *req.MaxStudents
	}
	if req.MaxTeachers != nil {
		plan.MaxTeachers = *req.MaxTeachers
	}
	if req.MaxBranches != nil {
		plan.MaxBranches = *req.MaxBranches
	}
	if req.Features != "" {
		plan.Features = req.Features
	}
	if req.ImageURL != nil {
		plan.ImageURL = strings.TrimSpace(*req.ImageURL)
	}
	if req.IsActive != nil {
		plan.IsActive = *req.IsActive
	}

	if err := s.planRepo.Update(ctx, plan); err != nil {
		return nil, err
	}

	return plan, nil
}

// DeletePlan removes a plan by ID.
func (s *BillingService) DeletePlan(ctx context.Context, planID uuid.UUID) error {
	_, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return err
	}
	return s.planRepo.Delete(ctx, planID)
}

// TogglePlanStatus flips the IsActive state of a plan.
func (s *BillingService) TogglePlanStatus(ctx context.Context, planID uuid.UUID) (*models.Plan, error) {
	plan, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return nil, err
	}
	plan.IsActive = !plan.IsActive
	if err := s.planRepo.Update(ctx, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

// ListAllSubscriptions returns paginated subscriptions across all tenants for Platform Admin.
func (s *BillingService) ListAllSubscriptions(ctx context.Context, page, limit int) ([]models.Subscription, int64, error) {
	return s.subRepo.ListAll(ctx, page, limit)
}

// CreateSubscription provisions or updates an institute subscription.
func (s *BillingService) CreateSubscription(ctx context.Context, tenantID, planID uuid.UUID, durationDays int) (*models.Subscription, error) {
	if durationDays <= 0 {
		durationDays = 30
	}

	plan, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant.Status == models.TenantStatusSuspended || tenant.Status == models.TenantStatusArchived {
		return nil, models.ErrTenantSuspended
	}

	startsAt := time.Now().UTC()
	endsAt := startsAt.AddDate(0, 0, durationDays)

	sub := &models.Subscription{
		TenantID:  tenantID,
		PlanID:    planID,
		Status:    models.SubscriptionStatusActive,
		StartsAt:  startsAt,
		EndsAt:    endsAt,
		AutoRenew: false,
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Deactivate any existing active subscriptions for this tenant
		tx.Model(&models.Subscription{}).
			Where("tenant_id = ? AND status = ?", tenantID, models.SubscriptionStatusActive).
			Update("status", models.SubscriptionStatusExpired)

		return tx.Create(sub).Error
	})

	if err != nil {
		return nil, err
	}

	sub.Plan = plan
	zap.L().Info("Subscription created successfully",
		zap.String("tenant_id", tenantID.String()),
		zap.String("plan_id", planID.String()),
		zap.Time("ends_at", endsAt),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &tenantID, nil, "platform_admin", models.ActionSubscriptionCreated, "subscription", sub.ID.String(), map[string]interface{}{
			"plan_id":   plan.ID.String(),
			"plan_name": plan.Name,
		}, "", "")
	}

	return sub, nil
}

// CreateTrialSubscription provisions a trial subscription for an onboarding institute.
func (s *BillingService) CreateTrialSubscription(ctx context.Context, tenantID, planID uuid.UUID, trialDays int) (*models.Subscription, error) {
	if trialDays <= 0 {
		trialDays = 14
	}

	plan, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant.Status == models.TenantStatusSuspended || tenant.Status == models.TenantStatusArchived {
		return nil, models.ErrTenantSuspended
	}

	startsAt := time.Now().UTC()
	endsAt := startsAt.AddDate(0, 0, trialDays)

	sub := &models.Subscription{
		TenantID:    tenantID,
		PlanID:      planID,
		Status:      models.SubscriptionStatusTrialing,
		StartsAt:    startsAt,
		EndsAt:      endsAt,
		TrialEndsAt: &endsAt,
		AutoRenew:   false,
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tx.Model(&models.Subscription{}).
			Where("tenant_id = ? AND status IN (?, ?)", tenantID, models.SubscriptionStatusActive, models.SubscriptionStatusTrialing).
			Update("status", models.SubscriptionStatusExpired)

		return tx.Create(sub).Error
	})
	if err != nil {
		return nil, err
	}

	sub.Plan = plan
	zap.L().Info("Trial subscription created successfully",
		zap.String("tenant_id", tenantID.String()),
		zap.String("plan_id", planID.String()),
		zap.Time("trial_ends_at", endsAt),
	)

	return sub, nil
}

// ActivateSubscription upgrades a trialing subscription to officially active.
func (s *BillingService) ActivateSubscription(ctx context.Context, subscriptionID uuid.UUID, extensionDays int) (*models.Subscription, error) {
	if extensionDays <= 0 {
		extensionDays = 30
	}

	sub, err := s.subRepo.FindByID(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	sub.Status = models.SubscriptionStatusActive
	sub.StartsAt = now
	sub.EndsAt = now.AddDate(0, 0, extensionDays)

	if err := s.subRepo.Update(ctx, sub); err != nil {
		return nil, err
	}

	zap.L().Info("Subscription officially activated by platform admin",
		zap.String("subscription_id", subscriptionID.String()),
		zap.Time("new_ends_at", sub.EndsAt),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &sub.TenantID, nil, "platform_admin", models.ActionSubscriptionRenewed, "subscription", sub.ID.String(), map[string]interface{}{
			"status":         models.SubscriptionStatusActive,
			"extension_days": extensionDays,
		}, "", "")
	}

	return sub, nil
}

// RenewSubscription extends an active or expired subscription period.
func (s *BillingService) RenewSubscription(ctx context.Context, subscriptionID uuid.UUID, extensionDays int) (*models.Subscription, error) {
	if extensionDays <= 0 {
		extensionDays = 30
	}

	sub, err := s.subRepo.FindByID(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if sub.EndsAt.Before(now) {
		sub.EndsAt = now.AddDate(0, 0, extensionDays)
	} else {
		sub.EndsAt = sub.EndsAt.AddDate(0, 0, extensionDays)
	}
	sub.Status = models.SubscriptionStatusActive

	if err := s.subRepo.Update(ctx, sub); err != nil {
		return nil, err
	}

	zap.L().Info("Subscription renewed successfully",
		zap.String("subscription_id", subscriptionID.String()),
		zap.Time("new_ends_at", sub.EndsAt),
	)

	return sub, nil
}

// ChangePlan upgrades or changes an institute's plan immediately.
func (s *BillingService) ChangePlan(ctx context.Context, tenantID, newPlanID uuid.UUID) (*models.Subscription, error) {
	newPlan, err := s.planRepo.FindByID(ctx, newPlanID)
	if err != nil {
		return nil, err
	}

	currentSub, err := s.subRepo.FindActiveByTenant(ctx, tenantID)
	if err != nil {
		// No active subscription, create new
		return s.CreateSubscription(ctx, tenantID, newPlanID, 30)
	}

	currentSub.PlanID = newPlanID
	currentSub.Plan = newPlan
	if err := s.subRepo.Update(ctx, currentSub); err != nil {
		return nil, err
	}

	return currentSub, nil
}

// ChangePlanBySubscription upgrades or changes a subscription by its subscription ID.
func (s *BillingService) ChangePlanBySubscription(ctx context.Context, subID, newPlanID uuid.UUID) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(ctx, subID)
	if err != nil {
		return nil, err
	}
	return s.ChangePlan(ctx, sub.TenantID, newPlanID)
}

// CancelSubscription marks an active subscription as canceled without removing data.
func (s *BillingService) CancelSubscription(ctx context.Context, subscriptionID uuid.UUID) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	sub.Status = models.SubscriptionStatusCanceled
	sub.CanceledAt = &now

	if err := s.subRepo.Update(ctx, sub); err != nil {
		return nil, err
	}

	return sub, nil
}

// GetActiveSubscription returns the active entitlement for a tenant.
func (s *BillingService) GetActiveSubscription(ctx context.Context, tenantID uuid.UUID) (*models.Subscription, error) {
	return s.subRepo.FindActiveByTenant(ctx, tenantID)
}

// ListTenantSubscriptions returns the subscription history for an institute.
func (s *BillingService) ListTenantSubscriptions(ctx context.Context, tenantID uuid.UUID) ([]models.Subscription, error) {
	return s.subRepo.ListByTenant(ctx, tenantID)
}

// CheckLimit enforces plan quota limits on the server side.
func (s *BillingService) CheckLimit(ctx context.Context, tenantID uuid.UUID, resourceType string, currentCount int) error {
	sub, err := s.subRepo.FindActiveByTenant(ctx, tenantID)
	if err != nil {
		return models.ErrSubscriptionExpired
	}

	if !sub.IsActive() {
		return models.ErrSubscriptionExpired
	}

	plan := sub.Plan
	if plan == nil {
		p, err := s.planRepo.FindByID(ctx, sub.PlanID)
		if err != nil {
			return err
		}
		plan = p
	}

	switch strings.ToLower(strings.TrimSpace(resourceType)) {
	case "students":
		if plan.MaxStudents > 0 && currentCount >= plan.MaxStudents {
			return models.ErrLimitExceeded
		}
	case "teachers":
		if plan.MaxTeachers > 0 && currentCount >= plan.MaxTeachers {
			return models.ErrLimitExceeded
		}
	case "branches":
		if plan.MaxBranches > 0 && currentCount >= plan.MaxBranches {
			return models.ErrLimitExceeded
		}
	}

	return nil
}

// RecordManualPayment logs an immutable financial payment entry in whole Iraqi Dinars (IQD).
func (s *BillingService) RecordManualPayment(ctx context.Context, tenantID uuid.UUID, recordedBy uuid.UUID, req RecordPaymentRequest) (*models.PaymentReceipt, error) {
	if req.AmountIQD <= 0 {
		return nil, models.ErrInvalidPaymentAmount
	}

	method := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	switch method {
	case "cash", "bank_transfer", "manual_receipt", "cheque", "other":
		// Valid
	default:
		return nil, ErrInvalidPaymentMethod
	}

	// Verify tenant exists
	if _, err := s.tenantRepo.FindByID(ctx, tenantID); err != nil {
		return nil, err
	}

	receipt := &models.PaymentReceipt{
		TenantID:         tenantID,
		SubscriptionID:   req.SubscriptionID,
		ReceiptNumber:    generateReceiptNumber(),
		AmountIQD:        req.AmountIQD,
		Currency:         "IQD", // Strictly Iraqi Dinars without fils
		PaymentMethod:    method,
		ReferenceNote:    strings.TrimSpace(req.ReferenceNote),
		RecordedByUserID: recordedBy,
		PaidAt:           time.Now().UTC(),
	}

	if err := s.receiptRepo.Create(ctx, receipt); err != nil {
		zap.L().Error("Failed to record manual payment receipt", zap.Error(err), zap.String("tenant_id", tenantID.String()))
		return nil, err
	}

	zap.L().Info("Financial payment receipt recorded in IQD",
		zap.String("receipt_number", receipt.ReceiptNumber),
		zap.Int64("amount_iqd", receipt.AmountIQD),
		zap.String("tenant_id", tenantID.String()),
		zap.String("recorded_by", recordedBy.String()),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &tenantID, &recordedBy, "platform_admin", models.ActionPaymentRecorded, "payment_receipt", receipt.ReceiptNumber, map[string]interface{}{
			"amount_iqd":     receipt.AmountIQD,
			"payment_method": receipt.PaymentMethod,
		}, "", "")
	}

	return receipt, nil
}

// ListTenantReceipts returns all financial receipts for an institute.
func (s *BillingService) ListTenantReceipts(ctx context.Context, tenantID uuid.UUID) ([]models.PaymentReceipt, error) {
	return s.receiptRepo.ListByTenant(ctx, tenantID)
}

// ListAllReceipts returns paginated receipts for platform auditing.
func (s *BillingService) ListAllReceipts(ctx context.Context, page, limit int) ([]models.PaymentReceipt, int64, error) {
	return s.receiptRepo.ListAll(ctx, page, limit)
}
