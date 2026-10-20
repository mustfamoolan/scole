package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AuditService handles recording and querying immutable audit trails.
type AuditService interface {
	Log(ctx context.Context, log *models.AuditLog) error
	LogEvent(ctx context.Context, tenantID *uuid.UUID, userID *uuid.UUID, role, action, entityType, entityID string, details map[string]interface{}, ip, userAgent string) error
	ListPlatformLogs(ctx context.Context, action string, tenantID *uuid.UUID, limit, offset int) ([]models.AuditLog, int64, error)
	ListTenantLogs(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.AuditLog, int64, error)
}

type auditService struct {
	repo   repositories.AuditLogRepository
	logger *zap.Logger
}

// NewAuditService constructs a new AuditService instance.
func NewAuditService(repo repositories.AuditLogRepository, logger *zap.Logger) AuditService {
	return &auditService{
		repo:   repo,
		logger: logger,
	}
}

func (s *auditService) Log(ctx context.Context, log *models.AuditLog) error {
	if err := log.Validate(); err != nil {
		return fmt.Errorf("invalid audit log: %w", err)
	}

	if err := s.repo.Create(ctx, log); err != nil {
		if s.logger != nil {
			s.logger.Error("Failed to persist audit log",
				zap.String("action", log.Action),
				zap.String("entity_type", log.EntityType),
				zap.Error(err),
			)
		}
		return err
	}
	return nil
}

func (s *auditService) LogEvent(ctx context.Context, tenantID *uuid.UUID, userID *uuid.UUID, role, action, entityType, entityID string, details map[string]interface{}, ip, userAgent string) error {
	detailsJSON := "{}"
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		}
	}

	entry := &models.AuditLog{
		ID:         uuid.New(),
		TenantID:   tenantID,
		UserID:     userID,
		ActorRole:  role,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Details:    detailsJSON,
		IPAddress:  ip,
		UserAgent:  userAgent,
		CreatedAt:  time.Now().UTC(),
	}

	return s.Log(ctx, entry)
}

func (s *auditService) ListPlatformLogs(ctx context.Context, action string, tenantID *uuid.UUID, limit, offset int) ([]models.AuditLog, int64, error) {
	return s.repo.ListPlatform(ctx, action, tenantID, limit, offset)
}

func (s *auditService) ListTenantLogs(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.AuditLog, int64, error) {
	return s.repo.ListTenant(ctx, tenantID, limit, offset)
}
