package repositories

import (
	"context"
	"errors"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PlanRepository defines data access methods for billing plans.
type PlanRepository interface {
	Create(ctx context.Context, plan *models.Plan) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Plan, error)
	FindBySlug(ctx context.Context, slug string) (*models.Plan, error)
	ListActive(ctx context.Context) ([]models.Plan, error)
	ListAll(ctx context.Context, page, limit int) ([]models.Plan, int64, error)
	Update(ctx context.Context, plan *models.Plan) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type gormPlanRepository struct {
	db *gorm.DB
}

// NewPlanRepository creates a new GORM-backed PlanRepository.
func NewPlanRepository(db *gorm.DB) PlanRepository {
	return &gormPlanRepository{db: db}
}

func (r *gormPlanRepository) Create(ctx context.Context, p *models.Plan) error {
	if err := p.Validate(); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *gormPlanRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Plan, error) {
	var p models.Plan
	err := r.db.WithContext(ctx).First(&p, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrPlanNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *gormPlanRepository) FindBySlug(ctx context.Context, slug string) (*models.Plan, error) {
	var p models.Plan
	err := r.db.WithContext(ctx).First(&p, "slug = ?", slug).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrPlanNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *gormPlanRepository) ListActive(ctx context.Context) ([]models.Plan, error) {
	var list []models.Plan
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("price_iqd ASC").Find(&list).Error
	return list, err
}

func (r *gormPlanRepository) ListAll(ctx context.Context, page, limit int) ([]models.Plan, int64, error) {
	var list []models.Plan
	var total int64

	offset := (page - 1) * limit
	tx := r.db.WithContext(ctx).Model(&models.Plan{})
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := tx.Offset(offset).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *gormPlanRepository) Update(ctx context.Context, p *models.Plan) error {
	if err := p.Validate(); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *gormPlanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Plan{}, "id = ?", id).Error
}
