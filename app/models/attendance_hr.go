package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StaffAttendanceRecord represents institutional daily attendance and punctuality for staff members.
type StaffAttendanceRecord struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID      `gorm:"type:uuid;not null;index:idx_staff_att_unique,unique" json:"tenant_id"`
	StaffProfileID     uuid.UUID      `gorm:"type:uuid;not null;index:idx_staff_att_unique,unique" json:"staff_profile_id"`
	AttendanceDate     time.Time      `gorm:"type:date;not null;index:idx_staff_att_unique,unique" json:"attendance_date"`
	CheckInTime        *time.Time     `json:"check_in_time,omitempty"`
	CheckOutTime       *time.Time     `json:"check_out_time,omitempty"`
	Status             string         `gorm:"type:varchar(50);not null;default:'present';index" json:"status"` // present, late, absent, on_leave, excused
	LateMinutes        int            `gorm:"not null;default:0" json:"late_minutes"`
	Notes              *string        `gorm:"type:text" json:"notes,omitempty"`
	IsCorrected        bool           `gorm:"not null;default:false" json:"is_corrected"`
	CorrectionReason   *string        `gorm:"type:text" json:"correction_reason,omitempty"`
	CorrectedByUserID  *uuid.UUID     `gorm:"type:uuid" json:"corrected_by_user_id,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
}

func (StaffAttendanceRecord) TableName() string {
	return "staff_attendance_records"
}

// StaffLeaveRequest represents a formal employee time-off request requiring administrative review.
type StaffLeaveRequest struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StaffProfileID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"staff_profile_id"`
	LeaveType        string         `gorm:"type:varchar(50);not null" json:"leave_type"` // annual, sick, emergency, unpaid, maternity, paternity
	StartDate        time.Time      `gorm:"type:date;not null" json:"start_date"`
	EndDate          time.Time      `gorm:"type:date;not null" json:"end_date"`
	DaysCount        int            `gorm:"not null;default:1" json:"days_count"`
	Reason           string         `gorm:"type:text;not null" json:"reason"`
	Status           string         `gorm:"type:varchar(50);not null;default:'pending';index" json:"status"` // pending, approved, rejected, cancelled
	ReviewedByUserID *uuid.UUID     `gorm:"type:uuid" json:"reviewed_by_user_id,omitempty"`
	ReviewedAt       *time.Time     `json:"reviewed_at,omitempty"`
	ReviewNotes      *string        `gorm:"type:text" json:"review_notes,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
}

func (StaffLeaveRequest) TableName() string {
	return "staff_leave_requests"
}
