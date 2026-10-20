package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Role constants
const (
	RolePlatformAdmin  = "platform_admin"
	RoleInstituteAdmin = "institute_admin"
	RoleStaff          = "staff"
)

// User status constants
const (
	UserStatusActive    = "active"
	UserStatusSuspended = "suspended"
	UserStatusInactive  = "inactive"
)

// User represents an identity within the platform or an individual institute.
type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID     *uuid.UUID     `gorm:"type:uuid;index" json:"tenant_id,omitempty"`
	Name         string         `gorm:"type:varchar(255);not null" json:"name"`
	Email        string         `gorm:"type:varchar(255);not null" json:"email"`
	PasswordHash string         `gorm:"type:varchar(255);not null" json:"-"`
	Role         string         `gorm:"type:varchar(50);not null;index" json:"role"`
	Status       string         `gorm:"type:varchar(50);not null;default:'active';index" json:"status"`
	LastLoginAt  *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string {
	return "users"
}

// IsPlatformAdmin reports whether the user is an authorized platform operator.
func (u *User) IsPlatformAdmin() bool {
	return u.Role == RolePlatformAdmin && u.TenantID == nil
}

// IsInstituteAdmin reports whether the user is an institute administrator.
func (u *User) IsInstituteAdmin() bool {
	return u.Role == RoleInstituteAdmin && u.TenantID != nil
}

// IsActive reports whether the user account is active.
func (u *User) IsActive() bool {
	return u.Status == UserStatusActive
}

// BelongsToTenant checks whether the user belongs strictly to the given tenant.
func (u *User) BelongsToTenant(tenantID uuid.UUID) bool {
	if u.TenantID == nil || tenantID == uuid.Nil {
		return false
	}
	return *u.TenantID == tenantID
}

// NormalizeEmail trims and lowercases an email address.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
