package tests

import (
	"context"
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

func setupContractTestDB(t *testing.T) *gorm.DB {
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

func TestContracts_FullLifecycleAndConfidentiality(t *testing.T) {
	db := setupContractTestDB(t)
	ctx := context.Background()
	workforceSvc := services.NewWorkforceService(db)
	contractSvc := services.NewContractService(db)

	// 1. Create Tenant A and Tenant B
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia Baghdad School",
		Slug:   "aylia-school-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Other Institute",
		Slug:   "other-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 2. Hire Staff in Tenant A
	staffA, err := workforceSvc.CreateStaffProfile(ctx, tenantA.ID, services.CreateStaffRequest{
		FirstName:   "Muntadhar",
		LastName:    "Kadhim",
		Gender:      "male",
		StaffNumber: "EMP-" + uuid.New().String()[:6],
		HireDate:    time.Now().AddDate(-2, 0, 0),
	})
	if err != nil {
		t.Fatalf("failed to hire staff in tenant A: %v", err)
	}

	// 3. Issue Initial Employment Contract with precise decimal compensation
	baseSalary := decimal.NewFromInt(1250000) // 1,250,000 IQD
	sessionRate := decimal.NewFromInt(25000)  // 25,000 IQD per session

	contract1, err := contractSvc.CreateContract(ctx, tenantA.ID, staffA.ID, services.CreateContractRequest{
		ContractNumber:     "CNT-" + uuid.New().String()[:6],
		ContractType:       "full_time",
		BaseSalary:         &baseSalary,
		DefaultSessionRate: &sessionRate,
		Currency:           "IQD",
		StartDate:          time.Now().AddDate(-1, 0, 0),
		EndDate:            func() *time.Time { t := time.Now(); return &t }(),
	})
	if err != nil {
		t.Fatalf("failed to create contract 1: %v", err)
	}
	if contract1.Status != "active" {
		t.Fatalf("expected contract 1 to be active")
	}

	// 4. Acceptance Scenario: Renewal preserves contract history without deleting or modifying original terms
	newSalary := decimal.NewFromInt(1400000) // 1,400,000 IQD after increment
	contract2, err := contractSvc.RenewContract(ctx, tenantA.ID, contract1.ID, services.CreateContractRequest{
		ContractNumber:     "CNT-REN-" + uuid.New().String()[:6],
		ContractType:       "full_time",
		BaseSalary:         &newSalary,
		DefaultSessionRate: &sessionRate,
		Currency:           "IQD",
		StartDate:          time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to renew contract: %v", err)
	}

	// Verify old contract is preserved in DB with 'renewed' status
	var oldContractCheck models.EmploymentContract
	if err := db.First(&oldContractCheck, "id = ?", contract1.ID).Error; err != nil {
		t.Fatalf("old contract was unexpectedly deleted: %v", err)
	}
	if oldContractCheck.Status != "renewed" {
		t.Fatalf("expected old contract status to be 'renewed', got '%s'", oldContractCheck.Status)
	}
	if !oldContractCheck.BaseSalary.Equal(baseSalary) {
		t.Fatalf("expected old contract salary to remain exactly 1,250,000 IQD")
	}

	// Verify only ONE active contract exists in DB for this staff member
	var activeContractCount int64
	db.Model(&models.EmploymentContract{}).
		Where("tenant_id = ? AND staff_profile_id = ? AND status = 'active'", tenantA.ID, staffA.ID).
		Count(&activeContractCount)
	if activeContractCount != 1 {
		t.Fatalf("expected exactly 1 active contract, got %d", activeContractCount)
	}

	// 5. Acceptance Scenario: Contract Termination
	termReason := "Resignation accepted with mutual consent"
	err = contractSvc.TerminateContract(ctx, tenantA.ID, contract2.ID, time.Now(), termReason)
	if err != nil {
		t.Fatalf("failed to terminate contract: %v", err)
	}

	var terminatedContract models.EmploymentContract
	if err := db.First(&terminatedContract, "id = ?", contract2.ID).Error; err != nil {
		t.Fatalf("terminated contract was unexpectedly deleted: %v", err)
	}
	if terminatedContract.Status != "terminated" {
		t.Fatalf("expected status 'terminated', got '%s'", terminatedContract.Status)
	}

	// 6. Qualifications & Credentials
	gradYear := 2018
	docURL := "https://storage.fistudy.iq/credentials/muntadhar-degree.pdf"
	qual, err := contractSvc.AddQualification(ctx, tenantA.ID, staffA.ID, services.AddQualificationRequest{
		QualificationType: "bachelor",
		Title:             "B.Sc. in Computer Science",
		InstitutionName:   "University of Baghdad",
		GraduationYear:    &gradYear,
		DocumentURL:       &docURL,
	})
	if err != nil {
		t.Fatalf("failed to add qualification: %v", err)
	}
	if qual.IsVerified {
		t.Fatalf("expected newly added qualification to be unverified")
	}

	auditorID := uuid.New()
	err = contractSvc.VerifyQualification(ctx, tenantA.ID, qual.ID, auditorID)
	if err != nil {
		t.Fatalf("failed to verify qualification: %v", err)
	}

	var verified models.StaffQualification
	if err := db.First(&verified, "id = ?", qual.ID).Error; err != nil {
		t.Fatalf("failed to reload qualification: %v", err)
	}
	if !verified.IsVerified || verified.VerifiedByUserID == nil || *verified.VerifiedByUserID != auditorID {
		t.Fatalf("expected qualification to be verified by auditor %v", auditorID)
	}

	// 7. Confidential Documents
	fileSize := int64(1048576) // 1MB
	mimeType := "application/pdf"
	doc, err := contractSvc.AddStaffDocument(ctx, tenantA.ID, staffA.ID, services.AddStaffDocumentRequest{
		DocumentCategory: "clearance",
		Title:            "Police Clearance Certificate",
		FileURL:          "https://storage.fistudy.iq/confidential/clearance-01.pdf",
		FileSizeBytes:    &fileSize,
		MimeType:         &mimeType,
		IsConfidential:   true,
	})
	if err != nil {
		t.Fatalf("failed to add confidential document: %v", err)
	}
	if !doc.IsConfidential {
		t.Fatalf("expected document to be confidential")
	}

	// 8. Acceptance Scenario: Tenant Isolation
	// Tenant B cannot terminate Tenant A's contract
	err = contractSvc.TerminateContract(ctx, tenantB.ID, contract2.ID, time.Now(), "Illegal Cross-Tenant Attempt")
	if err == nil {
		t.Fatalf("expected error on cross-tenant termination attempt, got nil")
	}
}
