package services

import (
	"context"
	"errors"
	"strings"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
)

type SupportService interface {
	SubmitLandingInquiry(ctx context.Context, fullName, phone, instituteName, requestType, notes string) (*models.LandingInquiry, error)
	ListInquiries(ctx context.Context, status string, limit, offset int) ([]models.LandingInquiry, int64, error)
	UpdateInquiryStatus(ctx context.Context, id uuid.UUID, status string) error
	ConvertInquiryToTenant(ctx context.Context, inquiryID uuid.UUID, slug, adminEmail, adminPassword string) (*models.Tenant, error)

	CreateTicket(ctx context.Context, tenantID, userID uuid.UUID, subject, description, priority string) (*models.SupportTicket, error)
	ListTickets(ctx context.Context, tenantID *uuid.UUID, status string, limit, offset int) ([]models.SupportTicket, int64, error)
	RespondToTicket(ctx context.Context, id uuid.UUID, response, status string) error
}

type supportService struct {
	supportRepo  repositories.SupportRepository
	tenantMgmt   *TenantManagementService
	auditService AuditService
}

func NewSupportService(
	supportRepo repositories.SupportRepository,
	tenantMgmt *TenantManagementService,
	auditService AuditService,
) SupportService {
	return &supportService{
		supportRepo:  supportRepo,
		tenantMgmt:   tenantMgmt,
		auditService: auditService,
	}
}

func (s *supportService) SubmitLandingInquiry(ctx context.Context, fullName, phone, instituteName, requestType, notes string) (*models.LandingInquiry, error) {
	inquiry := &models.LandingInquiry{
		FullName:      strings.TrimSpace(fullName),
		Phone:         strings.TrimSpace(phone),
		InstituteName: strings.TrimSpace(instituteName),
		RequestType:   strings.TrimSpace(requestType),
		Notes:         strings.TrimSpace(notes),
		Status:        "pending",
	}

	if err := inquiry.Validate(); err != nil {
		return nil, err
	}

	if err := s.supportRepo.CreateInquiry(ctx, inquiry); err != nil {
		return nil, err
	}

	return inquiry, nil
}

func (s *supportService) ListInquiries(ctx context.Context, status string, limit, offset int) ([]models.LandingInquiry, int64, error) {
	return s.supportRepo.ListInquiries(ctx, status, limit, offset)
}

func (s *supportService) UpdateInquiryStatus(ctx context.Context, id uuid.UUID, status string) error {
	return s.supportRepo.UpdateInquiryStatus(ctx, id, status, nil)
}

func (s *supportService) ConvertInquiryToTenant(ctx context.Context, inquiryID uuid.UUID, slug, adminEmail, adminPassword string) (*models.Tenant, error) {
	inquiry, err := s.supportRepo.FindInquiryByID(ctx, inquiryID)
	if err != nil {
		return nil, err
	}
	if inquiry == nil {
		return nil, errors.New("inquiry not found")
	}

	phone := inquiry.Phone
	email := adminEmail
	req := CreateInstituteRequest{
		Name:          inquiry.InstituteName,
		Slug:          slug,
		Email:         &email,
		Phone:         &phone,
		AdminName:     inquiry.FullName,
		AdminEmail:    adminEmail,
		AdminPassword: adminPassword,
	}

	tenant, _, err := s.tenantMgmt.CreateInstitute(ctx, req)
	if err != nil {
		return nil, err
	}

	// Update inquiry status to converted
	_ = s.supportRepo.UpdateInquiryStatus(ctx, inquiryID, "converted", &tenant.ID)

	return tenant, nil
}

func (s *supportService) CreateTicket(ctx context.Context, tenantID, userID uuid.UUID, subject, description, priority string) (*models.SupportTicket, error) {
	ticket := &models.SupportTicket{
		TenantID:    tenantID,
		UserID:      userID,
		Subject:     strings.TrimSpace(subject),
		Description: strings.TrimSpace(description),
		Priority:    priority,
		Status:      "open",
	}

	if err := ticket.Validate(); err != nil {
		return nil, err
	}

	if err := s.supportRepo.CreateTicket(ctx, ticket); err != nil {
		return nil, err
	}

	return ticket, nil
}

func (s *supportService) ListTickets(ctx context.Context, tenantID *uuid.UUID, status string, limit, offset int) ([]models.SupportTicket, int64, error) {
	return s.supportRepo.ListTickets(ctx, tenantID, status, limit, offset)
}

func (s *supportService) RespondToTicket(ctx context.Context, id uuid.UUID, response, status string) error {
	return s.supportRepo.UpdateTicket(ctx, id, response, status)
}
