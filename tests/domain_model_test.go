package tests

import (
	"testing"
	"time"

	"institute/app/models"
	"institute/database/migrator"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupDomainModelTestDB(t *testing.T) *gorm.DB {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database (institute_test): %v", err)
	}

	// Run official migrations on institute_test
	_, err = migrator.Migrate(db, "../database/migrations")
	if err != nil {
		t.Fatalf("failed to run migrations on test db: %v", err)
	}

	return db
}

func TestDomainModels_PersistenceAndIsolation(t *testing.T) {
	db := setupDomainModelTestDB(t)

	// 1. Create Tenant A
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Al-Aylia Academy for Sciences",
		Slug:   "aylia-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	// 2. Create Central Person
	person := models.Person{
		ID:        uuid.New(),
		FirstName: "Ali",
		LastName:  "Hassan",
		Gender:    "male",
	}
	if err := db.Create(&person).Error; err != nil {
		t.Fatalf("failed to create person: %v", err)
	}

	// 3. Create Student Profile in Tenant A
	student := models.StudentProfile{
		ID:               uuid.New(),
		TenantID:         tenantA.ID,
		PersonID:         person.ID,
		StudentNumber:    "STU-" + uuid.New().String()[:6],
		EnrollmentStatus: "active",
	}
	if err := db.Create(&student).Error; err != nil {
		t.Fatalf("failed to create student profile: %v", err)
	}

	// 4. Create Academic Cycle, Term, Program, Grade, and Section in Tenant A
	cycle := models.AcademicCycle{
		ID:        uuid.New(),
		TenantID:  tenantA.ID,
		Name:      "Academic Year " + uuid.New().String()[:6],
		StartDate: time.Now(),
		EndDate:   time.Now().AddDate(1, 0, 0),
		IsCurrent: true,
		Status:    "active",
	}
	if err := db.Create(&cycle).Error; err != nil {
		t.Fatalf("failed to create academic cycle: %v", err)
	}

	term := models.AcademicTerm{
		ID:              uuid.New(),
		TenantID:        tenantA.ID,
		AcademicCycleID: cycle.ID,
		Name:            "Fall Term",
		TermOrder:       1,
		StartDate:       time.Now(),
		EndDate:         time.Now().AddDate(0, 4, 0),
		IsActive:        true,
	}
	if err := db.Create(&term).Error; err != nil {
		t.Fatalf("failed to create academic term: %v", err)
	}

	program := models.EducationalProgram{
		ID:          uuid.New(),
		TenantID:    tenantA.ID,
		Code:        "PRG-" + uuid.New().String()[:6],
		Name:        "General Education",
		ProgramType: "k12",
	}
	if err := db.Create(&program).Error; err != nil {
		t.Fatalf("failed to create educational program: %v", err)
	}

	grade := models.StudyGrade{
		ID:                   uuid.New(),
		TenantID:             tenantA.ID,
		EducationalProgramID: program.ID,
		Name:                 "Grade 10",
		GradeLevel:           10,
	}
	if err := db.Create(&grade).Error; err != nil {
		t.Fatalf("failed to create study grade: %v", err)
	}

	section := models.ClassSection{
		ID:           uuid.New(),
		TenantID:     tenantA.ID,
		StudyGradeID: grade.ID,
		Name:         "A",
		Capacity:     30,
	}
	if err := db.Create(&section).Error; err != nil {
		t.Fatalf("failed to create class section: %v", err)
	}

	// 5. Enroll Student in Tenant A
	enrollment := models.AcademicEnrollment{
		ID:               uuid.New(),
		TenantID:         tenantA.ID,
		StudentProfileID: student.ID,
		AcademicTermID:   term.ID,
		ClassSectionID:   &section.ID,
		EnrollmentDate:   time.Now(),
		Status:           "active",
	}
	if err := db.Create(&enrollment).Error; err != nil {
		t.Fatalf("failed to create academic enrollment: %v", err)
	}

	// 6. Finance: Accrual & Payment & Allocation with exact decimals
	amount := decimal.NewFromInt(500000)
	accrual := models.ChargeAccrual{
		ID:               uuid.New(),
		TenantID:         tenantA.ID,
		StudentProfileID: student.ID,
		EnrollmentID:     &enrollment.ID,
		ChargeType:       "tuition_installment",
		Description:      "Term 1 Tuition Fee",
		GrossAmount:      amount,
		DiscountAmount:   decimal.Zero,
		NetDueAmount:     amount,
		PaidAmount:       amount,
		Currency:         "IQD",
		DueDate:          time.Now().AddDate(0, 1, 0),
		Status:           "paid",
	}
	if err := db.Create(&accrual).Error; err != nil {
		t.Fatalf("failed to create charge accrual: %v", err)
	}

	payment := models.PaymentTransaction{
		ID:                uuid.New(),
		TenantID:          tenantA.ID,
		PayerPersonID:     person.ID,
		ReceiptNumber:     "REC-" + uuid.New().String()[:8],
		TotalAmount:       amount,
		AllocatedAmount:   amount,
		UnallocatedAmount: decimal.Zero,
		Currency:          "IQD",
		PaymentMethod:     "cash",
		PaymentDate:       time.Now(),
		CashierUserID:     uuid.New(),
		Status:            "collected",
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("failed to create payment transaction: %v", err)
	}

	allocation := models.PaymentAllocation{
		ID:                   uuid.New(),
		TenantID:             tenantA.ID,
		PaymentTransactionID: payment.ID,
		ChargeAccrualID:      accrual.ID,
		AllocatedAmount:      amount,
		AllocatedAt:          time.Now(),
		AllocatedByUserID:    payment.CashierUserID,
	}
	if err := db.Create(&allocation).Error; err != nil {
		t.Fatalf("failed to create payment allocation: %v", err)
	}

	// 7. Multi-tenancy isolation verification
	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Isolated Second School",
		Slug:   "isolated-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	var countInTenantB int64
	db.Model(&models.StudentProfile{}).Where("tenant_id = ?", tenantB.ID).Count(&countInTenantB)
	if countInTenantB != 0 {
		t.Fatalf("isolation violation: tenant B saw student from tenant A")
	}

	// 8. ADVERSARIAL DB-LEVEL TEST:
	// Attempt to create an enrollment in Tenant B that references Tenant A's student or term
	// The database composite foreign key MUST reject this with a foreign key violation!
	adversarialEnrollment := models.AcademicEnrollment{
		ID:               uuid.New(),
		TenantID:         tenantB.ID, // Tenant B
		StudentProfileID: student.ID, // Belongs to Tenant A!
		AcademicTermID:   term.ID,    // Belongs to Tenant A!
		EnrollmentDate:   time.Now(),
		Status:           "active",
	}
	errCrossTenant := db.Create(&adversarialEnrollment).Error
	if errCrossTenant == nil {
		t.Fatalf("SECURITY VIOLATION: Database allowed cross-tenant foreign key reference from Tenant B to Tenant A's student/term!")
	}
	t.Logf("✅ Successfully verified that composite foreign key blocked cross-tenant reference: %v", errCrossTenant)

	// Attempt cross-tenant payment allocation: Tenant B allocates to Tenant A's accrual
	adversarialPayment := models.PaymentTransaction{
		ID:                uuid.New(),
		TenantID:          tenantB.ID,
		PayerPersonID:     person.ID,
		ReceiptNumber:     "REC-ADV-" + uuid.New().String()[:8],
		TotalAmount:       amount,
		AllocatedAmount:   amount,
		UnallocatedAmount: decimal.Zero,
		Currency:          "IQD",
		PaymentMethod:     "cash",
		PaymentDate:       time.Now(),
		CashierUserID:     uuid.New(),
		Status:            "collected",
	}
	if err := db.Create(&adversarialPayment).Error; err != nil {
		t.Fatalf("failed to create tenant B payment: %v", err)
	}

	adversarialAlloc := models.PaymentAllocation{
		ID:                   uuid.New(),
		TenantID:             tenantB.ID,
		PaymentTransactionID: adversarialPayment.ID,
		ChargeAccrualID:      accrual.ID, // Belongs to Tenant A!
		AllocatedAmount:      amount,
		AllocatedAt:          time.Now(),
		AllocatedByUserID:    adversarialPayment.CashierUserID,
	}
	errCrossAlloc := db.Create(&adversarialAlloc).Error
	if errCrossAlloc == nil {
		t.Fatalf("SECURITY VIOLATION: Database allowed cross-tenant payment allocation from Tenant B to Tenant A's accrual!")
	}
	t.Logf("✅ Successfully verified that composite foreign key blocked cross-tenant payment allocation: %v", errCrossAlloc)
}
