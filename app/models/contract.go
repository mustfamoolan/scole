package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// EmploymentContract represents the formal terms of work and compensation between tenant and staff member.
type EmploymentContract struct {
	ID                 uuid.UUID        `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID        `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StaffProfileID     uuid.UUID        `gorm:"type:uuid;not null;index" json:"staff_profile_id"`
	ContractNumber     string           `gorm:"type:varchar(100);not null;index:idx_contract_tenant_num,unique" json:"contract_number"`
	ContractType       string           `gorm:"type:varchar(50);not null" json:"contract_type"` // full_time, part_time, per_session, contractor, temporary
	BaseSalary         *decimal.Decimal `gorm:"type:numeric(15,4)" json:"base_salary,omitempty"`
	HourlyRate         *decimal.Decimal `gorm:"type:numeric(15,4)" json:"hourly_rate,omitempty"`
	DefaultSessionRate *decimal.Decimal `gorm:"type:numeric(15,4)" json:"default_session_rate,omitempty"`
	Currency           string           `gorm:"type:varchar(10);not null;default:'IQD'" json:"currency"`
	StartDate          time.Time        `gorm:"type:date;not null" json:"start_date"`
	EndDate            *time.Time       `gorm:"type:date" json:"end_date,omitempty"`
	Status             string           `gorm:"type:varchar(50);not null;default:'active';index" json:"status"` // draft, active, renewed, terminated, expired
	SignedAt           *time.Time       `json:"signed_at,omitempty"`
	TermsSummary       *string          `gorm:"type:text" json:"terms_summary,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
	DeletedAt          gorm.DeletedAt   `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
	Tenant       *Tenant      `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (EmploymentContract) TableName() string {
	return "employment_contracts"
}

// StaffQualification represents formal educational degrees, certifications, or professional licenses.
type StaffQualification struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID          uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StaffProfileID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"staff_profile_id"`
	QualificationType string         `gorm:"type:varchar(50);not null" json:"qualification_type"` // bachelor, master, phd, diploma, certificate, teaching_license
	Title             string         `gorm:"type:varchar(200);not null" json:"title"`
	InstitutionName   string         `gorm:"type:varchar(200);not null" json:"institution_name"`
	GraduationYear    *int           `json:"graduation_year,omitempty"`
	DocumentURL       *string        `gorm:"type:varchar(500)" json:"document_url,omitempty"`
	IsVerified        bool           `gorm:"not null;default:false" json:"is_verified"`
	VerifiedAt        *time.Time     `json:"verified_at,omitempty"`
	VerifiedByUserID  *uuid.UUID     `gorm:"type:uuid" json:"verified_by_user_id,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
}

func (StaffQualification) TableName() string {
	return "staff_qualifications"
}

// StaffDocument represents confidential personnel records and attachments with access restriction markers.
type StaffDocument struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StaffProfileID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"staff_profile_id"`
	DocumentCategory string         `gorm:"type:varchar(50);not null" json:"document_category"` // identity, contract_scan, credential, clearance, medical, other
	Title            string         `gorm:"type:varchar(200);not null" json:"title"`
	FileURL          string         `gorm:"type:varchar(500);not null" json:"file_url"`
	FileSizeBytes    *int64         `json:"file_size_bytes,omitempty"`
	MimeType         *string        `gorm:"type:varchar(100)" json:"mime_type,omitempty"`
	IsConfidential   bool           `gorm:"not null;default:true" json:"is_confidential"`
	ExpiresAt        *time.Time     `gorm:"type:date;index" json:"expires_at,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfile StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
}

func (StaffDocument) TableName() string {
	return "staff_documents"
}
