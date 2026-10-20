package tests

import (
	"context"
	"sync"
	"testing"
	"time"

	"institute/app/models"
	"institute/app/services"
	"institute/database/migrator"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupPayoutTestDB(t *testing.T) *gorm.DB {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database (institute_test): %v", err)
	}

	_, err = migrator.Migrate(db, "../database/migrations")
	if err != nil {
		t.Fatalf("failed to run migrations on test db: %v", err)
	}

	return db
}

func TestTeacherPayout_FullApprovalAndDisbursementCycle(t *testing.T) {
	db := setupPayoutTestDB(t)
	ctx := context.Background()
	teachingSvc := services.NewTeachingService(db)
	payoutSvc := services.NewTeacherPayoutService(db)

	// 1. Setup Tenant A and Tenant B
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia High School",
		Slug:   "aylia-high-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Al-Najaf Institute",
		Slug:   "najaf-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 2. Setup Teacher in Tenant A
	rate := decimal.NewFromInt(35000) // 35,000 IQD per session
	teacher, err := teachingSvc.CreateTeacherProfile(ctx, tenantA.ID, services.CreateTeacherProfileRequest{
		FirstName:   "Murtadha",
		LastName:    "Al-Husseini",
		Gender:      "male",
		StaffNumber: "TCH-PAY-" + uuid.New().String()[:6],
		HourlyRate:  &rate,
	})
	if err != nil {
		t.Fatalf("failed to create teacher: %v", err)
	}

	// 3. Create Accrual directly
	accrualAmount := decimal.NewFromInt(35000)
	accrual := models.TeacherPayoutAccrual{
		TenantID:         tenantA.ID,
		TeacherProfileID: teacher.ID,
		PayoutCalcModel:  "per_session",
		CalculatedAmount: accrualAmount,
		Currency:         "IQD",
		AccrualDate:      time.Now(),
		Status:           "pending",
	}
	if err := db.Create(&accrual).Error; err != nil {
		t.Fatalf("failed to create accrual: %v", err)
	}

	// 4. Acceptance Scenario: Disbursing unapproved accrual must be rejected
	approverID := uuid.New()
	cashierID := uuid.New()

	_, err = payoutSvc.ExecutePayout(ctx, tenantA.ID, accrual.ID, cashierID, services.ExecutePayoutRequest{
		PaymentMethod: "cash",
	})
	if err == nil || err != services.ErrAccrualNotApproved {
		t.Fatalf("expected ErrAccrualNotApproved when paying unapproved accrual, got %v", err)
	}

	// 5. Acceptance Scenario: Approval workflow
	approved, err := payoutSvc.ApprovePayoutAccrual(ctx, tenantA.ID, accrual.ID, approverID)
	if err != nil {
		t.Fatalf("failed to approve accrual: %v", err)
	}
	if approved.Status != "approved" {
		t.Fatalf("expected status 'approved', got '%s'", approved.Status)
	}

	// 6. Acceptance Scenario: Concurrency-Safe Payout Execution (Prevent Double-Disbursement)
	var wg sync.WaitGroup
	successCount := 0
	failCount := 0
	var mu sync.Mutex

	// Launch two concurrent attempts to disburse the same approved accrual
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := payoutSvc.ExecutePayout(ctx, tenantA.ID, accrual.ID, cashierID, services.ExecutePayoutRequest{
				PaymentMethod: "cash",
			})
			mu.Lock()
			if err == nil {
				successCount++
			} else {
				failCount++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()

	// Exactly ONE must succeed and exactly ONE must fail!
	if successCount != 1 || failCount != 1 {
		t.Fatalf("concurrency failure: expected exactly 1 success and 1 fail, got success=%d, fail=%d", successCount, failCount)
	}

	// 7. Verify Accrual is now closed ('paid')
	var closedAccrual models.TeacherPayoutAccrual
	if err := db.First(&closedAccrual, "id = ?", accrual.ID).Error; err != nil {
		t.Fatalf("failed to reload accrual: %v", err)
	}
	if closedAccrual.Status != "paid" {
		t.Fatalf("expected status 'paid', got '%s'", closedAccrual.Status)
	}

	// 8. Acceptance Scenario: Cannot void an already paid accrual
	err = payoutSvc.VoidPayoutAccrual(ctx, tenantA.ID, accrual.ID, approverID, "Cancellation attempt")
	if err == nil || err != services.ErrCannotVoidPaidAccrual {
		t.Fatalf("expected ErrCannotVoidPaidAccrual, got %v", err)
	}

	// 9. Acceptance Scenario: Tenant Isolation
	// Tenant B cannot view or disburse Tenant A's accrual
	_, err = payoutSvc.ExecutePayout(ctx, tenantB.ID, accrual.ID, cashierID, services.ExecutePayoutRequest{
		PaymentMethod: "cash",
	})
	if err == nil {
		t.Fatalf("expected error on cross-tenant payout execution, got nil")
	}
}
