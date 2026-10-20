package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net"
	"strings"
	"time"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrDomainBelongsToAnotherTenant = errors.New("cannot manage a domain belonging to another institute")
	ErrDomainAlreadyVerified        = errors.New("domain is already verified and active")
	ErrDNSVerificationFailed        = errors.New("DNS TXT verification record not found or does not match expected token")
	ErrCannotSetUnverifiedPrimary   = errors.New("cannot set an unverified domain as primary")
)

// DNSVerifier abstracts DNS lookups to allow testing and pluggable resolution strategies.
type DNSVerifier interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
}

// StandardDNSVerifier uses Go's standard net.Resolver.
type StandardDNSVerifier struct {
	resolver *net.Resolver
}

func NewStandardDNSVerifier() *StandardDNSVerifier {
	return &StandardDNSVerifier{resolver: net.DefaultResolver}
}

func (v *StandardDNSVerifier) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return v.resolver.LookupTXT(ctx, name)
}

// DomainService manages domain lifecycle, uniqueness, and verification workflows.
type DomainService struct {
	domainRepo  repositories.DomainRepository
	tenantRepo  repositories.TenantRepository
	baseDomain  string
	dnsVerifier DNSVerifier
}

// NewDomainService creates a new DomainService instance.
func NewDomainService(d repositories.DomainRepository, t repositories.TenantRepository, baseDomain string, verifier DNSVerifier) *DomainService {
	if verifier == nil {
		verifier = NewStandardDNSVerifier()
	}
	return &DomainService{
		domainRepo:  d,
		tenantRepo:  t,
		baseDomain:  baseDomain,
		dnsVerifier: verifier,
	}
}

// SetDNSVerifier allows swapping the DNS verifier (e.g. for mock testing).
func (s *DomainService) SetDNSVerifier(v DNSVerifier) {
	s.dnsVerifier = v
}

// generateVerificationToken produces a cryptographically secure token for DNS TXT verification.
func generateVerificationToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "academy-verify-" + hex.EncodeToString(b)
}

// RequestCustomDomain initiates custom domain attachment for a tenant.
func (s *DomainService) RequestCustomDomain(ctx context.Context, tenantID uuid.UUID, domainName string) (*models.Domain, error) {
	normDomain := models.NormalizeDomain(domainName)

	// Validate domain format and ensure no conflict with base domain
	if err := models.ValidateDomainName(normDomain, s.baseDomain); err != nil {
		return nil, err
	}

	// Verify tenant exists and is active
	tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant.Status == models.TenantStatusSuspended || tenant.Status == models.TenantStatusArchived {
		return nil, models.ErrTenantSuspended
	}

	// Check domain global uniqueness
	existing, _ := s.domainRepo.FindByDomain(ctx, normDomain)
	if existing != nil {
		return nil, models.ErrDomainAlreadyExists
	}

	token := generateVerificationToken()

	domain := &models.Domain{
		TenantID:           tenantID,
		Domain:             normDomain,
		IsPrimary:          false,
		Status:             models.DomainStatusPending,
		VerificationToken:  token,
		VerificationMethod: "dns_txt",
	}

	if err := s.domainRepo.Create(ctx, domain); err != nil {
		zap.L().Error("Failed to create custom domain request", zap.Error(err), zap.String("domain", normDomain))
		return nil, err
	}

	zap.L().Info("Custom domain attachment requested",
		zap.String("tenant_id", tenantID.String()),
		zap.String("domain", normDomain),
		zap.String("token", token),
	)

	return domain, nil
}

// VerifyDomain verifies DNS ownership of a custom domain and transitions it to active.
func (s *DomainService) VerifyDomain(ctx context.Context, tenantID, domainID uuid.UUID) (*models.Domain, error) {
	domain, err := s.domainRepo.FindByID(ctx, domainID)
	if err != nil {
		return nil, err
	}

	if domain.TenantID != tenantID {
		return nil, ErrDomainBelongsToAnotherTenant
	}

	if domain.Status == models.DomainStatusActive {
		return domain, nil
	}

	// Lookup DNS TXT records on the domain
	txtRecords, err := s.dnsVerifier.LookupTXT(ctx, domain.Domain)
	verified := false

	if err == nil {
		for _, record := range txtRecords {
			if strings.TrimSpace(record) == domain.VerificationToken {
				verified = true
				break
			}
		}
	}

	if !verified {
		domain.Status = models.DomainStatusFailed
		_ = s.domainRepo.Update(ctx, domain)
		return nil, ErrDNSVerificationFailed
	}

	now := time.Now().UTC()
	domain.Status = models.DomainStatusActive
	domain.VerifiedAt = &now

	if err := s.domainRepo.Update(ctx, domain); err != nil {
		return nil, err
	}

	zap.L().Info("Custom domain successfully verified and activated",
		zap.String("tenant_id", tenantID.String()),
		zap.String("domain", domain.Domain),
	)

	return domain, nil
}

// ListTenantDomains returns all custom domains registered to a tenant.
func (s *DomainService) ListTenantDomains(ctx context.Context, tenantID uuid.UUID) ([]models.Domain, error) {
	return s.domainRepo.ListByTenant(ctx, tenantID)
}

// SetPrimaryDomain sets a verified domain as the primary routing domain for a tenant.
func (s *DomainService) SetPrimaryDomain(ctx context.Context, tenantID, domainID uuid.UUID) error {
	domain, err := s.domainRepo.FindByID(ctx, domainID)
	if err != nil {
		return err
	}

	if domain.TenantID != tenantID {
		return ErrDomainBelongsToAnotherTenant
	}

	if !domain.CanRoute() {
		return ErrCannotSetUnverifiedPrimary
	}

	return s.domainRepo.SetPrimary(ctx, tenantID, domainID)
}

// DeleteDomain removes a custom domain from an institute.
func (s *DomainService) DeleteDomain(ctx context.Context, tenantID, domainID uuid.UUID) error {
	domain, err := s.domainRepo.FindByID(ctx, domainID)
	if err != nil {
		return err
	}

	if domain.TenantID != tenantID {
		return ErrDomainBelongsToAnotherTenant
	}

	return s.domainRepo.Delete(ctx, domainID)
}

// ListAllDomains returns paginated domains for central platform administration.
func (s *DomainService) ListAllDomains(ctx context.Context, page, limit int) ([]models.Domain, int64, error) {
	return s.domainRepo.ListAll(ctx, page, limit)
}
