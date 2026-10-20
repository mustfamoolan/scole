package repositories

import (
	"context"
	"errors"

	"institute/app/models"
	"institute/app/scopes"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrResourceNotFound = errors.New("resource not found")
)

// TenantResourceRepository enforces tenant-scoped data access at the database layer.
type TenantResourceRepository interface {
	Create(ctx context.Context, tenantID uuid.UUID, res *models.TenantResource) error
	FindByID(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.TenantResource, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]models.TenantResource, error)
	Update(ctx context.Context, tenantID uuid.UUID, res *models.TenantResource) error
	Delete(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error
}

type gormTenantResourceRepository struct {
	db *gorm.DB
}

// NewTenantResourceRepository creates a new repository instance for tenant resources.
func NewTenantResourceRepository(db *gorm.DB) TenantResourceRepository {
	return &gormTenantResourceRepository{db: db}
}

func (r *gormTenantResourceRepository) Create(ctx context.Context, tenantID uuid.UUID, res *models.TenantResource) error {
	if tenantID == uuid.Nil {
		return errors.New("tenant_id must not be empty")
	}
	res.TenantID = tenantID
	return r.db.WithContext(ctx).Create(res).Error
}

func (r *gormTenantResourceRepository) FindByID(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.TenantResource, error) {
	var item models.TenantResource
	err := r.db.WithContext(ctx).
		Scopes(scopes.ForTenant(tenantID)).
		First(&item, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrResourceNotFound
		}
		return nil, err
	}
	return &item, nil
}

func (r *gormTenantResourceRepository) List(ctx context.Context, tenantID uuid.UUID) ([]models.TenantResource, error) {
	var items []models.TenantResource
	err := r.db.WithContext(ctx).
		Scopes(scopes.ForTenant(tenantID)).
		Order("created_at desc").
		Find(&items).Error
	return items, err
}

func (r *gormTenantResourceRepository) Update(ctx context.Context, tenantID uuid.UUID, res *models.TenantResource) error {
	res.TenantID = tenantID
	result := r.db.WithContext(ctx).
		Model(&models.TenantResource{}).
		Scopes(scopes.ForTenant(tenantID)).
		Where("id = ?", res.ID).
		Updates(map[string]interface{}{
			"title":   res.Title,
			"content": res.Content,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrResourceNotFound
	}
	return nil
}

func (r *gormTenantResourceRepository) Delete(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Scopes(scopes.ForTenant(tenantID)).
		Delete(&models.TenantResource{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrResourceNotFound
	}
	return nil
}
