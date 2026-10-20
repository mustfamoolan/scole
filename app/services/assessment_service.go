package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrGradeNotFound      = errors.New("grade record not found in this tenant")
	ErrSessionNotFound    = errors.New("actual class session not found in this tenant")
	ErrAssessmentNotFound = errors.New("assessment item not found in this tenant")
	ErrScoreOutOfRange    = errors.New("score cannot exceed maximum allowed score for this assessment item")
	ErrMissingAuditReason = errors.New("a formal reason and administrative reference are required to revise an approved grade")
)

type AssessmentService struct {
	db *gorm.DB
}

func NewAssessmentService(db *gorm.DB) *AssessmentService {
	return &AssessmentService{db: db}
}

type RecordAttendanceRequest struct {
	StudentProfileID uuid.UUID `json:"student_profile_id"`
	ActualSessionID  uuid.UUID `json:"actual_session_id"`
	RecordDate       time.Time `json:"record_date"`
	Status           string    `json:"status"` // present, absent_unexcused, absent_excused, late, left_early
	MinutesLate      int       `json:"minutes_late"`
	ExcuseDocument   *string   `json:"excuse_document,omitempty"`
	ExcuseNotes      *string   `json:"excuse_notes,omitempty"`
	RecordedByUserID uuid.UUID `json:"recorded_by_user_id"`
}

// RecordAttendance saves attendance for a student session after verifying tenant ownership of both student and session.
func (s *AssessmentService) RecordAttendance(ctx context.Context, tenantID uuid.UUID, req RecordAttendanceRequest) (*models.AttendanceRecord, error) {
	// 1. Verify student profile belongs to this tenant
	var student models.StudentProfile
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, req.StudentProfileID).First(&student).Error; err != nil {
		return nil, ErrStudentNotFound
	}

	// 2. Verify actual session belongs to this tenant
	var session models.ActualClassSession
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, req.ActualSessionID).First(&session).Error; err != nil {
		return nil, ErrSessionNotFound
	}

	record := models.AttendanceRecord{
		ID:               uuid.New(),
		TenantID:         tenantID,
		StudentProfileID: req.StudentProfileID,
		ActualSessionID:  req.ActualSessionID,
		RecordDate:       req.RecordDate,
		Status:           req.Status,
		MinutesLate:      req.MinutesLate,
		ExcuseDocument:   req.ExcuseDocument,
		ExcuseNotes:      req.ExcuseNotes,
		RecordedByUserID: req.RecordedByUserID,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return nil, fmt.Errorf("failed to record attendance: %w", err)
	}

	return &record, nil
}

type SubmitGradeRequest struct {
	AssessmentItemID uuid.UUID  `json:"assessment_item_id"`
	StudentProfileID uuid.UUID  `json:"student_profile_id"`
	RawScore         float64    `json:"raw_score"`
	GradeLetter      *string    `json:"grade_letter,omitempty"`
	IsAbsent         bool       `json:"is_absent"`
	IsExcused        bool       `json:"is_excused"`
	RecordedByUserID uuid.UUID  `json:"recorded_by_user_id"`
	ApprovedByUserID *uuid.UUID `json:"approved_by_user_id,omitempty"`
}

// SubmitGrade stores the primary grade entry for a student after verifying item and student tenant ownership.
func (s *AssessmentService) SubmitGrade(ctx context.Context, tenantID uuid.UUID, req SubmitGradeRequest) (*models.StudentGradeRecord, error) {
	// 1. Verify assessment item belongs to this tenant
	var item models.AssessmentItem
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, req.AssessmentItemID).First(&item).Error; err != nil {
		return nil, ErrAssessmentNotFound
	}

	// 2. Verify student profile belongs to this tenant
	var student models.StudentProfile
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, req.StudentProfileID).First(&student).Error; err != nil {
		return nil, ErrStudentNotFound
	}

	if req.RawScore > item.MaxScore {
		return nil, ErrScoreOutOfRange
	}

	status := "submitted"
	if req.ApprovedByUserID != nil {
		status = "approved"
	}

	grade := models.StudentGradeRecord{
		ID:               uuid.New(),
		TenantID:         tenantID,
		AssessmentItemID: req.AssessmentItemID,
		StudentProfileID: req.StudentProfileID,
		RawScore:         req.RawScore,
		FinalScore:       req.RawScore,
		GradeLetter:      req.GradeLetter,
		IsAbsent:         req.IsAbsent,
		IsExcused:        req.IsExcused,
		Status:           status,
		RecordedByUserID: req.RecordedByUserID,
		ApprovedByUserID: req.ApprovedByUserID,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(&grade).Error; err != nil {
		return nil, fmt.Errorf("failed to record grade: %w", err)
	}

	return &grade, nil
}

// ReviseGradeWithAudit corrects an already submitted/approved grade while creating an immutable audit entry.
func (s *AssessmentService) ReviseGradeWithAudit(ctx context.Context, tenantID, gradeRecordID, modifiedByUserID uuid.UUID, newScore float64, reason string, refNumber *string) error {
	if reason == "" {
		return ErrMissingAuditReason
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var grade models.StudentGradeRecord
		if err := tx.Where("tenant_id = ? AND id = ?", tenantID, gradeRecordID).First(&grade).Error; err != nil {
			return ErrGradeNotFound
		}

		// Create audit log
		audit := models.GradeAuditLog{
			ID:                   uuid.New(),
			TenantID:             tenantID,
			StudentGradeRecordID: gradeRecordID,
			PreviousScore:        grade.FinalScore,
			NewScore:             newScore,
			ChangeReason:         reason,
			ApprovedRefNumber:    refNumber,
			ModifiedByUserID:     modifiedByUserID,
			ModifiedAt:           time.Now(),
		}
		if err := tx.Create(&audit).Error; err != nil {
			return fmt.Errorf("failed to create grade audit log: %w", err)
		}

		// Update grade
		if err := tx.Model(&grade).Updates(map[string]interface{}{
			"final_score": newScore,
			"status":      "revised",
			"updated_at":  time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("failed to update student grade record: %w", err)
		}

		return nil
	})
}
