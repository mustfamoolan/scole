package controllers

import (
	"strings"

	"institute/app/middleware"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
)

// AuthController handles authentication HTTP endpoints.
type AuthController struct {
	authService *services.AuthService
}

// NewAuthController creates a new AuthController.
func NewAuthController(s *services.AuthService) *AuthController {
	return &AuthController{authService: s}
}

// LoginRequest defines login payload.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginPlatform handles centralized platform administrator login.
func (ctrl *AuthController) LoginPlatform(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Email and password are required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	ip := c.IP()
	userAgent := c.Get("User-Agent")
	ctx := c.UserContext()

	user, token, err := ctrl.authService.LoginPlatform(ctx, req.Email, req.Password, ip, userAgent)
	if err != nil {
		status := fiber.StatusUnauthorized
		if err == services.ErrAccountSuspended {
			status = fiber.StatusForbidden
		}
		return c.Status(status).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "AUTH_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"token":   token,
		"user":    user,
	})
}

// LoginTenant handles institute user login strictly bound to the resolved tenant.
func (ctrl *AuthController) LoginTenant(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_CONTEXT_REQUIRED",
				Message: "Institute login must be requested from an institute domain or subdomain",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Email and password are required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	ip := c.IP()
	userAgent := c.Get("User-Agent")
	ctx := c.UserContext()

	user, token, err := ctrl.authService.LoginTenant(ctx, tenantID, req.Email, req.Password, ip, userAgent)
	if err != nil {
		status := fiber.StatusUnauthorized
		if err == services.ErrAccountSuspended {
			status = fiber.StatusForbidden
		}
		return c.Status(status).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "AUTH_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"token":   token,
		"user":    user,
	})
}

// Logout revokes the current session.
func (ctrl *AuthController) Logout(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		_ = ctrl.authService.Logout(c.UserContext(), strings.TrimSpace(parts[1]))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logged out successfully",
	})
}

// Me returns the current authenticated user's profile.
func (ctrl *AuthController) Me(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	tenant := middleware.GetTenant(c)

	return c.JSON(fiber.Map{
		"success": true,
		"user":    user,
		"tenant":  tenant,
	})
}
