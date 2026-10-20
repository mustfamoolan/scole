package models

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	BillingCycleMonthly   = "monthly"
	BillingCycleQuarterly = "quarterly"
	BillingCycleYearly    = "yearly"
)

var (
	ErrInvalidPlanPrice = errors.New("plan price in IQD must be a non-negative whole integer")
	ErrInvalidPlanSlug  = errors.New("plan slug cannot be empty")
	ErrPlanNotFound     = errors.New("plan not found")
)

// Plan defines a subscription package, limits, and pricing in whole Iraqi Dinars (IQD).
type Plan struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name         string         `gorm:"type:varchar(100);not null" json:"name"`
	Slug         string         `gorm:"type:varchar(50);not null;uniqueIndex" json:"slug"`
	Description  string         `gorm:"type:text" json:"description"`
	PriceIQD     int64          `gorm:"type:bigint;not null" json:"price_iqd"` // Strictly whole Iraqi Dinars (no fils)
	BillingCycle string         `gorm:"type:varchar(20);not null;default:'monthly'" json:"billing_cycle"`
	MaxStudents  int            `gorm:"type:int;not null;default:100" json:"max_students"`
	MaxTeachers  int            `gorm:"type:int;not null;default:10" json:"max_teachers"`
	MaxBranches  int            `gorm:"type:int;not null;default:1" json:"max_branches"`
	Features     string         `gorm:"type:jsonb;not null;default:'{}'" json:"features"`
	ImageURL     string         `gorm:"type:varchar(255);default:''" json:"image_url"`
	IsActive     bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Plan) TableName() string {
	return "plans"
}

// Validate ensures plan constraints are met.
func (p *Plan) Validate() error {
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("plan name is required")
	}
	if strings.TrimSpace(p.Slug) == "" {
		return ErrInvalidPlanSlug
	}
	if p.PriceIQD < 0 {
		return ErrInvalidPlanPrice
	}
	if p.MaxStudents < 0 || p.MaxTeachers < 0 || p.MaxBranches < 1 {
		return errors.New("quota limits cannot be negative and branches must be at least 1")
	}
	return nil
}
