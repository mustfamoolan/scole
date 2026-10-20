package repositories

import (
	"context"
	"fmt"
	"time"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SupportRepository provides data access for inquiries and support tickets.
type SupportRepository interface {
	// Inquiries
	CreateInquiry(ctx context.Context, inquiry *models.LandingInquiry) error
	ListInquiries(ctx context.Context, status string, limit int, offset int) ([]models.LandingInquiry, int64, error)
	FindInquiryByID(ctx context.Context, id uuid.UUID) (*models.LandingInquiry, error)
	UpdateInquiryStatus(ctx context.Context, id uuid.UUID, status string, convertedTenantID *uuid.UUID) error

	// Tickets
	CreateTicket(ctx context.Context, ticket *models.SupportTicket) error
	ListTickets(ctx context.Context, tenantID *uuid.UUID, status string, limit int, offset int) ([]models.SupportTicket, int64, error)
	FindTicketByID(ctx context.Context, id uuid.UUID) (*models.SupportTicket, error)
	UpdateTicket(ctx context.Context, id uuid.UUID, response string, status string) error
}

type gormSupportRepository struct {
	db *gorm.DB
}

func NewSupportRepository(db *gorm.DB) SupportRepository {
	return &gormSupportRepository{db: db}
}

// Inquiries Implementation
func (r *gormSupportRepository) CreateInquiry(ctx context.Context, inquiry *models.LandingInquiry) error {
	if inquiry.ID == uuid.Nil {
		inquiry.ID = uuid.New()
	}
	now := time.Now().UTC()
	if inquiry.CreatedAt.IsZero() {
		inquiry.CreatedAt = now
	}
	inquiry.UpdatedAt = now
	if inquiry.Status == "" {
		inquiry.Status = "pending"
	}
	return r.db.WithContext(ctx).Create(inquiry).Error
}

func (r *gormSupportRepository) ListInquiries(ctx context.Context, status string, limit int, offset int) ([]models.LandingInquiry, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := r.db.WithContext(ctx).Model(&models.LandingInquiry{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var inquiries []models.LandingInquiry
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&inquiries).Error
	return inquiries, total, err
}

func (r *gormSupportRepository) FindInquiryByID(ctx context.Context, id uuid.UUID) (*models.LandingInquiry, error) {
	var inquiry models.LandingInquiry
	err := r.db.WithContext(ctx).First(&inquiry, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &inquiry, nil
}

func (r *gormSupportRepository) UpdateInquiryStatus(ctx context.Context, id uuid.UUID, status string, convertedTenantID *uuid.UUID) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().UTC(),
	}
	if convertedTenantID != nil {
		updates["converted_tenant_id"] = *convertedTenantID
	}
	return r.db.WithContext(ctx).Model(&models.LandingInquiry{}).Where("id = ?", id).Updates(updates).Error
}

// Tickets Implementation
func (r *gormSupportRepository) CreateTicket(ctx context.Context, ticket *models.SupportTicket) error {
	if ticket.ID == uuid.Nil {
		ticket.ID = uuid.New()
	}
	now := time.Now().UTC()
	if ticket.CreatedAt.IsZero() {
		ticket.CreatedAt = now
	}
	ticket.UpdatedAt = now
	if ticket.TicketNumber == "" {
		ticket.TicketNumber = fmt.Sprintf("TCK-%d-%04d", now.Year(), now.Unix()%10000)
	}
	if ticket.Status == "" {
		ticket.Status = "open"
	}
	if ticket.Priority == "" {
		ticket.Priority = "medium"
	}
	return r.db.WithContext(ctx).Create(ticket).Error
}

func (r *gormSupportRepository) ListTickets(ctx context.Context, tenantID *uuid.UUID, status string, limit int, offset int) ([]models.SupportTicket, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := r.db.WithContext(ctx).Model(&models.SupportTicket{}).Preload("Tenant")
	if tenantID != nil && *tenantID != uuid.Nil {
		query = query.Where("tenant_id = ?", *tenantID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tickets []models.SupportTicket
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&tickets).Error
	return tickets, total, err
}

func (r *gormSupportRepository) FindTicketByID(ctx context.Context, id uuid.UUID) (*models.SupportTicket, error) {
	var ticket models.SupportTicket
	err := r.db.WithContext(ctx).Preload("Tenant").First(&ticket, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

func (r *gormSupportRepository) UpdateTicket(ctx context.Context, id uuid.UUID, response string, status string) error {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"updated_at": now,
	}
	if status != "" {
		updates["status"] = status
	}
	if response != "" {
		updates["admin_response"] = response
		updates["responded_at"] = now
	}
	return r.db.WithContext(ctx).Model(&models.SupportTicket{}).Where("id = ?", id).Updates(updates).Error
}
