package services

import (
	"context"
	"errors"
	"time"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountSuspended   = errors.New("user account is suspended")
	ErrAccountInactive    = errors.New("user account is inactive")
	ErrSessionExpired     = errors.New("session has expired or been revoked")
	ErrUnauthorized       = errors.New("authentication required")
	ErrForbidden          = errors.New("insufficient permissions for this resource")
)

const (
	SessionDuration = 24 * time.Hour
)

// AuthService handles authentication, credential verification, and token sessions.
type AuthService struct {
	userRepo    repositories.UserRepository
	sessionRepo repositories.SessionRepository
}

// NewAuthService creates a new AuthService.
func NewAuthService(u repositories.UserRepository, s repositories.SessionRepository) *AuthService {
	return &AuthService{
		userRepo:    u,
		sessionRepo: s,
	}
}

// LoginPlatform authenticates a platform administrator.
func (s *AuthService) LoginPlatform(ctx context.Context, email, password, ip, userAgent string) (*models.User, string, error) {
	user, err := s.userRepo.FindByEmailPlatform(ctx, email)
	if err != nil {
		zap.L().Warn("Platform login failed: user not found", zap.String("email", models.NormalizeEmail(email)), zap.String("ip", ip))
		return nil, "", ErrInvalidCredentials
	}

	if !CheckPassword(password, user.PasswordHash) {
		zap.L().Warn("Platform login failed: invalid password", zap.String("email", user.Email), zap.String("ip", ip))
		return nil, "", ErrInvalidCredentials
	}

	if user.Status == models.UserStatusSuspended {
		return nil, "", ErrAccountSuspended
	}
	if !user.IsActive() {
		return nil, "", ErrAccountInactive
	}

	rawToken, tokenHash, err := GenerateToken()
	if err != nil {
		return nil, "", err
	}

	session := &models.Session{
		UserID:    user.ID,
		TokenHash: tokenHash,
		IPAddress: ip,
		UserAgent: userAgent,
		ExpiresAt: time.Now().Add(SessionDuration),
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", err
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID, time.Now())
	zap.L().Info("Platform admin logged in successfully", zap.String("user_id", user.ID.String()), zap.String("ip", ip))

	return user, rawToken, nil
}

// CreateSessionForUser generates and persists a new session token for a given user.
func (s *AuthService) CreateSessionForUser(ctx context.Context, userID uuid.UUID, ip, userAgent string) (string, error) {
	rawToken, tokenHash, err := GenerateToken()
	if err != nil {
		return "", err
	}

	session := &models.Session{
		UserID:    userID,
		TokenHash: tokenHash,
		IPAddress: ip,
		UserAgent: userAgent,
		ExpiresAt: time.Now().Add(SessionDuration),
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return "", err
	}

	_ = s.userRepo.UpdateLastLogin(ctx, userID, time.Now())
	return rawToken, nil
}

// LoginTenant authenticates an institute user strictly within a verified tenant boundary.
func (s *AuthService) LoginTenant(ctx context.Context, tenantID uuid.UUID, email, password, ip, userAgent string) (*models.User, string, error) {
	if tenantID == uuid.Nil {
		return nil, "", errors.New("tenant_id is required for institute login")
	}

	user, err := s.userRepo.FindByEmailTenant(ctx, tenantID, email)
	if err != nil {
		zap.L().Warn("Tenant login failed: user not found in tenant",
			zap.String("tenant_id", tenantID.String()),
			zap.String("email", models.NormalizeEmail(email)),
			zap.String("ip", ip),
		)
		return nil, "", ErrInvalidCredentials
	}

	if !CheckPassword(password, user.PasswordHash) {
		zap.L().Warn("Tenant login failed: invalid password",
			zap.String("tenant_id", tenantID.String()),
			zap.String("email", user.Email),
			zap.String("ip", ip),
		)
		return nil, "", ErrInvalidCredentials
	}

	if user.Status == models.UserStatusSuspended {
		return nil, "", ErrAccountSuspended
	}
	if !user.IsActive() {
		return nil, "", ErrAccountInactive
	}

	rawToken, tokenHash, err := GenerateToken()
	if err != nil {
		return nil, "", err
	}

	session := &models.Session{
		UserID:    user.ID,
		TokenHash: tokenHash,
		IPAddress: ip,
		UserAgent: userAgent,
		ExpiresAt: time.Now().Add(SessionDuration),
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", err
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID, time.Now())
	zap.L().Info("Institute user logged in successfully",
		zap.String("tenant_id", tenantID.String()),
		zap.String("user_id", user.ID.String()),
		zap.String("role", user.Role),
	)

	return user, rawToken, nil
}

// ValidateToken validates a raw bearer token, ensuring the session is unrevoked and active.
func (s *AuthService) ValidateToken(ctx context.Context, rawToken string) (*models.User, *models.Session, error) {
	if rawToken == "" {
		return nil, nil, ErrUnauthorized
	}

	tokenHash := HashToken(rawToken)
	session, err := s.sessionRepo.FindByTokenHash(ctx, tokenHash)
	if err != nil || !session.IsValid() {
		return nil, nil, ErrSessionExpired
	}

	user, err := s.userRepo.FindByID(ctx, session.UserID)
	if err != nil || !user.IsActive() {
		return nil, nil, ErrAccountInactive
	}

	return user, session, nil
}

// Logout revokes the session corresponding to rawToken.
func (s *AuthService) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	tokenHash := HashToken(rawToken)
	session, err := s.sessionRepo.FindByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil // idempotent
	}
	return s.sessionRepo.Revoke(ctx, session.ID)
}
