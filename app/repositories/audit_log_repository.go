package repositories

import (
	"context"
	"time"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuditLogRepository defines data access methods for AuditLog entities.
type AuditLogRepository interface {
	Create(ctx context.Context, log *models.AuditLog) error
	ListPlatform(ctx context.Context, action string, tenantID *uuid.UUID, limit int, offset int) ([]models.AuditLog, int64, error)
	ListTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.AuditLog, int64, error)
}

type gormAuditLogRepository struct {
	db *gorm.DB
}

// NewAuditLogRepository creates a new GORM-backed AuditLogRepository.
func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &gormAuditLogRepository{db: db}
}

func (r *gormAuditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now().UTC()
	}
	if log.Details == "" {
		log.Details = "{}"
	}
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *gormAuditLogRepository) ListPlatform(ctx context.Context, action string, tenantID *uuid.UUID, limit int, offset int) ([]models.AuditLog, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := r.db.WithContext(ctx).Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if tenantID != nil && *tenantID != uuid.Nil {
		query = query.Where("tenant_id = ?", *tenantID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []models.AuditLog
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

func (r *gormAuditLogRepository) ListTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.AuditLog, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := r.db.WithContext(ctx).Model(&models.AuditLog{}).Where("tenant_id = ?", tenantID)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []models.AuditLog
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
