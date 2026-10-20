package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TenantResource represents an institute-owned data entity used to verify and enforce
// data isolation across tenants at the data layer.
type TenantResource struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Title     string         `gorm:"type:varchar(255);not null" json:"title"`
	Content   string         `gorm:"type:text" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (TenantResource) TableName() string {
	return "tenant_resources"
}
