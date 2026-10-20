package repositories

import (
	"context"
	"errors"
	"strings"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrTenantNotFound = errors.New("tenant not found")
)

// TenantRepository defines data access methods for Tenant entities.
type TenantRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error)
	FindBySlug(ctx context.Context, slug string) (*models.Tenant, error)
	FindByDomain(ctx context.Context, domain string) (*models.Tenant, error)
	Create(ctx context.Context, tenant *models.Tenant) error
	Update(ctx context.Context, tenant *models.Tenant) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, page, limit int) ([]models.Tenant, int64, error)
}

type gormTenantRepository struct {
	db *gorm.DB
}

// NewTenantRepository creates a new GORM-backed TenantRepository.
func NewTenantRepository(db *gorm.DB) TenantRepository {
	return &gormTenantRepository{db: db}
}

func (r *gormTenantRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	var tenant models.Tenant
	err := r.db.WithContext(ctx).First(&tenant, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	return &tenant, nil
}

func (r *gormTenantRepository) FindBySlug(ctx context.Context, slug string) (*models.Tenant, error) {
	normalized := models.NormalizeSlug(slug)
	var tenant models.Tenant
	err := r.db.WithContext(ctx).First(&tenant, "slug = ?", normalized).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	return &tenant, nil
}

func (r *gormTenantRepository) FindByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	normalized := models.NormalizeSlug(domain)
	var tenant models.Tenant

	// 1. Check verified/active custom domains table
	err := r.db.WithContext(ctx).
		Table("tenants").
		Joins("JOIN domains ON domains.tenant_id = tenants.id").
		Where("LOWER(domains.domain) = ? AND domains.status IN (?, ?) AND domains.deleted_at IS NULL",
			strings.ToLower(normalized), models.DomainStatusActive, models.DomainStatusVerified).
		First(&tenant).Error
	if err == nil {
		return &tenant, nil
	}

	// 2. Fallback to tenants.domain column
	err = r.db.WithContext(ctx).First(&tenant, "domain = ?", normalized).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	return &tenant, nil
}

func (r *gormTenantRepository) Create(ctx context.Context, tenant *models.Tenant) error {
	if err := models.ValidateSlug(tenant.Slug); err != nil {
		return err
	}
	tenant.Slug = models.NormalizeSlug(tenant.Slug)
	if tenant.Domain != nil {
		normDomain := models.NormalizeSlug(*tenant.Domain)
		tenant.Domain = &normDomain
	}
	return r.db.WithContext(ctx).Create(tenant).Error
}

func (r *gormTenantRepository) Update(ctx context.Context, tenant *models.Tenant) error {
	return r.db.WithContext(ctx).Save(tenant).Error
}

func (r *gormTenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Tenant{}, "id = ?", id).Error
}

func (r *gormTenantRepository) List(ctx context.Context, page, limit int) ([]models.Tenant, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	if err := r.db.WithContext(ctx).Model(&models.Tenant{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tenants []models.Tenant
	err := r.db.WithContext(ctx).
		Order("created_at desc").
		Offset(offset).
		Limit(limit).
		Find(&tenants).Error
	return tenants, total, err
}
