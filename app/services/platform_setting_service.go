package services

import (
	"context"

	"institute/app/models"
	"institute/app/repositories"
)

type PlatformSettingService interface {
	GetAllSettings(ctx context.Context) ([]models.PlatformSetting, error)
	GetPublicSettings(ctx context.Context) (map[string]string, error)
	UpdateSettings(ctx context.Context, updates map[string]string) error
}

type platformSettingService struct {
	repo repositories.PlatformSettingRepository
}

func NewPlatformSettingService(repo repositories.PlatformSettingRepository) PlatformSettingService {
	return &platformSettingService{repo: repo}
}

func (s *platformSettingService) GetAllSettings(ctx context.Context) ([]models.PlatformSetting, error) {
	return s.repo.GetAll(ctx)
}

func (s *platformSettingService) GetPublicSettings(ctx context.Context) (map[string]string, error) {
	settings, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, item := range settings {
		result[item.Key] = item.Value
	}
	return result, nil
}

func (s *platformSettingService) UpdateSettings(ctx context.Context, updates map[string]string) error {
	return s.repo.BatchUpdate(ctx, updates)
}
