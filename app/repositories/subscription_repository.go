package repositories

import (
	"context"
	"errors"
	"time"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubscriptionRepository defines data access methods for tenant subscriptions.
type SubscriptionRepository interface {
	Create(ctx context.Context, sub *models.Subscription) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error)
	FindActiveByTenant(ctx context.Context, tenantID uuid.UUID) (*models.Subscription, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.Subscription, error)
	ListAll(ctx context.Context, page, limit int) ([]models.Subscription, int64, error)
	Update(ctx context.Context, sub *models.Subscription) error
}

type gormSubscriptionRepository struct {
	db *gorm.DB
}

// NewSubscriptionRepository creates a new GORM-backed SubscriptionRepository.
func NewSubscriptionRepository(db *gorm.DB) SubscriptionRepository {
	return &gormSubscriptionRepository{db: db}
}

func (r *gormSubscriptionRepository) Create(ctx context.Context, sub *models.Subscription) error {
	return r.db.WithContext(ctx).Create(sub).Error
}

func (r *gormSubscriptionRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.WithContext(ctx).Preload("Plan").First(&sub, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrSubscriptionNotFound
		}
		return nil, err
	}
	return &sub, nil
}

func (r *gormSubscriptionRepository) FindActiveByTenant(ctx context.Context, tenantID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	now := time.Now()
	err := r.db.WithContext(ctx).Preload("Plan").
		Where("tenant_id = ? AND status IN (?, ?) AND ends_at > ?",
			tenantID, models.SubscriptionStatusActive, models.SubscriptionStatusTrialing, now).
		Order("ends_at DESC").
		First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrSubscriptionNotFound
		}
		return nil, err
	}
	return &sub, nil
}

func (r *gormSubscriptionRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.Subscription, error) {
	var list []models.Subscription
	err := r.db.WithContext(ctx).Preload("Plan").
		Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		Find(&list).Error
	return list, err
}

func (r *gormSubscriptionRepository) ListAll(ctx context.Context, page, limit int) ([]models.Subscription, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	if err := r.db.WithContext(ctx).Model(&models.Subscription{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.Subscription
	err := r.db.WithContext(ctx).
		Preload("Plan").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&list).Error

	return list, total, err
}

func (r *gormSubscriptionRepository) Update(ctx context.Context, sub *models.Subscription) error {
	return r.db.WithContext(ctx).Omit("Plan").Save(sub).Error
}
