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
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("a user with this email already exists")
)

// UserRepository defines data access methods for User entities.
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	FindByEmailPlatform(ctx context.Context, email string) (*models.User, error)
	FindByEmailTenant(ctx context.Context, tenantID uuid.UUID, email string) (*models.User, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID, t time.Time) error
	Update(ctx context.Context, user *models.User) error
}

type gormUserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new GORM-backed UserRepository.
func NewUserRepository(db *gorm.DB) UserRepository {
	return &gormUserRepository{db: db}
}

func (r *gormUserRepository) Create(ctx context.Context, user *models.User) error {
	user.Email = models.NormalizeEmail(user.Email)
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *gormUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormUserRepository) FindByEmailPlatform(ctx context.Context, email string) (*models.User, error) {
	normEmail := models.NormalizeEmail(email)
	var user models.User
	err := r.db.WithContext(ctx).
		Where("email = ? AND tenant_id IS NULL", normEmail).
		First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormUserRepository) FindByEmailTenant(ctx context.Context, tenantID uuid.UUID, email string) (*models.User, error) {
	normEmail := models.NormalizeEmail(email)
	var user models.User
	err := r.db.WithContext(ctx).
		Where("email = ? AND tenant_id = ?", normEmail, tenantID).
		First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormUserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID, t time.Time) error {
	return r.db.WithContext(ctx).
		Model(&models.User{}).
		Where("id = ?", id).
		Update("last_login_at", t).Error
}

func (r *gormUserRepository) Update(ctx context.Context, user *models.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}
