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

func setupStaffAttendanceTestDB(t *testing.T) *gorm.DB {
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

func TestStaffAttendance_LifecycleAndLeaveAuditing(t *testing.T) {
	db := setupStaffAttendanceTestDB(t)
	ctx := context.Background()
	workforceSvc := services.NewWorkforceService(db)
	attendanceSvc := services.NewStaffAttendanceService(db)

	// 1. Create Tenant A and Tenant B
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Aylia Karkh Academy",
		Slug:   "aylia-krk-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Unrelated Academy",
		Slug:   "unrelated-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 2. Hire Staff in Tenant A
	staff, err := workforceSvc.CreateStaffProfile(ctx, tenantA.ID, services.CreateStaffRequest{
		FirstName:   "Sajjad",
		LastName:    "Mohammad",
		Gender:      "male",
		StaffNumber: "EMP-" + uuid.New().String()[:6],
		HireDate:    time.Now().AddDate(-1, 0, 0),
	})
	if err != nil {
		t.Fatalf("failed to hire staff: %v", err)
	}

	// 3. Acceptance Scenario: Record Daily Attendance
	today := time.Now().Truncate(24 * time.Hour)
	checkIn := time.Now().Add(-8 * time.Hour)
	checkOut := time.Now()

	attRecord, err := attendanceSvc.RecordStaffAttendance(ctx, tenantA.ID, services.RecordStaffAttendanceRequest{
		StaffProfileID: staff.ID,
		AttendanceDate: today,
		CheckInTime:    &checkIn,
		CheckOutTime:   &checkOut,
		Status:         "present",
		LateMinutes:    0,
	})
	if err != nil {
		t.Fatalf("failed to record staff attendance: %v", err)
	}
	if attRecord.Status != "present" || attRecord.IsCorrected {
		t.Fatalf("expected active uncorrected attendance")
	}

	// Attempt duplicate attendance on the same date (should fail)
	_, err = attendanceSvc.RecordStaffAttendance(ctx, tenantA.ID, services.RecordStaffAttendanceRequest{
		StaffProfileID: staff.ID,
		AttendanceDate: today,
	})
	if err == nil {
		t.Fatalf("expected error on duplicate attendance for same date, got nil")
	}

	// 4. Acceptance Scenario: Attendance Correction with Mandatory Audit Reason
	auditorID := uuid.New()
	correctionReason := "Employee arrived late due to transport delay; approved adjustment"
	correctedLateMin := 25

	corrected, err := attendanceSvc.CorrectStaffAttendance(ctx, tenantA.ID, attRecord.ID, auditorID, services.CorrectAttendanceRequest{
		Status:           "late",
		CheckInTime:      &checkIn,
		CheckOutTime:     &checkOut,
		LateMinutes:      correctedLateMin,
		CorrectionReason: correctionReason,
	})
	if err != nil {
		t.Fatalf("failed to correct attendance: %v", err)
	}

	if !corrected.IsCorrected || corrected.Status != "late" || corrected.LateMinutes != 25 {
		t.Fatalf("expected corrected record with late status and 25 min")
	}
	if corrected.CorrectedByUserID == nil || *corrected.CorrectedByUserID != auditorID {
		t.Fatalf("expected auditor ID to be recorded")
	}

	// 5. Acceptance Scenario: Leave Request & Overlap Prevention
	startLeave := today.AddDate(0, 0, 7)
	endLeave := today.AddDate(0, 0, 10)

	leaveReq, err := attendanceSvc.SubmitLeaveRequest(ctx, tenantA.ID, services.SubmitLeaveRequest{
		StaffProfileID: staff.ID,
		LeaveType:      "annual",
		StartDate:      startLeave,
		EndDate:        endLeave,
		Reason:         "Family travel",
	})
	if err != nil {
		t.Fatalf("failed to submit leave request: %v", err)
	}
	if leaveReq.Status != "pending" || leaveReq.DaysCount != 4 {
		t.Fatalf("expected pending leave of 4 days, got %d", leaveReq.DaysCount)
	}

	// Attempt overlapping leave request (should be rejected)
	_, err = attendanceSvc.SubmitLeaveRequest(ctx, tenantA.ID, services.SubmitLeaveRequest{
		StaffProfileID: staff.ID,
		LeaveType:      "emergency",
		StartDate:      startLeave.AddDate(0, 0, 1), // Overlaps
		EndDate:        endLeave.AddDate(0, 0, 2),
		Reason:         "Conflicting leave",
	})
	if err == nil || err != services.ErrOverlappingLeave {
		t.Fatalf("expected ErrOverlappingLeave, got %v", err)
	}

	// 6. Acceptance Scenario: Leave Review & Approval with Reviewer Trail
	reviewerID := uuid.New()
	approvedLeave, err := attendanceSvc.ReviewLeaveRequest(ctx, tenantA.ID, leaveReq.ID, reviewerID, true, "Approved by HR Director")
	if err != nil {
		t.Fatalf("failed to approve leave request: %v", err)
	}
	if approvedLeave.Status != "approved" {
		t.Fatalf("expected status 'approved', got '%s'", approvedLeave.Status)
	}
	if approvedLeave.ReviewedByUserID == nil || *approvedLeave.ReviewedByUserID != reviewerID {
		t.Fatalf("expected reviewer ID %v", reviewerID)
	}

	// 7. Acceptance Scenario: Tenant Isolation
	// Tenant B cannot review or modify Tenant A's leave request
	_, err = attendanceSvc.ReviewLeaveRequest(ctx, tenantB.ID, leaveReq.ID, reviewerID, false, "Illegal Cross-Tenant Action")
	if err == nil {
		t.Fatalf("expected error on cross-tenant leave review, got nil")
	}
}
