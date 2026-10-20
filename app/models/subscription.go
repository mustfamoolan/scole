package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SubscriptionStatusTrialing  = "trialing"
	SubscriptionStatusActive    = "active"
	SubscriptionStatusPastDue   = "past_due"
	SubscriptionStatusCanceled  = "canceled"
	SubscriptionStatusExpired   = "expired"
	SubscriptionStatusSuspended = "suspended"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription record not found")
	ErrSubscriptionExpired  = errors.New("subscription has expired")
	ErrLimitExceeded        = errors.New("plan limit exceeded for this resource quota")
)

// Subscription tracks an institute's billing entitlement, period, and state.
type Subscription struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	PlanID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"plan_id"`
	Plan        *Plan          `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	Status      string         `gorm:"type:varchar(32);not null;default:'active'" json:"status"`
	StartsAt    time.Time      `json:"starts_at"`
	EndsAt      time.Time      `json:"ends_at"`
	TrialEndsAt *time.Time     `json:"trial_ends_at,omitempty"`
	CanceledAt  *time.Time     `json:"canceled_at,omitempty"`
	AutoRenew   bool           `gorm:"not null;default:false" json:"auto_renew"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Subscription) TableName() string {
	return "subscriptions"
}

// IsActive checks if the subscription is in a valid, unexpired operational state.
func (s *Subscription) IsActive() bool {
	if s.Status != SubscriptionStatusActive && s.Status != SubscriptionStatusTrialing {
		return false
	}
	return time.Now().Before(s.EndsAt)
}
