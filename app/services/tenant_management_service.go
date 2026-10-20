package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var (
	ErrSlugAlreadyTaken  = errors.New("institute slug is already in use")
	ErrInvalidStatus     = errors.New("invalid status value; must be one of: setup, active, suspended, archived")
	ErrAdminEmailTaken   = errors.New("admin email is already registered for this institute")
	ErrMissingFields     = errors.New("institute name, slug, admin name, admin email, and admin password are required")
)

// CreateInstituteRequest specifies all fields required to instantiate a new institute with its founding administrator.
type CreateInstituteRequest struct {
	Name          string  `json:"name"`
	Slug          string  `json:"slug"`
	Email         *string `json:"email,omitempty"`
	Phone         *string `json:"phone,omitempty"`
	Address       *string `json:"address,omitempty"`
	LogoURL       *string `json:"logo_url,omitempty"`
	FaviconURL    *string `json:"favicon_url,omitempty"`
	PrimaryColor  *string `json:"primary_color,omitempty"`
	AdminName     string  `json:"admin_name"`
	AdminEmail    string  `json:"admin_email"`
	AdminPassword string  `json:"admin_password"`
}

// UpdateInstituteProfileRequest specifies profile and branding update fields.
type UpdateInstituteProfileRequest struct {
	Name         string  `json:"name"`
	Email        *string `json:"email,omitempty"`
	Phone        *string `json:"phone,omitempty"`
	Address      *string `json:"address,omitempty"`
	LogoURL      *string `json:"logo_url,omitempty"`
	FaviconURL   *string `json:"favicon_url,omitempty"`
	PrimaryColor *string `json:"primary_color,omitempty"`
}

// SelfRegisterInstituteRequest specifies parameters for self-registration from the landing page.
type SelfRegisterInstituteRequest struct {
	Name          string    `json:"name"`
	Slug          string    `json:"slug"`
	Phone         *string   `json:"phone,omitempty"`
	Address       *string   `json:"address,omitempty"`
	AdminName     string    `json:"admin_name"`
	AdminEmail    string    `json:"admin_email"`
	AdminPassword string    `json:"admin_password"`
	PlanID        uuid.UUID `json:"plan_id"`
}

// TenantManagementService orchestrates institute lifecycle management.
type TenantManagementService struct {
	db             *gorm.DB
	tenantRepo     repositories.TenantRepository
	userRepo       repositories.UserRepository
	auditService   AuditService
	billingService *BillingService
	authService    *AuthService
}

// NewTenantManagementService creates a new TenantManagementService.
func NewTenantManagementService(db *gorm.DB, t repositories.TenantRepository, u repositories.UserRepository) *TenantManagementService {
	return &TenantManagementService{
		db:         db,
		tenantRepo: t,
		userRepo:   u,
	}
}

// SetAuditService sets the audit logger.
func (s *TenantManagementService) SetAuditService(audit AuditService) {
	s.auditService = audit
}

// SetBillingService sets the billing service.
func (s *TenantManagementService) SetBillingService(b *BillingService) {
	s.billingService = b
}

// SetAuthService sets the auth service.
func (s *TenantManagementService) SetAuthService(a *AuthService) {
	s.authService = a
}

