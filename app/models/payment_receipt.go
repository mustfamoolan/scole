package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrInvalidPaymentAmount = errors.New("payment amount in IQD must be a positive integer greater than zero")
	ErrReceiptNotFound      = errors.New("payment receipt not found")
)

// PaymentReceipt represents an immutable financial entry in the manual ledger in whole Iraqi Dinars (IQD).
type PaymentReceipt struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	SubscriptionID     *uuid.UUID     `gorm:"type:uuid" json:"subscription_id,omitempty"`
	ReceiptNumber      string         `gorm:"type:varchar(64);not null;uniqueIndex" json:"receipt_number"`
	AmountIQD          int64          `gorm:"type:bigint;not null" json:"amount_iqd"` // Strictly whole Iraqi Dinars (no fils)
	Currency           string         `gorm:"type:varchar(3);not null;default:'IQD'" json:"currency"`
	PaymentMethod      string         `gorm:"type:varchar(50);not null" json:"payment_method"`
	ReferenceNote      string         `gorm:"type:text" json:"reference_note"`
	RecordedByUserID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"recorded_by_user_id"`
	RecordedByUser     *User          `gorm:"foreignKey:RecordedByUserID" json:"recorded_by_user,omitempty"`
	PaidAt             time.Time      `json:"paid_at"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (PaymentReceipt) TableName() string {
	return "payment_receipts"
}

// Validate ensures payment entry integrity.
func (p *PaymentReceipt) Validate() error {
	if p.AmountIQD <= 0 {
		return ErrInvalidPaymentAmount
	}
	if p.Currency != "IQD" {
		return errors.New("currency must strictly be 'IQD' (Iraqi Dinar)")
	}
	if p.RecordedByUserID == uuid.Nil {
		return errors.New("recorded_by_user_id is required for financial auditability")
	}
	return nil
}
