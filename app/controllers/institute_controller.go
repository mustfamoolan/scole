package controllers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/repositories"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// InstituteController handles platform institute lifecycle management and tenant profile HTTP endpoints.
type InstituteController struct {
	tenantService  *services.TenantManagementService
	settingService services.PlatformSettingService
}

// NewInstituteController creates a new InstituteController.
func NewInstituteController(s *services.TenantManagementService) *InstituteController {
	return &InstituteController{tenantService: s}
}

// SetSettingService sets the platform settings service.
func (ctrl *InstituteController) SetSettingService(s services.PlatformSettingService) {
	ctrl.settingService = s
}

// SelfRegisterInstitute handles public self-registration from the landing page.
func (ctrl *InstituteController) SelfRegisterInstitute(c *fiber.Ctx) error {
	var req services.SelfRegisterInstituteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Malformed JSON payload in request body",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	trialDays := 14
	if ctrl.settingService != nil {
		pubSettings, err := ctrl.settingService.GetPublicSettings(c.UserContext())
		if err == nil {
			if daysStr, exists := pubSettings["trial_duration_days"]; exists && daysStr != "" {
				if d, parseErr := strconv.Atoi(daysStr); parseErr == nil && d > 0 {
					trialDays = d
				}
			}
		}
	}

	ip := c.IP()
	userAgent := c.Get("User-Agent")

	tenant, admin, sub, token, err := ctrl.tenantService.SelfRegisterInstitute(c.UserContext(), req, trialDays, ip, userAgent)
	if err != nil {
		status := fiber.StatusBadRequest
		code := "VALIDATION_FAILED"

		if errors.Is(err, services.ErrSlugAlreadyTaken) {
			status = fiber.StatusConflict
			code = "SLUG_ALREADY_EXISTS"
		} else if errors.Is(err, models.ErrInvalidSlugFormat) || errors.Is(err, models.ErrReservedSlug) {
			code = "INVALID_SLUG"
		} else if errors.Is(err, services.ErrMissingFields) {
			code = "MISSING_REQUIRED_FIELDS"
		}

		return c.Status(status).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    code,
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"tenant":       tenant,
		"admin":        admin,
		"subscription": sub,
		"token":        token,
		"redirect_url": "http://" + tenant.Slug + ".localhost:8080/dashboard",
	})
}

// UpdateStatusRequest defines the payload for updating an institute's status.
type UpdateStatusRequest struct {
	Status string `json:"status"`
}

// CreateInstitute handles platform administrator creation of an institute with its founding admin.
func (ctrl *InstituteController) CreateInstitute(c *fiber.Ctx) error {
	var req services.CreateInstituteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Malformed JSON payload in request body",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant, admin, err := ctrl.tenantService.CreateInstitute(c.UserContext(), req)
	if err != nil {
		status := fiber.StatusBadRequest
		code := "VALIDATION_FAILED"

		if errors.Is(err, services.ErrSlugAlreadyTaken) {
			status = fiber.StatusConflict
			code = "SLUG_ALREADY_EXISTS"
		} else if errors.Is(err, models.ErrInvalidSlugFormat) || errors.Is(err, models.ErrReservedSlug) {
			code = "INVALID_SLUG"
		} else if errors.Is(err, services.ErrMissingFields) {
			code = "MISSING_REQUIRED_FIELDS"
		}

		return c.Status(status).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    code,
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"tenant":  tenant,
		"admin":   admin,
	})
}

