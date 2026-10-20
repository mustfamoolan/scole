package models

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	ActionTenantCreated        = "tenant.created"
	ActionTenantStatusUpdated  = "tenant.status_updated"
	ActionTenantProfileUpdated = "tenant.profile_updated"
	ActionUserLoggedIn         = "user.logged_in"
	ActionUserLoggedOut        = "user.logged_out"
	ActionDomainRequested      = "domain.requested"
	ActionDomainVerified       = "domain.verified"
	ActionDomainDeleted        = "domain.deleted"
	ActionSubscriptionCreated  = "subscription.created"
	ActionSubscriptionRenewed  = "subscription.renewed"
	ActionSubscriptionCanceled = "subscription.canceled"
	ActionPaymentRecorded      = "payment.recorded"
	ActionPlanCreated          = "plan.created"
)

// AuditLog tracks administrative, financial, and security events for compliance and traceability.
type AuditLog struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID   *uuid.UUID `gorm:"type:uuid;index" json:"tenant_id,omitempty"`
	UserID     *uuid.UUID `gorm:"type:uuid;index" json:"user_id,omitempty"`
	ActorRole  string     `gorm:"type:varchar(50)" json:"actor_role,omitempty"`
	Action     string     `gorm:"type:varchar(100);not null;index" json:"action"`
	EntityType string     `gorm:"type:varchar(100);not null;index" json:"entity_type"`
	EntityID   string     `gorm:"type:varchar(100);index" json:"entity_id,omitempty"`
	Details    string     `gorm:"type:jsonb;not null;default:'{}'" json:"details"`
	IPAddress  string     `gorm:"type:varchar(45)" json:"ip_address,omitempty"`
	UserAgent  string     `gorm:"type:text" json:"user_agent,omitempty"`
	CreatedAt  time.Time  `gorm:"not null;index" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

// Validate ensures required fields for an audit trail entry.
func (a *AuditLog) Validate() error {
	if strings.TrimSpace(a.Action) == "" {
		return errors.New("audit log action is required")
	}
	if strings.TrimSpace(a.EntityType) == "" {
		return errors.New("audit log entity_type is required")
	}
	return nil
}
