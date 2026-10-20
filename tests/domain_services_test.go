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

func TestDomainServices_FullLifecycle(t *testing.T) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database (institute_test): %v", err)
	}

	_, err = migrator.Migrate(db, "../database/migrations")
	if err != nil {
		t.Fatalf("failed to run migrations on test db: %v", err)
	}

	ctx := context.Background()
	academicSvc := services.NewAcademicService(db)
	assessmentSvc := services.NewAssessmentService(db)
	financeSvc := services.NewEducationalFinanceService(db)

	// 1. Create Tenant A
	tenantA := models.Tenant{
		ID:     uuid.New(),
		Name:   "Al-Aylia Advanced Institute",
		Slug:   "institute-adv-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	// 2. Create Tenant B for cross-tenant tests
	tenantB := models.Tenant{
		ID:     uuid.New(),
		Name:   "Competitor Institute",
		Slug:   "competitor-" + uuid.New().String()[:8],
		Status: models.TenantStatusActive,
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	// 3. Create Person (Student)
	person := models.Person{
		ID:        uuid.New(),
		FirstName: "Zaid",
		LastName:  "Omar",
		Gender:    "male",
	}
	if err := db.Create(&person).Error; err != nil {
		t.Fatalf("failed to create person: %v", err)
	}

	// 4. Create Student Profile via AcademicService in Tenant A
	studentNumber := "STU-" + uuid.New().String()[:6]
	student, err := academicSvc.CreateStudentProfile(ctx, tenantA.ID, services.CreateStudentRequest{
		PersonID:         person.ID,
		StudentNumber:    studentNumber,
		EnrollmentStatus: "registered",
	})
	if err != nil {
		t.Fatalf("academicSvc.CreateStudentProfile failed: %v", err)
	}
	if student.TenantID != tenantA.ID {
		t.Fatalf("student profile tenant mismatch")
	}

	// 5. Guardian Relationship (Scenario 3)
	guardianPerson := models.Person{
		ID:        uuid.New(),
		FirstName: "Omar",
		LastName:  "Zaid",
		Gender:    "male",
	}
	db.Create(&guardianPerson)

	guardianRel, err := academicSvc.LinkGuardian(ctx, tenantA.ID, student.ID, services.LinkGuardianRequest{
		GuardianPersonID:         guardianPerson.ID,
		RelationshipType:         "father",
		IsPrimary:                true,
		CanViewGrades:            true,
		CanViewAttendance:        true,
		CanReceiveNotifications:  true,
		CanPickupStudent:         true,
		IsFinanciallyResponsible: true,
	})
	if err != nil {
		t.Fatalf("academicSvc.LinkGuardian failed: %v", err)
	}
	if guardianRel.StudentProfileID != student.ID {
		t.Fatalf("guardian relation mismatch")
	}

	// Cross-tenant Guardian check: Tenant B tries to link guardian to Tenant A's student
	_, errCrossGuardian := academicSvc.LinkGuardian(ctx, tenantB.ID, student.ID, services.LinkGuardianRequest{
		GuardianPersonID: guardianPerson.ID,
		RelationshipType: "uncle",
	})
	if errCrossGuardian == nil {
		t.Fatalf("SECURITY VIOLATION: AcademicService allowed Tenant B to link guardian to Tenant A's student!")
	}

	// 6. Setup Academic Cycle, Term, Grade, and Sections
	cycle := models.AcademicCycle{
		ID:        uuid.New(),
		TenantID:  tenantA.ID,
		Name:      "Semester 2026-A " + uuid.New().String()[:6],
		StartDate: time.Now(),
		EndDate:   time.Now().AddDate(0, 6, 0),
		IsCurrent: true,
		Status:    "active",
	}
	db.Create(&cycle)

	term := models.AcademicTerm{
		ID:              uuid.New(),
		TenantID:        tenantA.ID,
		AcademicCycleID: cycle.ID,
		Name:            "Term 1",
		TermOrder:       1,
		StartDate:       time.Now(),
		EndDate:         time.Now().AddDate(0, 3, 0),
		IsActive:        true,
	}
	db.Create(&term)

	prog := models.EducationalProgram{
		ID:          uuid.New(),
		TenantID:    tenantA.ID,
		Code:        "PROG-" + uuid.New().String()[:6],
		Name:        "Secondary Education",
		ProgramType: "k12",
	}
	db.Create(&prog)

	grade := models.StudyGrade{
		ID:                   uuid.New(),
		TenantID:             tenantA.ID,
		EducationalProgramID: prog.ID,
		Name:                 "Grade 11",
		GradeLevel:           11,
	}
	db.Create(&grade)

	section1 := models.ClassSection{
		ID:           uuid.New(),
		TenantID:     tenantA.ID,
		StudyGradeID: grade.ID,
		Name:         "Section 11-A",
		Capacity:     25,
	}
	db.Create(&section1)

	section2 := models.ClassSection{
		ID:           uuid.New(),
		TenantID:     tenantA.ID,
		StudyGradeID: grade.ID,
		Name:         "Section 11-B",
		Capacity:     25,
	}
	db.Create(&section2)

	// Section in Tenant B
	sectionB := models.ClassSection{
		ID:           uuid.New(),
		TenantID:     tenantB.ID,
		StudyGradeID: grade.ID, // DB foreign key will reject if composite, but let's test service layer
		Name:         "Section Tenant B",
		Capacity:     20,
	}
	_ = db.Create(&sectionB)

	// 7. Enrollment & Cross-Tenant Enrollment Check
	// Tenant B tries to enroll Tenant A's student
	_, errCrossEnroll := academicSvc.EnrollStudent(ctx, tenantB.ID, student.ID, term.ID, &section1.ID, nil)
	if errCrossEnroll == nil {
		t.Fatalf("SECURITY VIOLATION: AcademicService allowed Tenant B to enroll Tenant A's student!")
	}

	enrollment, err := academicSvc.EnrollStudent(ctx, tenantA.ID, student.ID, term.ID, &section1.ID, nil)
	if err != nil {
		t.Fatalf("academicSvc.EnrollStudent failed: %v", err)
	}
	if enrollment.ClassSectionID == nil || *enrollment.ClassSectionID != section1.ID {
		t.Fatalf("enrollment section mismatch")
	}

	// 8. Transfer Section with Audit & Cross-Tenant Section Check (Scenario 4)
	adminUserID := uuid.New()
	// Try transferring to section in Tenant B
	errCrossTransfer := academicSvc.TransferSection(ctx, tenantA.ID, enrollment.ID, sectionB.ID, adminUserID, "Illicit transfer")
	if errCrossTransfer == nil {
		t.Fatalf("SECURITY VIOLATION: AcademicService allowed transfer to section outside tenant!")
	}

	err = academicSvc.TransferSection(ctx, tenantA.ID, enrollment.ID, section2.ID, adminUserID, "Transferred upon parent request")
	if err != nil {
		t.Fatalf("academicSvc.TransferSection failed: %v", err)
	}

	var history models.EnrollmentStatusHistory
	if err := db.Where("enrollment_id = ? AND new_status = 'transferred'", enrollment.ID).First(&history).Error; err != nil {
		t.Fatalf("expected transfer history record, found none")
	}

	// 9. Assessment & Grades with Audit (Scenario 12)
	plan := models.AssessmentPlan{
		ID:                  uuid.New(),
		TenantID:            tenantA.ID,
		AdoptedCurriculumID: uuid.New(),
		AcademicTermID:      term.ID,
		Name:                "Grade 11 Mathematics Term 1",
		TotalMaxScore:       100.0,
		PassingScore:        50.0,
	}
	subj := models.Subject{ID: uuid.New(), TenantID: &tenantA.ID, Code: "MATH-" + uuid.New().String()[:4], Name: "Mathematics"}
	db.Create(&subj)
	def := models.CurriculumDefinition{ID: uuid.New(), SubjectID: subj.ID, Name: "Mathematics Syllabus"}
	db.Create(&def)
	ed := models.CurriculumEdition{ID: uuid.New(), CurriculumDefinitionID: def.ID, EditionName: "2026", YearPublished: 2026}
	db.Create(&ed)
	adopted := models.AdoptedCurriculum{ID: plan.AdoptedCurriculumID, TenantID: tenantA.ID, CurriculumEditionID: ed.ID, AcademicCycleID: cycle.ID}
	db.Create(&adopted)
	db.Create(&plan)

	examItem := models.AssessmentItem{
		ID:               uuid.New(),
		TenantID:         tenantA.ID,
		AssessmentPlanID: plan.ID,
		Title:            "Midterm Exam",
		ItemType:         "midterm_exam",
		MaxScore:         100.0,
		WeightPercentage: 40.0,
		AssessmentDate:   time.Now(),
	}
	db.Create(&examItem)

	// Cross-tenant Grade Submit: Tenant B submits grade for Tenant A's exam
	_, errCrossGrade := assessmentSvc.SubmitGrade(ctx, tenantB.ID, services.SubmitGradeRequest{
		AssessmentItemID: examItem.ID,
		StudentProfileID: student.ID,
		RawScore:         90.0,
		RecordedByUserID: adminUserID,
	})
	if errCrossGrade == nil {
		t.Fatalf("SECURITY VIOLATION: AssessmentService allowed Tenant B to submit grade for Tenant A's item!")
	}

	gradeRecord, err := assessmentSvc.SubmitGrade(ctx, tenantA.ID, services.SubmitGradeRequest{
		AssessmentItemID: examItem.ID,
		StudentProfileID: student.ID,
		RawScore:         75.0,
		RecordedByUserID: adminUserID,
	})
	if err != nil {
		t.Fatalf("assessmentSvc.SubmitGrade failed: %v", err)
	}

	// Revise grade from 75 to 82 with mandatory audit log
	refNum := "DEC-2026-402"
	err = assessmentSvc.ReviseGradeWithAudit(ctx, tenantA.ID, gradeRecord.ID, adminUserID, 82.0, "Re-evaluated Question 3 after student review", &refNum)
	if err != nil {
		t.Fatalf("assessmentSvc.ReviseGradeWithAudit failed: %v", err)
	}

	var auditLogs []models.GradeAuditLog
	db.Where("student_grade_record_id = ?", gradeRecord.ID).Find(&auditLogs)
	if len(auditLogs) == 0 {
		t.Fatalf("expected grade audit log to be created, found none")
	}
	if auditLogs[0].PreviousScore != 75.0 || auditLogs[0].NewScore != 82.0 {
		t.Fatalf("audit log scores mismatch: previous=%v, new=%v", auditLogs[0].PreviousScore, auditLogs[0].NewScore)
	}

	// 10. Finance: Accrual & Exact Decimals & Over-allocation & Cumulative Refund Caps
	// Cross-tenant accrual check: Tenant B tries to create accrual for Tenant A's student
	_, errCrossAccrual := financeSvc.CreateChargeAccrual(ctx, tenantB.ID, services.CreateChargeRequest{
		StudentProfileID: student.ID,
		ChargeType:       "tuition_installment",
		Description:      "Illicit charge",
		GrossAmount:      decimal.NewFromInt(100000),
		DueDate:          time.Now().AddDate(0, 1, 0),
	})
	if errCrossAccrual == nil {
		t.Fatalf("SECURITY VIOLATION: FinanceService allowed Tenant B to charge Tenant A's student!")
	}

	accrualAmount := decimal.NewFromInt(300000)
	accrual1, err := financeSvc.CreateChargeAccrual(ctx, tenantA.ID, services.CreateChargeRequest{
		StudentProfileID: student.ID,
		EnrollmentID:     &enrollment.ID,
		ChargeType:       "tuition_installment",
		Description:      "Term 1 Installment",
		GrossAmount:      accrualAmount,
		DueDate:          time.Now().AddDate(0, 1, 0),
	})
	if err != nil {
		t.Fatalf("financeSvc.CreateChargeAccrual failed: %v", err)
	}

	// Single payment allocating 300,000 to accrual1
	receiptNum := "PAY-REC-" + uuid.New().String()[:8]
	payment, err := financeSvc.CollectPaymentAndAllocate(ctx, tenantA.ID, services.CollectPaymentRequest{
		PayerPersonID: person.ID,
		ReceiptNumber: receiptNum,
		TotalAmount:   accrualAmount,
		PaymentMethod: "cash",
		CashierUserID: adminUserID,
		Allocations: []services.AllocationItem{
			{ChargeAccrualID: accrual1.ID, Amount: accrualAmount},
		},
	})
	if err != nil {
		t.Fatalf("financeSvc.CollectPaymentAndAllocate failed: %v", err)
	}

	// Verify accrual is paid with exact decimal
	var refreshedAccrual models.ChargeAccrual
	db.First(&refreshedAccrual, accrual1.ID)
	if refreshedAccrual.Status != "paid" || !refreshedAccrual.PaidAmount.Equal(accrualAmount) {
		t.Fatalf("expected accrual to be paid, got status=%s, paid=%s", refreshedAccrual.Status, refreshedAccrual.PaidAmount.String())
	}

	// 11. Partial refund 1: 50,000 IQD
	refundAmount1 := decimal.NewFromInt(50000)
	refundReceipt1 := "REF-" + uuid.New().String()[:8]
	refund1, err := financeSvc.ProcessRefund(ctx, tenantA.ID, services.ProcessRefundRequest{
		OriginalPaymentID:   payment.ID,
		ChargeAccrualID:     &accrual1.ID,
		RefundReceiptNumber: refundReceipt1,
		RefundAmount:        refundAmount1,
		RefundMethod:        "cash",
		Reason:              "Course discount applied post-payment",
		ApprovedByUserID:    adminUserID,
	})
	if err != nil {
		t.Fatalf("financeSvc.ProcessRefund 1 failed: %v", err)
	}
	if refund1.OriginalPaymentID != payment.ID {
		t.Fatalf("refund must link to original payment ID")
	}

	// Verify accrual adjusted: 300,000 - 50,000 = 250,000
	db.First(&refreshedAccrual, accrual1.ID)
	expectedPaid := decimal.NewFromInt(250000)
	if !refreshedAccrual.PaidAmount.Equal(expectedPaid) || refreshedAccrual.Status != "partially_paid" {
		t.Fatalf("expected accrual paid=%s, got %s (status=%s)", expectedPaid.String(), refreshedAccrual.PaidAmount.String(), refreshedAccrual.Status)
	}

	// Partial refund 2: 250,000 IQD (Total refunds now equal 300,000, exactly reaching the payment total)
	refundAmount2 := decimal.NewFromInt(250000)
	refundReceipt2 := "REF-" + uuid.New().String()[:8]
	_, err = financeSvc.ProcessRefund(ctx, tenantA.ID, services.ProcessRefundRequest{
		OriginalPaymentID:   payment.ID,
		ChargeAccrualID:     &accrual1.ID,
		RefundReceiptNumber: refundReceipt2,
		RefundAmount:        refundAmount2,
		RefundMethod:        "cash",
		Reason:              "Remaining refund upon course cancellation",
		ApprovedByUserID:    adminUserID,
	})
	if err != nil {
		t.Fatalf("financeSvc.ProcessRefund 2 failed: %v", err)
	}

	// Verify payment status changed to 'refunded'
	var refreshedPayment models.PaymentTransaction
	db.First(&refreshedPayment, payment.ID)
	if refreshedPayment.Status != "refunded" {
		t.Fatalf("expected payment status to be 'refunded', got %s", refreshedPayment.Status)
	}

	// 12. ADVERSARIAL REFUND TEST: Attempt to refund beyond the original payment limit
	// Total already refunded = 300,000. Any additional refund must be REJECTED!
	refundReceipt3 := "REF-" + uuid.New().String()[:8]
	_, errOverRefund := financeSvc.ProcessRefund(ctx, tenantA.ID, services.ProcessRefundRequest{
		OriginalPaymentID:   payment.ID,
		RefundReceiptNumber: refundReceipt3,
		RefundAmount:        decimal.NewFromInt(1000), // even 1,000 IQD must fail
		RefundMethod:        "cash",
		Reason:              "Fraudulent over-refund attempt",
		ApprovedByUserID:    adminUserID,
	})
	if errOverRefund == nil {
		t.Fatalf("FINANCIAL VULNERABILITY: Allowed refunding beyond total original payment amount!")
	}
	t.Logf("✅ Successfully verified that cumulative refund cap blocked over-refunding: %v", errOverRefund)

	t.Logf("✅ Successfully validated all Domain Services with strict tenant isolation and financial precision.")
}
