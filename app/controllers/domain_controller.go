package controllers

import (
	"errors"
	"strings"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DomainController handles custom domain management and verification endpoints.
type DomainController struct {
	domainService *services.DomainService
}

// NewDomainController creates a new DomainController.
func NewDomainController(s *services.DomainService) *DomainController {
	return &DomainController{domainService: s}
}

// RequestDomainPayload defines the payload for requesting domain attachment.
type RequestDomainPayload struct {
	Domain string `json:"domain"`
}

// RequestDomain allows institute administrators to request attaching a custom domain.
func (ctrl *DomainController) RequestDomain(c *fiber.Ctx) error {
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

	var req RequestDomainPayload
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Domain) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "Domain field is required and cannot be empty",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	domain, err := ctrl.domainService.RequestCustomDomain(c.UserContext(), tenantID, req.Domain)
	if err != nil {
		status := fiber.StatusBadRequest
		code := "VALIDATION_FAILED"

		if errors.Is(err, models.ErrDomainAlreadyExists) {
			status = fiber.StatusConflict
			code = "DOMAIN_ALREADY_EXISTS"
		} else if errors.Is(err, models.ErrInvalidDomainFormat) {
			code = "INVALID_DOMAIN_FORMAT"
		} else if errors.Is(err, models.ErrBaseDomainReserved) {
			code = "RESERVED_DOMAIN"
		} else if errors.Is(err, models.ErrTenantSuspended) {
			status = fiber.StatusForbidden
			code = "TENANT_SUSPENDED"
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
		"domain":  domain,
		"instructions": fiber.Map{
			"type":   "TXT",
			"host":   domain.Domain,
			"value":  domain.VerificationToken,
			"action": "Add a DNS TXT record with this value, then trigger verification",
		},
	})
}

// ListTenantDomains returns all custom domains registered for the current institute.
func (ctrl *DomainController) ListTenantDomains(c *fiber.Ctx) error {
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

	domains, err := ctrl.domainService.ListTenantDomains(c.UserContext(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to retrieve institute domains",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    domains,
	})
}

// VerifyDomain triggers DNS verification for a pending domain.
func (ctrl *DomainController) VerifyDomain(c *fiber.Ctx) error {
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

	domainID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for domain ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	domain, err := ctrl.domainService.VerifyDomain(c.UserContext(), tenantID, domainID)
	if err != nil {
		status := fiber.StatusBadRequest
		code := "VERIFICATION_FAILED"

		if errors.Is(err, services.ErrDomainBelongsToAnotherTenant) {
			status = fiber.StatusForbidden
			code = "ACCESS_DENIED"
		} else if errors.Is(err, models.ErrDomainNotFound) {
			status = fiber.StatusNotFound
			code = "NOT_FOUND"
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Domain ownership verified and activated successfully",
		"domain":  domain,
	})
}

// SetPrimaryDomain sets a verified domain as the primary routing domain for the institute.
func (ctrl *DomainController) SetPrimaryDomain(c *fiber.Ctx) error {
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

	domainID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for domain ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.domainService.SetPrimaryDomain(c.UserContext(), tenantID, domainID); err != nil {
		status := fiber.StatusBadRequest
		code := "OPERATION_FAILED"

		if errors.Is(err, services.ErrDomainBelongsToAnotherTenant) {
			status = fiber.StatusForbidden
			code = "ACCESS_DENIED"
		} else if errors.Is(err, services.ErrCannotSetUnverifiedPrimary) {
			code = "UNVERIFIED_DOMAIN"
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Primary domain updated successfully",
	})
}

// DeleteDomain removes a domain attachment.
func (ctrl *DomainController) DeleteDomain(c *fiber.Ctx) error {
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

	domainID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for domain ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.domainService.DeleteDomain(c.UserContext(), tenantID, domainID); err != nil {
		status := fiber.StatusBadRequest
		code := "DELETE_FAILED"

		if errors.Is(err, services.ErrDomainBelongsToAnotherTenant) {
			status = fiber.StatusForbidden
			code = "ACCESS_DENIED"
		} else if errors.Is(err, models.ErrDomainNotFound) {
			status = fiber.StatusNotFound
			code = "NOT_FOUND"
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

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Custom domain removed successfully",
	})
}

// ListAllDomains allows platform administrators to audit custom domains across all institutes.
func (ctrl *DomainController) ListAllDomains(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 20)
	if limit < 1 || limit > 100 {
		limit = 20
	}

	domains, total, err := ctrl.domainService.ListAllDomains(c.UserContext(), page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to retrieve custom domains",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    domains,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}
