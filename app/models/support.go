package models

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// LandingInquiry represents a contact, consultation, or booking request from the public Landing Page.
type LandingInquiry struct {
	ID                uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	FullName          string     `gorm:"type:varchar(150);not null" json:"full_name"`
	Phone             string     `gorm:"type:varchar(50);not null" json:"phone"`
	InstituteName     string     `gorm:"type:varchar(150);not null" json:"institute_name"`
	RequestType       string     `gorm:"type:varchar(50);not null;default:'consultation'" json:"request_type"` // consultation, booking, demo
	Notes             string     `gorm:"type:text" json:"notes,omitempty"`
	Status            string     `gorm:"type:varchar(30);not null;default:'pending'" json:"status"` // pending, contacted, converted, rejected
	ConvertedTenantID *uuid.UUID `gorm:"type:uuid" json:"converted_tenant_id,omitempty"`
	CreatedAt         time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt         time.Time  `gorm:"not null" json:"updated_at"`
}

func (LandingInquiry) TableName() string {
	return "landing_inquiries"
}

func (l *LandingInquiry) Validate() error {
	if strings.TrimSpace(l.FullName) == "" {
		return errors.New("full name is required")
	}
	if strings.TrimSpace(l.Phone) == "" {
		return errors.New("phone number is required")
	}
	if strings.TrimSpace(l.InstituteName) == "" {
		return errors.New("institute name is required")
	}
	return nil
}

// SupportTicket represents a problem or inquiry submitted by an institute tenant admin.
type SupportTicket struct {
	ID            uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TicketNumber  string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"ticket_number"`
	TenantID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	Subject       string     `gorm:"type:varchar(255);not null" json:"subject"`
	Description   string     `gorm:"type:text;not null" json:"description"`
	Priority      string     `gorm:"type:varchar(20);not null;default:'medium'" json:"priority"` // low, medium, high, urgent
	Status        string     `gorm:"type:varchar(30);not null;default:'open'" json:"status"`     // open, in_progress, resolved, closed
	AdminResponse string     `gorm:"type:text" json:"admin_response,omitempty"`
	RespondedAt   *time.Time `json:"responded_at,omitempty"`
	CreatedAt     time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"not null" json:"updated_at"`

	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (SupportTicket) TableName() string {
	return "support_tickets"
}

func (s *SupportTicket) Validate() error {
	if s.TenantID == uuid.Nil {
		return errors.New("tenant_id is required")
	}
	if strings.TrimSpace(s.Subject) == "" {
		return errors.New("subject is required")
	}
	if strings.TrimSpace(s.Description) == "" {
		return errors.New("description is required")
	}
	return nil
}