// CreateInstitute atomically creates an institute and its initial administrator account.
func (s *TenantManagementService) CreateInstitute(ctx context.Context, req CreateInstituteRequest) (*models.Tenant, *models.User, error) {
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Slug) == "" ||
		strings.TrimSpace(req.AdminName) == "" || strings.TrimSpace(req.AdminEmail) == "" ||
		strings.TrimSpace(req.AdminPassword) == "" {
		return nil, nil, ErrMissingFields
	}

	normalizedSlug := models.NormalizeSlug(req.Slug)
	if err := models.ValidateSlug(normalizedSlug); err != nil {
		return nil, nil, err
	}

	// Verify slug uniqueness
	existing, _ := s.tenantRepo.FindBySlug(ctx, normalizedSlug)
	if existing != nil {
		return nil, nil, ErrSlugAlreadyTaken
	}

	// Hash admin password
	passwordHash, err := HashPassword(req.AdminPassword)
	if err != nil {
		return nil, nil, err
	}

	primaryColor := "#4f46e5"
	if req.PrimaryColor != nil && strings.TrimSpace(*req.PrimaryColor) != "" {
		primaryColor = strings.TrimSpace(*req.PrimaryColor)
	}

	tenant := &models.Tenant{
		Name:         strings.TrimSpace(req.Name),
		Slug:         normalizedSlug,
		Email:        req.Email,
		Phone:        req.Phone,
		Address:      req.Address,
		LogoURL:      req.LogoURL,
		FaviconURL:   req.FaviconURL,
		PrimaryColor: primaryColor,
		Status:       models.TenantStatusActive,
	}

	var adminUser *models.User

	// Execute inside an atomic transaction
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txTenantRepo := repositories.NewTenantRepository(tx)
		txUserRepo := repositories.NewUserRepository(tx)

		if err := txTenantRepo.Create(ctx, tenant); err != nil {
			return err
		}

		adminUser = &models.User{
			TenantID:     &tenant.ID,
			Name:         strings.TrimSpace(req.AdminName),
			Email:        models.NormalizeEmail(req.AdminEmail),
			PasswordHash: passwordHash,
			Role:         models.RoleInstituteAdmin,
			Status:       models.UserStatusActive,
		}

		if err := txUserRepo.Create(ctx, adminUser); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		zap.L().Error("Failed to atomically create institute and admin", zap.Error(err), zap.String("slug", normalizedSlug))
		return nil, nil, err
	}

	zap.L().Info("Institute and founding admin created successfully",
		zap.String("tenant_id", tenant.ID.String()),
		zap.String("slug", tenant.Slug),
		zap.String("admin_id", adminUser.ID.String()),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &tenant.ID, &adminUser.ID, "platform_admin", models.ActionTenantCreated, "tenant", tenant.ID.String(), map[string]interface{}{
			"name":        tenant.Name,
			"slug":        tenant.Slug,
			"admin_email": adminUser.Email,
		}, "", "")
	}

	return tenant, adminUser, nil
}

// SelfRegisterInstitute provisions an institute, founding admin, trial subscription, and auth session.
func (s *TenantManagementService) SelfRegisterInstitute(
	ctx context.Context,
	req SelfRegisterInstituteRequest,
	trialDays int,
	ip, userAgent string,
) (*models.Tenant, *models.User, *models.Subscription, string, error) {
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Slug) == "" ||
		strings.TrimSpace(req.AdminName) == "" || strings.TrimSpace(req.AdminEmail) == "" ||
		strings.TrimSpace(req.AdminPassword) == "" {
		return nil, nil, nil, "", ErrMissingFields
	}

	normalizedSlug := strings.ToLower(strings.TrimSpace(req.Slug))
	normalizedSlug = strings.ReplaceAll(normalizedSlug, " ", "-")
	normalizedSlug = strings.ReplaceAll(normalizedSlug, "_", "-")
	reg := regexp.MustCompile(`[^a-z0-9-]+`)
	normalizedSlug = reg.ReplaceAllString(normalizedSlug, "")
	for strings.Contains(normalizedSlug, "--") {
		normalizedSlug = strings.ReplaceAll(normalizedSlug, "--", "-")
	}
	normalizedSlug = strings.Trim(normalizedSlug, "-")

	if len(normalizedSlug) < 3 {
		normalizedSlug = fmt.Sprintf("inst-%s", uuid.New().String()[:8])
	} else if len(normalizedSlug) > 50 {
		normalizedSlug = strings.Trim(normalizedSlug[:50], "-")
	}

	if err := models.ValidateSlug(normalizedSlug); err != nil {
		normalizedSlug = fmt.Sprintf("inst-%s", uuid.New().String()[:8])
	}

	// Verify slug uniqueness; if already taken, append a short unique suffix
	existing, _ := s.tenantRepo.FindBySlug(ctx, normalizedSlug)
	if existing != nil {
		suffix := uuid.New().String()[:4]
		if len(normalizedSlug) > 45 {
			normalizedSlug = strings.Trim(normalizedSlug[:45], "-")
		}
		normalizedSlug = fmt.Sprintf("%s-%s", normalizedSlug, suffix)
	}

	// Hash admin password
	passwordHash, err := HashPassword(req.AdminPassword)
	if err != nil {
		return nil, nil, nil, "", err
	}

	tenant := &models.Tenant{
		Name:         strings.TrimSpace(req.Name),
		Slug:         normalizedSlug,
		Phone:        req.Phone,
		Address:      req.Address,
		PrimaryColor: "#4f46e5",
		Status:       models.TenantStatusActive,
	}

	var adminUser *models.User

	// Execute inside an atomic transaction
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txTenantRepo := repositories.NewTenantRepository(tx)
		txUserRepo := repositories.NewUserRepository(tx)

		if err := txTenantRepo.Create(ctx, tenant); err != nil {
			return err
		}

		adminUser = &models.User{
			TenantID:     &tenant.ID,
			Name:         strings.TrimSpace(req.AdminName),
			Email:        models.NormalizeEmail(req.AdminEmail),
			PasswordHash: passwordHash,
			Role:         models.RoleInstituteAdmin,
			Status:       models.UserStatusActive,
		}

		return txUserRepo.Create(ctx, adminUser)
	})

	if err != nil {
		zap.L().Error("Failed to self-register institute", zap.Error(err), zap.String("slug", normalizedSlug))
		return nil, nil, nil, "", err
	}

	var sub *models.Subscription
	if s.billingService != nil {
		planID := req.PlanID
		if planID == uuid.Nil {
			activePlans, _ := s.billingService.ListActivePlans(ctx)
			if len(activePlans) > 0 {
				planID = activePlans[0].ID
			}
		}

		if planID != uuid.Nil {
			sub, _ = s.billingService.CreateTrialSubscription(ctx, tenant.ID, planID, trialDays)
		}
	}

	var sessionToken string
	if s.authService != nil {
		sessionToken, _ = s.authService.CreateSessionForUser(ctx, adminUser.ID, ip, userAgent)
	}

	zap.L().Info("Institute self-registered successfully with trial",
		zap.String("tenant_id", tenant.ID.String()),
		zap.String("slug", tenant.Slug),
		zap.String("admin_id", adminUser.ID.String()),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &tenant.ID, &adminUser.ID, "self_register", models.ActionTenantCreated, "tenant", tenant.ID.String(), map[string]interface{}{
			"name":        tenant.Name,
			"slug":        tenant.Slug,
			"admin_email": adminUser.Email,
			"trial_days":  trialDays,
		}, ip, userAgent)
	}

	return tenant, adminUser, sub, sessionToken, nil
}

