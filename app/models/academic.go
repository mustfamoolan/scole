package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AcademicCycle represents an academic year or high-level operational cycle.
type AcademicCycle struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID  uuid.UUID      `gorm:"type:uuid;not null;index:idx_cycle_tenant_name,unique" json:"tenant_id"`
	Name      string         `gorm:"type:varchar(100);not null;index:idx_cycle_tenant_name,unique" json:"name"` // e.g. "2026-2027"
	StartDate time.Time      `gorm:"not null" json:"start_date"`
	EndDate   time.Time      `gorm:"not null" json:"end_date"`
	IsCurrent bool           `gorm:"not null;default:false" json:"is_current"`
	Status    string         `gorm:"type:varchar(50);not null;default:'planned'" json:"status"` // planned, active, closed
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Terms []AcademicTerm `gorm:"foreignKey:AcademicCycleID" json:"terms,omitempty"`
}

func (AcademicCycle) TableName() string {
	return "academic_cycles"
}

// AcademicTerm represents a semester, trimester, or term period.
type AcademicTerm struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	AcademicCycleID uuid.UUID      `gorm:"type:uuid;not null;index" json:"academic_cycle_id"`
	Name            string         `gorm:"type:varchar(100);not null" json:"name"` // e.g. "Fall 2026", "Spring 2027"
	TermOrder       int            `gorm:"not null;default:1" json:"term_order"`
	StartDate       time.Time      `gorm:"not null" json:"start_date"`
	EndDate         time.Time      `gorm:"not null" json:"end_date"`
	IsActive        bool           `gorm:"not null;default:false" json:"is_active"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Cycle AcademicCycle `gorm:"foreignKey:AcademicCycleID" json:"cycle,omitempty"`
}

func (AcademicTerm) TableName() string {
	return "academic_terms"
}

// EducationalProgram represents a curriculum track, educational stage, or diploma program.
type EducationalProgram struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index:idx_program_tenant_code,unique" json:"tenant_id"`
	Code        string         `gorm:"type:varchar(50);not null;index:idx_program_tenant_code,unique" json:"code"`
	Name        string         `gorm:"type:varchar(150);not null" json:"name"` // e.g. "Primary Stage", "English Intensive", "High School"
	ProgramType string         `gorm:"type:varchar(50);not null" json:"program_type"` // k12, language_course, vocational, private_tutoring
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	IsActive    bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Grades  []StudyGrade  `gorm:"foreignKey:EducationalProgramID" json:"grades,omitempty"`
	Cohorts []StudyCohort `gorm:"foreignKey:EducationalProgramID" json:"cohorts,omitempty"`
}

func (EducationalProgram) TableName() string {
	return "educational_programs"
}

// StudyGrade represents a class level / grade within a program (e.g. "Grade 1", "Level A1").
type StudyGrade struct {
	ID                   uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	EducationalProgramID uuid.UUID      `gorm:"type:uuid;not null;index" json:"educational_program_id"`
	Name                 string         `gorm:"type:varchar(100);not null" json:"name"`
	GradeLevel           int            `gorm:"not null;default:1" json:"grade_level"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`

	Sections []ClassSection `gorm:"foreignKey:StudyGradeID" json:"sections,omitempty"`
	EducationalProgram EducationalProgram `gorm:"foreignKey:EducationalProgramID" json:"educational_program,omitempty"`
}

func (StudyGrade) TableName() string {
	return "study_grades"
}

// ClassSection represents a physical or operational classroom section (e.g. "Section A", "Room 101").
type ClassSection struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudyGradeID uuid.UUID      `gorm:"type:uuid;not null;index" json:"study_grade_id"`
	Name         string         `gorm:"type:varchar(50);not null" json:"name"` // e.g. "A", "B", "1/1"
	Capacity     int            `gorm:"not null;default:30" json:"capacity"`
	RoomNumber   *string        `gorm:"type:varchar(50)" json:"room_number,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ClassSection) TableName() string {
	return "class_sections"
}

// StudyCohort represents a training group or institute batch.
type StudyCohort struct {
	ID                   uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	EducationalProgramID uuid.UUID      `gorm:"type:uuid;not null;index" json:"educational_program_id"`
	Name                 string         `gorm:"type:varchar(100);not null" json:"name"` // e.g. "Batch Jan 2026 - Evening"
	MaxCapacity          int            `gorm:"not null;default:20" json:"max_capacity"`
	StartDate            *time.Time     `json:"start_date,omitempty"`
	EndDate              *time.Time     `json:"end_date,omitempty"`
	Status               string         `gorm:"type:varchar(50);not null;default:'open'" json:"status"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

func (StudyCohort) TableName() string {
	return "study_cohorts"
}

// AcademicEnrollment records a student's official enrollment in a section, cohort, or term.
type AcademicEnrollment struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID uuid.UUID  `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	AcademicTermID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"academic_term_id"`
	ClassSectionID   *uuid.UUID `gorm:"type:uuid;index" json:"class_section_id,omitempty"`
	StudyCohortID    *uuid.UUID `gorm:"type:uuid;index" json:"study_cohort_id,omitempty"`
	EnrollmentDate   time.Time  `gorm:"not null" json:"enrollment_date"`
	EnrollmentType   string     `gorm:"type:varchar(50);not null;default:'standard'" json:"enrollment_type"` // standard, transfer, repeating
	Status           string     `gorm:"type:varchar(50);not null;default:'active';index" json:"status"`      // active, transferred, withdrawn, completed, failed
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	StudentProfile StudentProfile `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
	AcademicTerm   AcademicTerm   `gorm:"foreignKey:AcademicTermID" json:"academic_term,omitempty"`
	ClassSection   *ClassSection  `gorm:"foreignKey:ClassSectionID" json:"class_section,omitempty"`
	StudyCohort    *StudyCohort   `gorm:"foreignKey:StudyCohortID" json:"study_cohort,omitempty"`
}

func (AcademicEnrollment) TableName() string {
	return "academic_enrollments"
}

// EnrollmentStatusHistory provides audit trail for transitions (transfers, withdrawals).
type EnrollmentStatusHistory struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID       uuid.UUID `gorm:"type:uuid;not null;index" json:"tenant_id"`
	EnrollmentID   uuid.UUID `gorm:"type:uuid;not null;index" json:"enrollment_id"`
	PreviousStatus string    `gorm:"type:varchar(50);not null" json:"previous_status"`
	NewStatus      string    `gorm:"type:varchar(50);not null" json:"new_status"`
	Reason         string    `gorm:"type:text;not null" json:"reason"`
	ChangedBy      uuid.UUID `gorm:"type:uuid;not null" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (EnrollmentStatusHistory) TableName() string {
	return "enrollment_status_histories"
}
