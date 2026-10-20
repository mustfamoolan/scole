package repositories

import (
	"context"
	"errors"
	"time"

	"institute/app/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSessionNotFound = errors.New("session not found")
)

// SessionRepository defines data access methods for Session entities.
type SessionRepository interface {
	Create(ctx context.Context, session *models.Session) error
	FindByTokenHash(ctx context.Context, tokenHash string) (*models.Session, error)
	Revoke(ctx context.Context, id uuid.UUID) error
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}

type gormSessionRepository struct {
	db *gorm.DB
}

// NewSessionRepository creates a new GORM-backed SessionRepository.
func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &gormSessionRepository{db: db}
}

func (r *gormSessionRepository) Create(ctx context.Context, session *models.Session) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *gormSessionRepository) FindByTokenHash(ctx context.Context, tokenHash string) (*models.Session, error) {
	var session models.Session
	err := r.db.WithContext(ctx).First(&session, "token_hash = ?", tokenHash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return &session, nil
}

func (r *gormSessionRepository) Revoke(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Update("revoked_at", now).Error
}

func (r *gormSessionRepository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", now).Error
}
