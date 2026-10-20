package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Department represents an organizational unit within an institution or branch.
type Department struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID       uuid.UUID      `gorm:"type:uuid;not null;index:idx_dept_tenant_code,unique" json:"tenant_id"`
	BranchID       *uuid.UUID     `gorm:"type:uuid;index" json:"branch_id,omitempty"`
	Code           string         `gorm:"type:varchar(50);not null;index:idx_dept_tenant_code,unique" json:"code"`
	Name           string         `gorm:"type:varchar(150);not null" json:"name"`
	ManagerStaffID *uuid.UUID     `gorm:"type:uuid;index" json:"manager_staff_id,omitempty"`
	IsActive       bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (Department) TableName() string {
	return "departments"
}

// Position represents a configurable job position/title within an institution.
type Position struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID     uuid.UUID      `gorm:"type:uuid;not null;index:idx_pos_tenant_code,unique" json:"tenant_id"`
	Code         string         `gorm:"type:varchar(50);not null;index:idx_pos_tenant_code,unique" json:"code"`
	Title        string         `gorm:"type:varchar(150);not null" json:"title"`
	IsManagerial bool           `gorm:"not null;default:false" json:"is_managerial"`
	IsActive     bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (Position) TableName() string {
	return "positions"
}

// StaffProfile represents an administrative/general employment record for a Person within an institution.
type StaffProfile struct {
	ID                   uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"type:uuid;not null;index:idx_staff_tenant_person,unique" json:"tenant_id"`
	PersonID             uuid.UUID      `gorm:"type:uuid;not null;index:idx_staff_tenant_person,unique" json:"person_id"`
	StaffNumber          string         `gorm:"type:varchar(50);not null;index:idx_staff_tenant_num,unique" json:"staff_number"`
	EmploymentStatus     string         `gorm:"type:varchar(50);not null;default:'active';index" json:"employment_status"` // active, probation, suspended, terminated, on_leave
	HireDate             time.Time      `gorm:"type:date;not null" json:"hire_date"`
	TerminationDate      *time.Time     `gorm:"type:date" json:"termination_date,omitempty"`
	PrimaryBranchID      *uuid.UUID     `gorm:"type:uuid;index" json:"primary_branch_id,omitempty"`
	DirectManagerStaffID *uuid.UUID     `gorm:"type:uuid;index" json:"direct_manager_staff_id,omitempty"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`

	Person        Person         `gorm:"foreignKey:PersonID" json:"person,omitempty"`
	Tenant        *Tenant        `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	DirectManager *StaffProfile  `gorm:"foreignKey:DirectManagerStaffID" json:"direct_manager,omitempty"`
	Assignments   []PositionAssignment `gorm:"foreignKey:StaffProfileID" json:"assignments,omitempty"`
}

func (StaffProfile) TableName() string {
	return "staff_profiles"
}

// PositionAssignment links a StaffProfile to a specific Position and Department while preserving history.
type PositionAssignment struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StaffProfileID uuid.UUID      `gorm:"type:uuid;not null;index" json:"staff_profile_id"`
	PositionID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"position_id"`
	DepartmentID   *uuid.UUID     `gorm:"type:uuid;index" json:"department_id,omitempty"`
	AssignmentType string         `gorm:"type:varchar(50);not null;default:'primary'" json:"assignment_type"` // primary, acting, concurrent, honorary
	IsPrimary      bool           `gorm:"not null;default:true" json:"is_primary"`
	StartDate      time.Time      `gorm:"type:date;not null" json:"start_date"`
	EndDate        *time.Time     `gorm:"type:date" json:"end_date,omitempty"`
	Status         string         `gorm:"type:varchar(50);not null;default:'active';index" json:"status"` // active, ended, superseded
	Notes          *string        `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
	Position     Position     `gorm:"foreignKey:PositionID" json:"position,omitempty"`
	Department   *Department  `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
}

func (PositionAssignment) TableName() string {
	return "position_assignments"
}
