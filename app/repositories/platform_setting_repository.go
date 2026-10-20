package repositories

import (
	"context"
	"time"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PlatformSettingRepository provides data access for platform settings.
type PlatformSettingRepository interface {
	GetAll(ctx context.Context) ([]models.PlatformSetting, error)
	GetByKey(ctx context.Context, key string) (*models.PlatformSetting, error)
	Upsert(ctx context.Context, setting *models.PlatformSetting) error
	BatchUpdate(ctx context.Context, settings map[string]string) error
}

type gormPlatformSettingRepository struct {
	db *gorm.DB
}

func NewPlatformSettingRepository(db *gorm.DB) PlatformSettingRepository {
	return &gormPlatformSettingRepository{db: db}
}

func (r *gormPlatformSettingRepository) GetAll(ctx context.Context) ([]models.PlatformSetting, error) {
	var settings []models.PlatformSetting
	err := r.db.WithContext(ctx).Order("category ASC, key ASC").Find(&settings).Error
	return settings, err
}

func (r *gormPlatformSettingRepository) GetByKey(ctx context.Context, key string) (*models.PlatformSetting, error) {
	var setting models.PlatformSetting
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *gormPlatformSettingRepository) Upsert(ctx context.Context, setting *models.PlatformSetting) error {
	if setting.ID == uuid.Nil {
		setting.ID = uuid.New()
	}
	now := time.Now().UTC()
	if setting.CreatedAt.IsZero() {
		setting.CreatedAt = now
	}
	setting.UpdatedAt = now

	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "category", "description", "updated_at"}),
	}).Create(setting).Error
}

func (r *gormPlatformSettingRepository) BatchUpdate(ctx context.Context, settings map[string]string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for k, v := range settings {
			err := tx.Model(&models.PlatformSetting{}).Where("key = ?", k).Updates(map[string]interface{}{
				"value":      v,
				"updated_at": now,
			}).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}
