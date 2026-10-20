package models

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Tenant status definitions
const (
	TenantStatusSetup     = "setup"
	TenantStatusActive    = "active"
	TenantStatusSuspended = "suspended"
	TenantStatusArchived  = "archived"
)

var (
	ErrInvalidSlugFormat = errors.New("slug must be between 3 and 50 characters, containing only lowercase letters, numbers, and hyphens without consecutive hyphens")
	ErrReservedSlug      = errors.New("slug is reserved and cannot be assigned to an institute")
	ErrTenantInactive    = errors.New("tenant account is inactive or not ready")
	ErrTenantSuspended   = errors.New("tenant account is suspended")
	ErrTenantArchived    = errors.New("tenant account has been archived")
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$`)

var reservedSlugs = map[string]struct{}{
	"api":       {},
	"admin":     {},
	"platform":  {},
	"app":       {},
	"www":       {},
	"health":    {},
	"ready":     {},
	"status":    {},
	"mail":      {},
	"dashboard": {},
	"system":    {},
	"auth":      {},
	"public":    {},
	"assets":    {},
	"static":    {},
	"portal":    {},
}

// Tenant represents an isolated institute or school organization in the multi-tenant SaaS platform.
type Tenant struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name      string         `gorm:"type:varchar(255);not null" json:"name"`
	Slug      string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"slug"`
	Domain    *string        `gorm:"type:varchar(255);uniqueIndex" json:"domain,omitempty"`
	Email        *string        `gorm:"type:varchar(255)" json:"email,omitempty"`
	Phone        *string        `gorm:"type:varchar(50)" json:"phone,omitempty"`
	Address      *string        `gorm:"type:text" json:"address,omitempty"`
	LogoURL      *string        `gorm:"type:text" json:"logo_url,omitempty"`
	FaviconURL   *string        `gorm:"type:text" json:"favicon_url,omitempty"`
	PrimaryColor string         `gorm:"type:varchar(20);default:'#4f46e5'" json:"primary_color"`
	Status       string         `gorm:"type:varchar(50);not null;default:'setup';index" json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the PostgreSQL table name for GORM.
func (Tenant) TableName() string {
	return "tenants"
}

// IsActive reports whether the tenant is currently active and operational.
func (t *Tenant) IsActive() bool {
	return t.Status == TenantStatusActive
}

// CanAccess reports whether tenant requests are permitted (active or in initial setup).
func (t *Tenant) CanAccess() bool {
	return t.Status == TenantStatusActive || t.Status == TenantStatusSetup
}

// NormalizeSlug trims whitespace and converts to lowercase.
func NormalizeSlug(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// ValidateSlug verifies that a candidate slug satisfies naming rules and is not reserved.
func ValidateSlug(slug string) error {
	normalized := NormalizeSlug(slug)
	if len(normalized) < 3 || len(normalized) > 50 {
		return ErrInvalidSlugFormat
	}
	if strings.Contains(normalized, "--") {
		return ErrInvalidSlugFormat
	}
	if !slugRegex.MatchString(normalized) {
		return ErrInvalidSlugFormat
	}
	if _, isReserved := reservedSlugs[normalized]; isReserved {
		return ErrReservedSlug
	}
	return nil
}
