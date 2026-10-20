package repositories

import (
	"context"
	"errors"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentReceiptRepository defines data access methods for payment receipts.
type PaymentReceiptRepository interface {
	Create(ctx context.Context, receipt *models.PaymentReceipt) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.PaymentReceipt, error)
	FindByReceiptNumber(ctx context.Context, num string) (*models.PaymentReceipt, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.PaymentReceipt, error)
	ListAll(ctx context.Context, page, limit int) ([]models.PaymentReceipt, int64, error)
}

type gormPaymentReceiptRepository struct {
	db *gorm.DB
}

// NewPaymentReceiptRepository creates a new GORM-backed PaymentReceiptRepository.
func NewPaymentReceiptRepository(db *gorm.DB) PaymentReceiptRepository {
	return &gormPaymentReceiptRepository{db: db}
}

func (r *gormPaymentReceiptRepository) Create(ctx context.Context, p *models.PaymentReceipt) error {
	if err := p.Validate(); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *gormPaymentReceiptRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.PaymentReceipt, error) {
	var p models.PaymentReceipt
	err := r.db.WithContext(ctx).Preload("RecordedByUser").First(&p, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrReceiptNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *gormPaymentReceiptRepository) FindByReceiptNumber(ctx context.Context, num string) (*models.PaymentReceipt, error) {
	var p models.PaymentReceipt
	err := r.db.WithContext(ctx).Preload("RecordedByUser").First(&p, "receipt_number = ?", num).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrReceiptNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *gormPaymentReceiptRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]models.PaymentReceipt, error) {
	var list []models.PaymentReceipt
	err := r.db.WithContext(ctx).Preload("RecordedByUser").
		Where("tenant_id = ?", tenantID).
		Order("paid_at DESC").
		Find(&list).Error
	return list, err
}

func (r *gormPaymentReceiptRepository) ListAll(ctx context.Context, page, limit int) ([]models.PaymentReceipt, int64, error) {
	var list []models.PaymentReceipt
	var total int64

	offset := (page - 1) * limit
	tx := r.db.WithContext(ctx).Model(&models.PaymentReceipt{})
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := tx.Offset(offset).Limit(limit).Preload("RecordedByUser").Order("paid_at DESC").Find(&list).Error
	return list, total, err
}
