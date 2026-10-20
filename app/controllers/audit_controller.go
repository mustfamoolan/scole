package controllers

import (
	"strconv"

	"institute/app/middleware"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AuditController exposes HTTP endpoints for querying audit logs.
type AuditController struct {
	auditService services.AuditService
}

// NewAuditController creates a new AuditController.
func NewAuditController(auditService services.AuditService) *AuditController {
	return &AuditController{auditService: auditService}
}

// ListPlatformAuditLogs handles GET /api/v1/platform/audit-logs
func (ctrl *AuditController) ListPlatformAuditLogs(c *fiber.Ctx) error {
	action := c.Query("action")
	tenantIDStr := c.Query("tenant_id")
	limitStr := c.Query("limit", "20")
	offsetStr := c.Query("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	var tenantID *uuid.UUID
	if tenantIDStr != "" {
		if parsed, err := uuid.Parse(tenantIDStr); err == nil {
			tenantID = &parsed
		}
	}

	logs, total, err := ctrl.auditService.ListPlatformLogs(c.UserContext(), action, tenantID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "AUDIT_QUERY_FAILED",
				"message": "فشل استرجاع سجلات التدقيق",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"meta": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// ListTenantAuditLogs handles GET /api/v1/tenant/admin/audit-logs
func (ctrl *AuditController) ListTenantAuditLogs(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "TENANT_REQUIRED",
				"message": "سياق المعهد مطلوب",
			},
		})
	}

	limitStr := c.Query("limit", "20")
	offsetStr := c.Query("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	logs, total, err := ctrl.auditService.ListTenantLogs(c.UserContext(), tenant.ID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "AUDIT_QUERY_FAILED",
				"message": "فشل استرجاع سجلات التدقيق للمعهد",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"meta": fiber.Map{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}