// UpdateStatus changes an institute's status without destroying or altering its data.
func (s *TenantManagementService) UpdateStatus(ctx context.Context, tenantID uuid.UUID, newStatus string) error {
	normStatus := strings.ToLower(strings.TrimSpace(newStatus))
	switch normStatus {
	case models.TenantStatusSetup, models.TenantStatusActive, models.TenantStatusSuspended, models.TenantStatusArchived:
		// Valid
	default:
		return ErrInvalidStatus
	}

	tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
	if err != nil {
		return err
	}

	tenant.Status = normStatus
	if err := s.tenantRepo.Update(ctx, tenant); err != nil {
		return err
	}

	zap.L().Info("Institute status updated",
		zap.String("tenant_id", tenantID.String()),
		zap.String("new_status", normStatus),
	)

	if s.auditService != nil {
		_ = s.auditService.LogEvent(ctx, &tenantID, nil, "platform_admin", models.ActionTenantStatusUpdated, "tenant", tenantID.String(), map[string]interface{}{
			"status": normStatus,
		}, "", "")
	}

	return nil
}

// UpdateProfile updates non-critical profile fields for an institute.
func (s *TenantManagementService) UpdateProfile(ctx context.Context, tenantID uuid.UUID, req UpdateInstituteProfileRequest) (*models.Tenant, error) {
	tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) != "" {
		tenant.Name = strings.TrimSpace(req.Name)
	}
	if req.Email != nil {
		tenant.Email = req.Email
	}
	if req.Phone != nil {
		tenant.Phone = req.Phone
	}
	if req.Address != nil {
		tenant.Address = req.Address
	}
	if req.LogoURL != nil {
		tenant.LogoURL = req.LogoURL
	}
	if req.FaviconURL != nil {
		tenant.FaviconURL = req.FaviconURL
	}
	if req.PrimaryColor != nil && strings.TrimSpace(*req.PrimaryColor) != "" {
		tenant.PrimaryColor = strings.TrimSpace(*req.PrimaryColor)
	}

	if err := s.tenantRepo.Update(ctx, tenant); err != nil {
		return nil, err
	}

	return tenant, nil
}

// GetByID returns an institute by its ID.
func (s *TenantManagementService) GetByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	return s.tenantRepo.FindByID(ctx, id)
}

// List returns a paginated list of institutes.
func (s *TenantManagementService) List(ctx context.Context, page, limit int) ([]models.Tenant, int64, error) {
	return s.tenantRepo.List(ctx, page, limit)
}
