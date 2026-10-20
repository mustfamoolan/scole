package models

import (
	"errors"
	"net"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Domain status constants
const (
	DomainStatusPending  = "pending_verification"
	DomainStatusVerified = "verified"
	DomainStatusActive   = "active"
	DomainStatusFailed   = "failed"
)

var (
	ErrInvalidDomainFormat = errors.New("domain must be a valid fully qualified domain name (FQDN)")
	ErrBaseDomainReserved  = errors.New("cannot attach the root base domain or system domains as a custom domain")
	ErrDomainAlreadyExists = errors.New("domain is already assigned or pending verification")
	ErrDomainNotVerified   = errors.New("custom domain has not completed DNS ownership verification")
	ErrDomainNotFound      = errors.New("domain record not found")
)

// Standard FQDN regex matching RFC 1035 labels (each label 1-63 chars, total <= 253 chars, at least 2 labels)
var domainRegex = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`)

// Domain represents a verified or pending custom domain assigned to an institute.
type Domain struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Domain             string         `gorm:"type:varchar(255);not null" json:"domain"`
	IsPrimary          bool           `gorm:"not null;default:false" json:"is_primary"`
	Status             string         `gorm:"type:varchar(32);not null;default:'pending_verification'" json:"status"`
	VerificationToken  string         `gorm:"type:varchar(128);not null" json:"verification_token"`
	VerificationMethod string         `gorm:"type:varchar(32);not null;default:'dns_txt'" json:"verification_method"`
	VerifiedAt         *time.Time     `json:"verified_at,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Domain) TableName() string {
	return "domains"
}

// NormalizeDomain trims whitespace, converts to lowercase, and strips any trailing dot.
func NormalizeDomain(raw string) string {
	d := strings.ToLower(strings.TrimSpace(raw))
	return strings.TrimSuffix(d, ".")
}

// ValidateDomainName checks whether a domain is a syntactically valid FQDN and not an IP or reserved base domain.
func ValidateDomainName(domain, baseDomain string) error {
	norm := NormalizeDomain(domain)
	if norm == "" || len(norm) > 253 {
		return ErrInvalidDomainFormat
	}

	// Reject IP addresses
	if net.ParseIP(norm) != nil {
		return ErrInvalidDomainFormat
	}

	// Must match valid FQDN syntax
	if !domainRegex.MatchString(norm) {
		return ErrInvalidDomainFormat
	}

	// Cannot equal or end with base domain (prevent sub-domain takeover of platform)
	normBase := NormalizeDomain(baseDomain)
	if normBase != "" {
		if norm == normBase || strings.HasSuffix(norm, "."+normBase) {
			return ErrBaseDomainReserved
		}
	}

	// Localhost is disallowed for custom production domains
	if norm == "localhost" || strings.HasSuffix(norm, ".localhost") {
		return ErrBaseDomainReserved
	}

	return nil
}

// CanRoute returns true only if the domain is verified and active.
func (d *Domain) CanRoute() bool {
	return d.Status == DomainStatusActive || d.Status == DomainStatusVerified
}
