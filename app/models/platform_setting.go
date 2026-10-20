package models

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// PlatformSetting represents a configurable key-value setting for the platform or landing page CMS.
type PlatformSetting struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Key         string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"type:text;not null" json:"value"`
	Category    string    `gorm:"type:varchar(50);not null;default:'general'" json:"category"` // general, hero, contact, pricing, features
	Description string    `gorm:"type:varchar(255)" json:"description,omitempty"`
	CreatedAt   time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null" json:"updated_at"`
}

func (PlatformSetting) TableName() string {
	return "platform_settings"
}

func (s *PlatformSetting) Validate() error {
	if strings.TrimSpace(s.Key) == "" {
		return errors.New("key is required")
	}
	return nil
}
