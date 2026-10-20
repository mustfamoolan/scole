package models

import (
	"time"

	"github.com/google/uuid"
)

// Session represents an issued revocable authentication token session.
type Session struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash string     `gorm:"type:varchar(64);not null;uniqueIndex" json:"-"`
	IPAddress string     `gorm:"type:varchar(45)" json:"ip_address,omitempty"`
	UserAgent string     `gorm:"type:text" json:"user_agent,omitempty"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

func (Session) TableName() string {
	return "sessions"
}

// IsValid reports whether the session is currently valid (unrevoked and unexpired).
func (s *Session) IsValid() bool {
	if s.RevokedAt != nil {
		return false
	}
	return time.Now().Before(s.ExpiresAt)
}
