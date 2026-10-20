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
	ErrDomainNotFound = errors.New("domain not found")
)

// DomainRepository defines data access methods for domain entities.
type DomainRepository interface {
	Create(ctx context.Context, domain *models.Domain) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Domain, error)
	FindByDomain(ctx context.Context, domainName string) (*models.Domain, error)
	FindActiveByDomain(ctx context.Context, domainName string) (*models.Domain, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.Domain, error)
	ListAll(ctx context.Context, page, limit int) ([]models.Domain, int64, error)
	Update(ctx context.Context, domain *models.Domain) error
	Delete(ctx context.Context, id uuid.UUID) error
	SetPrimary(ctx context.Context, tenantID, domainID uuid.UUID) error
}

type gormDomainRepository struct {
	db *gorm.DB
}

// NewDomainRepository creates a new GORM-backed DomainRepository.
func NewDomainRepository(db *gorm.DB) DomainRepository {
	return &gormDomainRepository{db: db}
}

func (r *gormDomainRepository) Create(ctx context.Context, d *models.Domain) error {
	d.Domain = models.NormalizeDomain(d.Domain)
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *gormDomainRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Domain, error) {
	var d models.Domain
	err := r.db.WithContext(ctx).First(&d, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDomainNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *gormDomainRepository) FindByDomain(ctx context.Context, domainName string) (*models.Domain, error) {
	norm := models.NormalizeDomain(domainName)
	var d models.Domain
	err := r.db.WithContext(ctx).First(&d, "LOWER(domain) = ?", strings.ToLower(norm)).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDomainNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *gormDomainRepository) FindActiveByDomain(ctx context.Context, domainName string) (*models.Domain, error) {
	norm := models.NormalizeDomain(domainName)
	var d models.Domain
	err := r.db.WithContext(ctx).
		Where("LOWER(domain) = ? AND status IN (?, ?)", strings.ToLower(norm), models.DomainStatusActive, models.DomainStatusVerified).
		First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDomainNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *gormDomainRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.Domain, error) {
	var list []models.Domain
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Order("is_primary DESC, created_at ASC").
		Find(&list).Error
	return list, err
}

func (r *gormDomainRepository) ListAll(ctx context.Context, page, limit int) ([]models.Domain, int64, error) {
	var list []models.Domain
	var total int64

	offset := (page - 1) * limit
	tx := r.db.WithContext(ctx).Model(&models.Domain{})
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := tx.Offset(offset).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *gormDomainRepository) Update(ctx context.Context, d *models.Domain) error {
	d.Domain = models.NormalizeDomain(d.Domain)
	return r.db.WithContext(ctx).Save(d).Error
}

func (r *gormDomainRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Domain{}, "id = ?", id).Error
}

func (r *gormDomainRepository) SetPrimary(ctx context.Context, tenantID, domainID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Clear primary for all domains of this tenant
		if err := tx.Model(&models.Domain{}).Where("tenant_id = ?", tenantID).Update("is_primary", false).Error; err != nil {
			return err
		}
		// Set new primary
		return tx.Model(&models.Domain{}).Where("tenant_id = ? AND id = ?", tenantID, domainID).Update("is_primary", true).Error
	})
}
