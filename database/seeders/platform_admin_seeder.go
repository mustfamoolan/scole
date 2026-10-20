package seeders

import (
	"errors"
	"fmt"
	"institute/app/models"
	"institute/app/services"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PlatformAdminSeeder seeds the centralized platform superadmins.
type PlatformAdminSeeder struct{}

func (s *PlatformAdminSeeder) Run(db *gorm.DB) error {
	password := "12345678"
	hash, err := services.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	admins := []struct {
		Email string
		Name  string
	}{
		{Email: "admin@platform.com", Name: "المدير المركزي للمنصة"},
		{Email: "admin@fistudy.iq", Name: "مدير عام المنصة"},
	}

	for _, adm := range admins {
		normEmail := models.NormalizeEmail(adm.Email)
		var existing models.User
		err := db.Where("email = ? AND tenant_id IS NULL", normEmail).First(&existing).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				newUser := models.User{
					ID:           uuid.New(),
					TenantID:     nil,
					Name:         adm.Name,
					Email:        normEmail,
					PasswordHash: hash,
					Role:         models.RolePlatformAdmin,
					Status:       models.UserStatusActive,
				}
				if err := db.Create(&newUser).Error; err != nil {
					return fmt.Errorf("failed to create platform admin %s: %w", normEmail, err)
				}
			} else {
				return fmt.Errorf("failed to query existing platform admin %s: %w", normEmail, err)
			}
		} else {
			existing.PasswordHash = hash
			existing.Role = models.RolePlatformAdmin
			existing.Status = models.UserStatusActive
			existing.Name = adm.Name
			if err := db.Save(&existing).Error; err != nil {
				return fmt.Errorf("failed to update platform admin %s: %w", normEmail, err)
			}
		}
	}

	return nil
}
