package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrStaffAttendanceNotFound = errors.New("staff attendance record not found")
	ErrLeaveRequestNotFound    = errors.New("leave request not found")
	ErrInvalidLeaveDates       = errors.New("leave end_date must be greater than or equal to start_date")
	ErrOverlappingLeave        = errors.New("staff member already has an approved or pending leave covering these dates")
	ErrMissingCorrectionReason = errors.New("a documented correction reason is required to adjust attendance")
)

type StaffAttendanceService struct {
	db *gorm.DB
}

func NewStaffAttendanceService(db *gorm.DB) *StaffAttendanceService {
	return &StaffAttendanceService{db: db}
}

// RecordStaffAttendanceRequest holds input to log staff attendance.
type RecordStaffAttendanceRequest struct {
	StaffProfileID uuid.UUID  `json:"staff_profile_id"`
	AttendanceDate time.Time  `json:"attendance_date"`
	CheckInTime    *time.Time `json:"check_in_time,omitempty"`
	CheckOutTime   *time.Time `json:"check_out_time,omitempty"`
	Status         string     `json:"status"` // present, late, absent, excused
	LateMinutes    int        `json:"late_minutes"`
	Notes          *string    `json:"notes,omitempty"`
}

func (s *StaffAttendanceService) RecordStaffAttendance(ctx context.Context, tenantID uuid.UUID, req RecordStaffAttendanceRequest) (*models.StaffAttendanceRecord, error) {
	if req.StaffProfileID == uuid.Nil {
		return nil, errors.New("staff_profile_id is required")
	}
	if req.AttendanceDate.IsZero() {
		req.AttendanceDate = time.Now()
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "present"
	}

	// Verify Staff belongs to Tenant
	var staff models.StaffProfile
	if err := s.db.WithContext(ctx).First(&staff, "id = ? AND tenant_id = ?", req.StaffProfileID, tenantID).Error; err != nil {
		return nil, ErrStaffNotFound
	}

	record := models.StaffAttendanceRecord{
		TenantID:       tenantID,
		StaffProfileID: req.StaffProfileID,
		AttendanceDate: req.AttendanceDate,
		CheckInTime:    req.CheckInTime,
		CheckOutTime:   req.CheckOutTime,
		Status:         status,
		LateMinutes:    req.LateMinutes,
		Notes:          req.Notes,
		IsCorrected:    false,
	}

	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		if strings.Contains(err.Error(), "uq_staff_attendance_day") {
			return nil, errors.New("attendance already recorded for this staff member on this date")
		}
		return nil, err
	}

	return &record, nil
}

// CorrectAttendanceRequest holds payload to revise a recorded attendance with audit reason.
type CorrectAttendanceRequest struct {
	Status           string     `json:"status"`
	CheckInTime      *time.Time `json:"check_in_time,omitempty"`
	CheckOutTime     *time.Time `json:"check_out_time,omitempty"`
	LateMinutes      int        `json:"late_minutes"`
	CorrectionReason string     `json:"correction_reason"`
}

func (s *StaffAttendanceService) CorrectStaffAttendance(ctx context.Context, tenantID, recordID, correctedByUserID uuid.UUID, req CorrectAttendanceRequest) (*models.StaffAttendanceRecord, error) {
	reason := strings.TrimSpace(req.CorrectionReason)
	if reason == "" {
		return nil, ErrMissingCorrectionReason
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "present"
	}

	var record models.StaffAttendanceRecord
	if err := s.db.WithContext(ctx).First(&record, "id = ? AND tenant_id = ?", recordID, tenantID).Error; err != nil {
		return nil, ErrStaffAttendanceNotFound
	}

	updates := map[string]interface{}{
		"status":                status,
		"check_in_time":         req.CheckInTime,
		"check_out_time":        req.CheckOutTime,
		"late_minutes":          req.LateMinutes,
		"is_corrected":          true,
		"correction_reason":     reason,
		"corrected_by_user_id":  correctedByUserID,
		"updated_at":            time.Now(),
	}

	if err := s.db.WithContext(ctx).Model(&record).Updates(updates).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).First(&record, "id = ?", recordID).Error; err != nil {
		return nil, err
	}

	return &record, nil
}

// SubmitLeaveRequest holds payload to request time off.
type SubmitLeaveRequest struct {
	StaffProfileID uuid.UUID `json:"staff_profile_id"`
	LeaveType      string    `json:"leave_type"` // annual, sick, emergency, unpaid
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
	Reason         string    `json:"reason"`
}

func (s *StaffAttendanceService) SubmitLeaveRequest(ctx context.Context, tenantID uuid.UUID, req SubmitLeaveRequest) (*models.StaffLeaveRequest, error) {
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, errors.New("leave reason is required")
	}
	if req.StartDate.IsZero() || req.EndDate.IsZero() {
		return nil, errors.New("start_date and end_date are required")
	}
	if req.EndDate.Before(req.StartDate) {
		return nil, ErrInvalidLeaveDates
	}

	// Verify Staff belongs to Tenant
	var staff models.StaffProfile
	if err := s.db.WithContext(ctx).First(&staff, "id = ? AND tenant_id = ?", req.StaffProfileID, tenantID).Error; err != nil {
		return nil, ErrStaffNotFound
	}

	// Prevent Overlapping approved or pending leaves
	var overlapCount int64
	err := s.db.WithContext(ctx).Model(&models.StaffLeaveRequest{}).
		Where("tenant_id = ? AND staff_profile_id = ? AND status IN ('pending', 'approved')", tenantID, req.StaffProfileID).
		Where("start_date <= ? AND end_date >= ?", req.EndDate, req.StartDate).
		Count(&overlapCount).Error
	if err != nil {
		return nil, err
	}
	if overlapCount > 0 {
		return nil, ErrOverlappingLeave
	}

	days := int(req.EndDate.Sub(req.StartDate).Hours()/24) + 1
	if days < 1 {
		days = 1
	}

	leave := models.StaffLeaveRequest{
		TenantID:       tenantID,
		StaffProfileID: req.StaffProfileID,
		LeaveType:      req.LeaveType,
		StartDate:      req.StartDate,
		EndDate:        req.EndDate,
		DaysCount:      days,
		Reason:         reason,
		Status:         "pending",
	}

	if err := s.db.WithContext(ctx).Create(&leave).Error; err != nil {
		return nil, err
	}

	return &leave, nil
}

// ReviewLeaveRequest approves or rejects a leave request with audit trail.
func (s *StaffAttendanceService) ReviewLeaveRequest(ctx context.Context, tenantID, requestID, reviewerUserID uuid.UUID, approve bool, notes string) (*models.StaffLeaveRequest, error) {
	var leave models.StaffLeaveRequest
	if err := s.db.WithContext(ctx).First(&leave, "id = ? AND tenant_id = ? AND status = 'pending'", requestID, tenantID).Error; err != nil {
		return nil, ErrLeaveRequestNotFound
	}

	now := time.Now()
	newStatus := "rejected"
	if approve {
		newStatus = "approved"
	}

	updates := map[string]interface{}{
		"status":              newStatus,
		"reviewed_by_user_id": reviewerUserID,
		"reviewed_at":         now,
		"review_notes":        strings.TrimSpace(notes),
		"updated_at":          now,
	}

	if err := s.db.WithContext(ctx).Model(&leave).Updates(updates).Error; err != nil {
		return nil, err
	}

	leave.Status = newStatus
	leave.ReviewedByUserID = &reviewerUserID
	leave.ReviewedAt = &now
	n := strings.TrimSpace(notes)
	leave.ReviewNotes = &n

	return &leave, nil
}
