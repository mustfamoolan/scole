package controllers

import (
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
)

type PlatformSettingController struct {
	settingService services.PlatformSettingService
}

func NewPlatformSettingController(settingService services.PlatformSettingService) *PlatformSettingController {
	return &PlatformSettingController{settingService: settingService}
}

// GetPublicSettings handles public GET /api/v1/public/settings
func (ctrl *PlatformSettingController) GetPublicSettings(c *fiber.Ctx) error {
	settings, err := ctrl.settingService.GetPublicSettings(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_SETTINGS_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    settings,
	})
}

// GetAllSettings handles platform admin GET /api/v1/platform/settings
func (ctrl *PlatformSettingController) GetAllSettings(c *fiber.Ctx) error {
	settings, err := ctrl.settingService.GetAllSettings(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_SETTINGS_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    settings,
	})
}

// UpdateSettings handles platform admin PUT /api/v1/platform/settings
func (ctrl *PlatformSettingController) UpdateSettings(c *fiber.Ctx) error {
	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_PAYLOAD",
				"message": "Invalid request body",
			},
		})
	}

	if err := ctrl.settingService.UpdateSettings(c.UserContext(), body); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_SETTINGS_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تحديث إعدادات المنصة بنجاح",
	})
}
