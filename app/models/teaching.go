package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TeacherAssignment represents the assignment of a teacher to a subject/curriculum and classroom/cohort.
type TeacherAssignment struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	TeacherProfileID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"teacher_profile_id"`
	AdoptedCurriculumID uuid.UUID      `gorm:"type:uuid;not null;index" json:"adopted_curriculum_id"`
	ClassSectionID      *uuid.UUID     `gorm:"type:uuid;index" json:"class_section_id,omitempty"`
	StudyCohortID       *uuid.UUID     `gorm:"type:uuid;index" json:"study_cohort_id,omitempty"`
	IsLeadTeacher       bool           `gorm:"not null;default:true" json:"is_lead_teacher"`
	StartDate           time.Time      `gorm:"not null" json:"start_date"`
	EndDate             *time.Time     `json:"end_date,omitempty"`
	Status              string         `gorm:"type:varchar(50);not null;default:'active'" json:"status"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	TeacherProfile    TeacherProfile    `gorm:"foreignKey:TeacherProfileID" json:"teacher_profile,omitempty"`
	AdoptedCurriculum AdoptedCurriculum `gorm:"foreignKey:AdoptedCurriculumID" json:"adopted_curriculum,omitempty"`
	ClassSection      *ClassSection     `gorm:"foreignKey:ClassSectionID" json:"class_section,omitempty"`
}

func (TeacherAssignment) TableName() string {
	return "teacher_assignments"
}

// PlannedScheduleSlot represents the weekly recurring timetable slot.
type PlannedScheduleSlot struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	TeacherAssignmentID uuid.UUID      `gorm:"type:uuid;not null;index" json:"teacher_assignment_id"`
	DayOfWeek           int            `gorm:"not null" json:"day_of_week"` // 0=Sunday, 1=Monday, etc.
	StartTime           string         `gorm:"type:varchar(10);not null" json:"start_time"` // "08:30"
	EndTime             string         `gorm:"type:varchar(10);not null" json:"end_time"`   // "09:15"
	RoomNumber          *string        `gorm:"type:varchar(50)" json:"room_number,omitempty"`
	IsActive            bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	Assignment TeacherAssignment `gorm:"foreignKey:TeacherAssignmentID" json:"assignment,omitempty"`
}

func (PlannedScheduleSlot) TableName() string {
	return "planned_schedule_slots"
}

// ActualClassSession represents the real-world execution of a teaching session.
type ActualClassSession struct {
	ID                    uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID              uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	PlannedScheduleSlotID *uuid.UUID `gorm:"type:uuid;index" json:"planned_schedule_slot_id,omitempty"`
	TeacherAssignmentID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"teacher_assignment_id"`
	SubstituteTeacherID   *uuid.UUID `gorm:"type:uuid;index" json:"substitute_teacher_id,omitempty"`
	SessionDate           time.Time  `gorm:"not null;index" json:"session_date"`
	ActualStartTime       time.Time  `gorm:"not null" json:"actual_start_time"`
	ActualEndTime         time.Time  `gorm:"not null" json:"actual_end_time"`
	Status                string     `gorm:"type:varchar(50);not null;default:'completed'" json:"status"` // scheduled, in_progress, completed, cancelled, rescheduled_makeup
	CancellationReason    *string    `gorm:"type:text" json:"cancellation_reason,omitempty"`
	LessonTopicDelivered  *string    `gorm:"type:varchar(255)" json:"lesson_topic_delivered,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`

	TeacherAssignment TeacherAssignment `gorm:"foreignKey:TeacherAssignmentID" json:"teacher_assignment,omitempty"`
}

func (ActualClassSession) TableName() string {
	return "actual_class_sessions"
}