// ListInstitutes returns a paginated list of institutes for platform administrators.
func (ctrl *InstituteController) ListInstitutes(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 20)
	if limit < 1 || limit > 100 {
		limit = 20
	}

	tenants, total, err := ctrl.tenantService.List(c.UserContext(), page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to retrieve institutes",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    tenants,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetInstitute returns an institute's full details by ID for platform administrators.
func (ctrl *InstituteController) GetInstitute(c *fiber.Ctx) error {
	idParam := c.Params("id")
	tenantID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for institute ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant, err := ctrl.tenantService.GetByID(c.UserContext(), tenantID)
	if err != nil {
		if errors.Is(err, repositories.ErrTenantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success: false,
				Error: middleware.ErrorDetail{
					Code:    "NOT_FOUND",
					Message: "Institute not found",
				},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to retrieve institute",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"tenant":  tenant,
	})
}

// UpdateInstituteStatus allows platform administrators to transition an institute's operational status.
func (ctrl *InstituteController) UpdateInstituteStatus(c *fiber.Ctx) error {
	idParam := c.Params("id")
	tenantID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for institute ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Status) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "A valid status field is required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.tenantService.UpdateStatus(c.UserContext(), tenantID, req.Status); err != nil {
		if errors.Is(err, services.ErrInvalidStatus) {
			return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
				Success: false,
				Error: middleware.ErrorDetail{
					Code:    "INVALID_STATUS",
					Message: err.Error(),
				},
				RequestID: middleware.GetRequestID(c),
			})
		}
		if errors.Is(err, repositories.ErrTenantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success: false,
				Error: middleware.ErrorDetail{
					Code:    "NOT_FOUND",
					Message: "Institute not found",
				},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to update institute status",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Institute status updated successfully",
		"status":  strings.ToLower(strings.TrimSpace(req.Status)),
	})
}

// UpdateInstituteByPlatform allows platform administrators to update an institute's core details and visual branding.
func (ctrl *InstituteController) UpdateInstituteByPlatform(c *fiber.Ctx) error {
	idParam := c.Params("id")
	tenantID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for institute ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.UpdateInstituteProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Malformed JSON payload in request body",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant, err := ctrl.tenantService.UpdateProfile(c.UserContext(), tenantID, req)
	if err != nil {
		if errors.Is(err, repositories.ErrTenantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success: false,
				Error: middleware.ErrorDetail{
					Code:    "NOT_FOUND",
					Message: "Institute not found",
				},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to update institute details",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تحديث بيانات وهويّة المعهد بنجاح",
		"tenant":  tenant,
	})
}

// GetTenantProfile allows an authenticated institute admin to retrieve their own institute's profile.
func (ctrl *InstituteController) GetTenantProfile(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_CONTEXT_REQUIRED",
				Message: "Institute context missing from request",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant, err := ctrl.tenantService.GetByID(c.UserContext(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "NOT_FOUND",
				Message: "Institute record not found",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"tenant":  tenant,
	})
}

// UpdateTenantProfile allows an authenticated institute admin to update non-critical profile fields.
func (ctrl *InstituteController) UpdateTenantProfile(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_CONTEXT_REQUIRED",
				Message: "Institute context missing from request",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.UpdateInstituteProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Malformed JSON payload",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant, err := ctrl.tenantService.UpdateProfile(c.UserContext(), tenantID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "UPDATE_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"tenant":  tenant,
	})
}

// UploadTenantLogo handles uploading and saving the institute's logo image.
func (ctrl *InstituteController) UploadTenantLogo(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_CONTEXT_REQUIRED",
				Message: "Institute context missing from request",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	file, err := c.FormFile("logo")
	if err != nil {
		file, err = c.FormFile("file")
	}
	if err != nil {
		file, err = c.FormFile("image")
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "NO_FILE",
				Message: "لم يتم العثور على ملف مرفوع",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".svg" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_IMAGE_TYPE",
				Message: "نوع الصورة غير مدعوم. يرجى رفع ملف JPG أو PNG أو WEBP أو SVG",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	uploadDir := "./public/uploads/logos"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "UPLOAD_DIR_ERROR",
				Message: "فشل إنشاء مجلد حفظ الشعار",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	filename := fmt.Sprintf("logo_%s_%d%s", tenantID.String(), time.Now().Unix(), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "SAVE_FILE_ERROR",
				Message: "فشل حفظ صورة الشعار",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	publicURL := fmt.Sprintf("/uploads/logos/%s", filename)

	// Update tenant profile logo_url automatically
	tenant, err := ctrl.tenantService.UpdateProfile(c.UserContext(), tenantID, services.UpdateInstituteProfileRequest{
		LogoURL: &publicURL,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "UPDATE_FAILED",
				Message: "تم رفع الملف ولكن فشل تحديث سجل المعهد",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"logo_url": publicURL,
		"tenant":   tenant,
	})
}
