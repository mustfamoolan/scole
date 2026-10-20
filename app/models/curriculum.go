package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Subject represents an educational discipline (e.g. "Mathematics", "English", "Physics").
type Subject struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID    *uuid.UUID     `gorm:"type:uuid;index" json:"tenant_id,omitempty"` // null if standard/national subject
	Code        string         `gorm:"type:varchar(50);not null;index" json:"code"`
	Name        string         `gorm:"type:varchar(150);not null" json:"name"`
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Subject) TableName() string {
	return "subjects"
}

// CurriculumDefinition represents the overarching curriculum reference (e.g. "National Iraqi Curriculum - Math 3").
type CurriculumDefinition struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID    *uuid.UUID     `gorm:"type:uuid;index" json:"tenant_id,omitempty"` // null if ministry-wide template
	SubjectID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"subject_id"`
	Name        string         `gorm:"type:varchar(200);not null" json:"name"`
	Publisher   *string        `gorm:"type:varchar(150)" json:"publisher,omitempty"` // e.g. "Ministry of Education", "Oxford University Press"
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Subject  Subject             `gorm:"foreignKey:SubjectID" json:"subject,omitempty"`
	Editions []CurriculumEdition `gorm:"foreignKey:CurriculumDefinitionID" json:"editions,omitempty"`
}

func (CurriculumDefinition) TableName() string {
	return "curriculum_definitions"
}

// CurriculumEdition represents an immutable published version (e.g. "Edition 2025", "Edition 2026").
type CurriculumEdition struct {
	ID                     uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CurriculumDefinitionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"curriculum_definition_id"`
	EditionName            string         `gorm:"type:varchar(100);not null" json:"edition_name"` // "2026 Revised"
	YearPublished          int            `gorm:"not null" json:"year_published"`
	Status                 string         `gorm:"type:varchar(50);not null;default:'active'" json:"status"` // draft, active, deprecated
	TotalTeachingHours     int            `gorm:"not null;default:60" json:"total_teaching_hours"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`

	Definition CurriculumDefinition `gorm:"foreignKey:CurriculumDefinitionID" json:"definition,omitempty"`
	Books      []BookEdition        `gorm:"foreignKey:CurriculumEditionID" json:"books,omitempty"`
}

func (CurriculumEdition) TableName() string {
	return "curriculum_editions"
}

// AdoptedCurriculum binds an immutable curriculum edition to a specific Tenant, Grade/Program, and Cycle.
type AdoptedCurriculum struct {
	ID                  uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID `gorm:"type:uuid;not null;index" json:"tenant_id"`
	CurriculumEditionID uuid.UUID `gorm:"type:uuid;not null;index" json:"curriculum_edition_id"`
	StudyGradeID        *uuid.UUID `gorm:"type:uuid;index" json:"study_grade_id,omitempty"`
	StudyCohortID       *uuid.UUID `gorm:"type:uuid;index" json:"study_cohort_id,omitempty"`
	AcademicCycleID     uuid.UUID `gorm:"type:uuid;not null;index" json:"academic_cycle_id"`
	WeeklySessionsCount int       `gorm:"not null;default:4" json:"weekly_sessions_count"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`

	CurriculumEdition CurriculumEdition `gorm:"foreignKey:CurriculumEditionID" json:"curriculum_edition,omitempty"`
	StudyGrade        *StudyGrade       `gorm:"foreignKey:StudyGradeID" json:"study_grade,omitempty"`
	StudyCohort       *StudyCohort      `gorm:"foreignKey:StudyCohortID" json:"study_cohort,omitempty"`
}

func (AdoptedCurriculum) TableName() string {
	return "adopted_curricula"
}

// BookEdition represents the required physical or digital book edition.
type BookEdition struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CurriculumEditionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"curriculum_edition_id"`
	Title               string         `gorm:"type:varchar(255);not null" json:"title"`
	ISBN                *string        `gorm:"type:varchar(50)" json:"isbn,omitempty"`
	Authors             *string        `gorm:"type:varchar(255)" json:"authors,omitempty"`
	DigitalURL          *string        `gorm:"type:varchar(500)" json:"digital_url,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BookEdition) TableName() string {
	return "book_editions"
}
