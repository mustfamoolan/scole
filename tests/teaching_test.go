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

func setupTeachingTestDB(t *testing.T) *gorm.DB {
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

func TestTeaching_AssignmentsSchedulesAndSubstituteAccruals(t *testing.T) {
	db := setupTeachingTestDB(t)
	ctx := context.Background()
	teachingSvc := services.NewTeachingService(db)

	// 1. Setup Tenant A and Tenant B
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia Baghdad Science School",
		Slug:   "aylia-sci-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Al-Hekma Institute",
		Slug:   "hekma-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 2. Setup Central Person who teaches in both Tenant A and Tenant B
	centralTeacherPerson := models.Person{
		ID:        uuid.New(),
		FirstName: "Ustadh Ahmed",
		LastName:  "Al-Bayati",
		Gender:    "male",
	}
	if err := db.Create(&centralTeacherPerson).Error; err != nil {
		t.Fatalf("failed to create central teacher person: %v", err)
	}

	// Teacher Profile in Tenant A
	rateA := decimal.NewFromInt(30000)
	teacherA, err := teachingSvc.CreateTeacherProfile(ctx, tenantA.ID, services.CreateTeacherProfileRequest{
		PersonID:       &centralTeacherPerson.ID,
		StaffNumber:    "TCH-A-" + uuid.New().String()[:6],
		Specialization: func() *string { s := "Physics"; return &s }(),
		HourlyRate:     &rateA,
	})
	if err != nil {
		t.Fatalf("failed to create teacher in tenant A: %v", err)
	}

	// Teacher Profile in Tenant B (Different institution, independent rates)
	rateB := decimal.NewFromInt(45000)
	teacherB, err := teachingSvc.CreateTeacherProfile(ctx, tenantB.ID, services.CreateTeacherProfileRequest{
		PersonID:       &centralTeacherPerson.ID,
		StaffNumber:    "TCH-B-" + uuid.New().String()[:6],
		Specialization: func() *string { s := "Advanced Physics"; return &s }(),
		HourlyRate:     &rateB,
	})
	if err != nil {
		t.Fatalf("failed to create teacher in tenant B: %v", err)
	}

	// Verify Isolation: Tenant A rate does not overwrite Tenant B
	if teacherA.TenantID != tenantA.ID || teacherB.TenantID != tenantB.ID {
		t.Fatalf("expected tenant isolation for teacher profiles")
	}

	// 3. Create Substitute Teacher in Tenant A
	substituteTeacher, err := teachingSvc.CreateTeacherProfile(ctx, tenantA.ID, services.CreateTeacherProfileRequest{
		FirstName:   "Ali",
		LastName:    "Al-Rikabi",
		Gender:      "male",
		StaffNumber: "SUB-" + uuid.New().String()[:6],
		HourlyRate:  &rateA,
	})
	if err != nil {
		t.Fatalf("failed to create substitute teacher: %v", err)
	}

	// 4. Setup Academic Cycle, Subject, and Curriculum in Tenant A
	cycle := models.AcademicCycle{
		ID:        uuid.New(),
		TenantID:  tenantA.ID,
		Name:      "Academic Year 2026-2027",
		StartDate: time.Now(),
		EndDate:   time.Now().AddDate(1, 0, 0),
		Status:    "active",
	}
	if err := db.Create(&cycle).Error; err != nil {
		t.Fatalf("failed to create cycle: %v", err)
	}

	subj := models.Subject{
		ID:       uuid.New(),
		TenantID: &tenantA.ID,
		Code:     "PHY-101",
		Name:     "Physics 101",
	}
	if err := db.Create(&subj).Error; err != nil {
		t.Fatalf("failed to create subject: %v", err)
	}

	def := models.CurriculumDefinition{
		ID:        uuid.New(),
		TenantID:  &tenantA.ID,
		SubjectID: subj.ID,
		Name:      "National Physics Curriculum",
	}
	if err := db.Create(&def).Error; err != nil {
		t.Fatalf("failed to create curriculum def: %v", err)
	}

	edition := models.CurriculumEdition{
		ID:                     uuid.New(),
		CurriculumDefinitionID: def.ID,
		EditionName:            "2026 Edition",
		YearPublished:          2026,
	}
	if err := db.Create(&edition).Error; err != nil {
		t.Fatalf("failed to create edition: %v", err)
	}

	adopted := models.AdoptedCurriculum{
		ID:                  uuid.New(),
		TenantID:            tenantA.ID,
		CurriculumEditionID: edition.ID,
		AcademicCycleID:     cycle.ID,
	}
	if err := db.Create(&adopted).Error; err != nil {
		t.Fatalf("failed to create adopted curriculum: %v", err)
	}

	// 5. Assign Teacher A to Curriculum
	assignment, err := teachingSvc.AssignTeacher(ctx, tenantA.ID, services.AssignTeacherRequest{
		TeacherProfileID:    teacherA.ID,
		AdoptedCurriculumID: adopted.ID,
		IsLeadTeacher:       true,
		StartDate:           time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to assign teacher: %v", err)
	}

	// 6. Acceptance Scenario: Schedule Conflict Engine
	// Slot 1: Sunday 08:30 - 09:30 Room 101
	room101 := "Room 101"
	slot1, err := teachingSvc.CreatePlannedSlot(ctx, tenantA.ID, assignment.ID, services.CreatePlannedSlotRequest{
		DayOfWeek:  0, // Sunday
		StartTime:  "08:30",
		EndTime:    "09:30",
		RoomNumber: &room101,
	})
	if err != nil {
		t.Fatalf("failed to create planned slot 1: %v", err)
	}
	if !slot1.IsActive {
		t.Fatalf("expected slot 1 to be active")
	}

	// Slot 2 Conflict Attempt: Sunday 09:00 - 10:00 (Overlaps with 08:30 - 09:30 for same teacher)
	_, err = teachingSvc.CreatePlannedSlot(ctx, tenantA.ID, assignment.ID, services.CreatePlannedSlotRequest{
		DayOfWeek:  0,
		StartTime:  "09:00",
		EndTime:    "10:00",
		RoomNumber: func() *string { s := "Room 102"; return &s }(),
	})
	if err == nil || err != services.ErrTeacherScheduleConflict {
		t.Fatalf("expected ErrTeacherScheduleConflict on overlapping slot, got %v", err)
	}

	// Non-overlapping Slot on Sunday: 10:00 - 11:00 (Should pass)
	_, err = teachingSvc.CreatePlannedSlot(ctx, tenantA.ID, assignment.ID, services.CreatePlannedSlotRequest{
		DayOfWeek:  0,
		StartTime:  "10:00",
		EndTime:    "11:00",
		RoomNumber: &room101,
	})
	if err != nil {
		t.Fatalf("expected non-overlapping slot to pass, got: %v", err)
	}

	// 7. Acceptance Scenario: Substitute Teacher Execution & Accrual Engine
	// Execute session with substitute teacher
	topic := "Newton's Laws of Motion"
	session, accrual, err := teachingSvc.RecordActualSession(ctx, tenantA.ID, services.RecordActualSessionRequest{
		PlannedScheduleSlotID: &slot1.ID,
		TeacherAssignmentID:   assignment.ID,
		SubstituteTeacherID:   &substituteTeacher.ID, // Substitute took the class!
		SessionDate:           time.Now(),
		ActualStartTime:       time.Now(),
		ActualEndTime:         time.Now().Add(45 * time.Minute),
		Status:                "completed",
		LessonTopicDelivered:  &topic,
		IsPayable:             true,
	})
	if err != nil {
		t.Fatalf("failed to record actual session: %v", err)
	}

	if session.SubstituteTeacherID == nil || *session.SubstituteTeacherID != substituteTeacher.ID {
		t.Fatalf("expected substitute teacher ID to be recorded")
	}

	// Crucial Acceptance Check: The payout accrual MUST belong to the Substitute Teacher, not the absent teacher!
	if accrual == nil {
		t.Fatalf("expected payout accrual to be generated")
	}
	if accrual.TeacherProfileID != substituteTeacher.ID {
		t.Fatalf("expected accrual to be awarded to substitute teacher (%v), got %v", substituteTeacher.ID, accrual.TeacherProfileID)
	}
	if !accrual.CalculatedAmount.Equal(rateA) {
		t.Fatalf("expected accrual amount %v, got %v", rateA, accrual.CalculatedAmount)
	}
}
