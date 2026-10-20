package tests

import (
	"context"
	"testing"
	"time"

	"institute/app/models"
	"institute/app/services"
	"institute/database/migrator"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupWorkforceTestDB(t *testing.T) *gorm.DB {
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

func TestWorkforce_StaffAndOrganizationalLifecycle(t *testing.T) {
	db := setupWorkforceTestDB(t)
	ctx := context.Background()
	workforceSvc := services.NewWorkforceService(db)

	// 1. Create Tenant A and Tenant B
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia Baghdad Institute",
		Slug:   "aylia-bgd-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia Basra Institute",
		Slug:   "aylia-bsr-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 2. Create Departments & Positions in Tenant A
	sciDept, err := workforceSvc.CreateDepartment(ctx, tenantA.ID, services.CreateDepartmentRequest{
		Code: "SCI",
		Name: "Science & Mathematics Department",
	})
	if err != nil {
		t.Fatalf("failed to create science department: %v", err)
	}

	teacherPos, err := workforceSvc.CreatePosition(ctx, tenantA.ID, services.CreatePositionRequest{
		Code:         "TEACH",
		Title:        "Subject Teacher",
		IsManagerial: false,
	})
	if err != nil {
		t.Fatalf("failed to create teacher position: %v", err)
	}

	deptHeadPos, err := workforceSvc.CreatePosition(ctx, tenantA.ID, services.CreatePositionRequest{
		Code:         "HOD",
		Title:        "Head of Department",
		IsManagerial: true,
	})
	if err != nil {
		t.Fatalf("failed to create HOD position: %v", err)
	}

	// 3. Acceptance Scenario: Hire Staff Profile for a new person
	staff1, err := workforceSvc.CreateStaffProfile(ctx, tenantA.ID, services.CreateStaffRequest{
		FirstName:   "Karrar",
		LastName:    "Hussein",
		Gender:      "male",
		StaffNumber: "EMP-" + uuid.New().String()[:6],
		HireDate:    time.Now().AddDate(-1, 0, 0),
	})
	if err != nil {
		t.Fatalf("failed to create staff 1: %v", err)
	}

	// 4. Acceptance Scenario: Re-use existing Person to create another StaffProfile in Tenant B without duplicate Person
	sharedPersonID := staff1.PersonID
	staffInTenantB, err := workforceSvc.CreateStaffProfile(ctx, tenantB.ID, services.CreateStaffRequest{
		PersonID:    &sharedPersonID,
		StaffNumber: "EMP-B-" + uuid.New().String()[:6],
		HireDate:    time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to create staff in tenant B for existing person: %v", err)
	}
	if staffInTenantB.PersonID != sharedPersonID {
		t.Fatalf("expected staffInTenantB to share person ID %v, got %v", sharedPersonID, staffInTenantB.PersonID)
	}

	// 5. Hire a Manager in Tenant A
	managerStaff, err := workforceSvc.CreateStaffProfile(ctx, tenantA.ID, services.CreateStaffRequest{
		FirstName:   "Dr. Mustafa",
		LastName:    "Al-Saadi",
		Gender:      "male",
		StaffNumber: "EMP-" + uuid.New().String()[:6],
		HireDate:    time.Now().AddDate(-3, 0, 0),
	})
	if err != nil {
		t.Fatalf("failed to create manager staff: %v", err)
	}

	// Assign staff1's direct manager
	err = workforceSvc.SetDirectManager(ctx, tenantA.ID, staff1.ID, &managerStaff.ID)
	if err != nil {
		t.Fatalf("failed to set direct manager: %v", err)
	}

	// Acceptance Scenario: Prevent self-manager loop (A cannot manage A)
	err = workforceSvc.SetDirectManager(ctx, tenantA.ID, staff1.ID, &staff1.ID)
	if err == nil {
		t.Fatalf("expected error when setting staff as their own manager, got nil")
	}

	// Acceptance Scenario: Prevent reporting cycle (Manager cannot be managed by their subordinate)
	err = workforceSvc.SetDirectManager(ctx, tenantA.ID, managerStaff.ID, &staff1.ID)
	if err == nil {
		t.Fatalf("expected cycle error when manager reports to their subordinate, got nil")
	}

	// 6. Acceptance Scenario: Historical preservation during Promotion/Transfer
	// Step A: Assign initial primary position (Teacher in Science)
	assign1, err := workforceSvc.AssignPosition(ctx, tenantA.ID, staff1.ID, services.AssignPositionRequest{
		PositionID:   teacherPos.ID,
		DepartmentID: &sciDept.ID,
		IsPrimary:    true,
		StartDate:    time.Now().AddDate(-1, 0, 0),
	})
	if err != nil {
		t.Fatalf("failed to assign initial position: %v", err)
	}
	if !assign1.IsPrimary || assign1.Status != "active" {
		t.Fatalf("expected active primary assignment")
	}

	// Step B: Promote staff1 to Head of Department (HOD)
	assign2, err := workforceSvc.AssignPosition(ctx, tenantA.ID, staff1.ID, services.AssignPositionRequest{
		PositionID:   deptHeadPos.ID,
		DepartmentID: &sciDept.ID,
		IsPrimary:    true,
		StartDate:    time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to promote staff: %v", err)
	}
	if !assign2.IsPrimary || assign2.Status != "active" {
		t.Fatalf("expected new assignment to be active primary")
	}

	// Verify old assignment is superseded and NOT deleted!
	var archived models.PositionAssignment
	if err := db.First(&archived, "id = ?", assign1.ID).Error; err != nil {
		t.Fatalf("archived assignment was unexpectedly deleted: %v", err)
	}
	if archived.Status != "superseded" {
		t.Fatalf("expected previous assignment status to be 'superseded', got '%s'", archived.Status)
	}

	// Verify only ONE active primary assignment exists in DB
	var activePrimaryCount int64
	db.Model(&models.PositionAssignment{}).
		Where("tenant_id = ? AND staff_profile_id = ? AND is_primary = true AND status = 'active'", tenantA.ID, staff1.ID).
		Count(&activePrimaryCount)
	if activePrimaryCount != 1 {
		t.Fatalf("expected exactly 1 active primary position, got %d", activePrimaryCount)
	}

	// 7. Acceptance Scenario: Link employee teacher to StaffProfile vs Independent Teacher
	// Teacher A: Regular employee teacher (linked to staff1)
	empTeacher := models.TeacherProfile{
		ID:             uuid.New(),
		TenantID:       tenantA.ID,
		PersonID:       staff1.PersonID,
		StaffNumber:    "TCH-" + uuid.New().String()[:6],
		EmploymentType: "full_time",
		Status:         "active",
		StaffProfileID: &staff1.ID,
	}
	if err := db.Create(&empTeacher).Error; err != nil {
		t.Fatalf("failed to create employee teacher: %v", err)
	}

	// Teacher B: Independent / Private tutor (no StaffProfile, linked only to Person)
	indepPerson := models.Person{
		ID:        uuid.New(),
		FirstName: "Zaid",
		LastName:  "Tariq",
		Gender:    "male",
	}
	if err := db.Create(&indepPerson).Error; err != nil {
		t.Fatalf("failed to create independent person: %v", err)
	}

	indepTeacher := models.TeacherProfile{
		ID:             uuid.New(),
		TenantID:       tenantA.ID,
		PersonID:       indepPerson.ID,
		StaffNumber:    "IND-TCH-" + uuid.New().String()[:6],
		EmploymentType: "contractor",
		Status:         "active",
		StaffProfileID: nil, // Intentionally independent
	}
	if err := db.Create(&indepTeacher).Error; err != nil {
		t.Fatalf("failed to create independent teacher: %v", err)
	}

	// Verify DB relations
	var loadedEmpTeacher models.TeacherProfile
	if err := db.Preload("StaffProfile").First(&loadedEmpTeacher, "id = ?", empTeacher.ID).Error; err != nil {
		t.Fatalf("failed to load employee teacher: %v", err)
	}
	if loadedEmpTeacher.StaffProfile == nil || loadedEmpTeacher.StaffProfile.ID != staff1.ID {
		t.Fatalf("expected employee teacher to have linked staff profile")
	}

	var loadedIndepTeacher models.TeacherProfile
	if err := db.First(&loadedIndepTeacher, "id = ?", indepTeacher.ID).Error; err != nil {
		t.Fatalf("failed to load independent teacher: %v", err)
	}
	if loadedIndepTeacher.StaffProfileID != nil {
		t.Fatalf("expected independent teacher staff_profile_id to be nil")
	}
}
