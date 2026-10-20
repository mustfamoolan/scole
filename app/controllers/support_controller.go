package controllers

import (
	"strconv"

	"institute/app/middleware"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SupportController struct {
	supportService services.SupportService
}

func NewSupportController(supportService services.SupportService) *SupportController {
	return &SupportController{supportService: supportService}
}

// SubmitLandingInquiry handles public POST /api/v1/public/inquiries
func (ctrl *SupportController) SubmitLandingInquiry(c *fiber.Ctx) error {
	var body struct {
		FullName      string `json:"full_name"`
		Phone         string `json:"phone"`
		InstituteName string `json:"institute_name"`
		RequestType   string `json:"request_type"`
		Notes         string `json:"notes"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_PAYLOAD",
				"message": "Invalid request payload",
			},
		})
	}

	inquiry, err := ctrl.supportService.SubmitLandingInquiry(
		c.UserContext(),
		body.FullName,
		body.Phone,
		body.InstituteName,
		body.RequestType,
		body.Notes,
	)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INQUIRY_SUBMISSION_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    inquiry,
		"message": "تم استلام طلبكم بنجاح وسيتواصل معكم فريق المنصة قريباً",
	})
}

// ListInquiries handles GET /api/v1/platform/inquiries
func (ctrl *SupportController) ListInquiries(c *fiber.Ctx) error {
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	inquiries, total, err := ctrl.supportService.ListInquiries(c.UserContext(), status, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_INQUIRIES_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    inquiries,
		"total":   total,
	})
}

// UpdateInquiryStatus handles PUT /api/v1/platform/inquiries/:id/status
func (ctrl *SupportController) UpdateInquiryStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_ID",
				"message": "Invalid inquiry ID",
			},
		})
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PAYLOAD", "message": "Invalid request body"},
		})
	}

	if err := ctrl.supportService.UpdateInquiryStatus(c.UserContext(), id, body.Status); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UPDATE_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Inquiry status updated",
	})
}

// ConvertInquiryToTenant handles POST /api/v1/platform/inquiries/:id/convert
func (ctrl *SupportController) ConvertInquiryToTenant(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_ID", "message": "Invalid inquiry ID"},
		})
	}

	var body struct {
		Slug          string `json:"slug"`
		AdminEmail    string `json:"admin_email"`
		AdminPassword string `json:"admin_password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PAYLOAD", "message": "Invalid request body"},
		})
	}

	tenant, err := ctrl.supportService.ConvertInquiryToTenant(c.UserContext(), id, body.Slug, body.AdminEmail, body.AdminPassword)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "CONVERSION_FAILED",
				"message": err.Error(),
			},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    tenant,
		"message": "تم تحويل الطلب وإنشاء حساب المعهد بنجاح",
	})
}

// ListTickets handles platform admin GET /api/v1/platform/support/tickets
func (ctrl *SupportController) ListTickets(c *fiber.Ctx) error {
	status := c.Query("status")
	var tenantID *uuid.UUID
	if tIDStr := c.Query("tenant_id"); tIDStr != "" {
		if parsed, err := uuid.Parse(tIDStr); err == nil {
			tenantID = &parsed
		}
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	tickets, total, err := ctrl.supportService.ListTickets(c.UserContext(), tenantID, status, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "FETCH_TICKETS_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    tickets,
		"total":   total,
	})
}

// RespondTicket handles platform admin POST /api/v1/platform/support/tickets/:id/respond
func (ctrl *SupportController) RespondTicket(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_ID", "message": "Invalid ticket ID"},
		})
	}

	var body struct {
		Response string `json:"response"`
		Status   string `json:"status"` // resolved, in_progress, closed
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PAYLOAD", "message": "Invalid request body"},
		})
	}

	if err := ctrl.supportService.RespondToTicket(c.UserContext(), id, body.Response, body.Status); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "RESPOND_TICKET_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تحديث التذكرة والرد بنجاح",
	})
}

// CreateTenantTicket handles tenant admin POST /api/v1/tenant/admin/support/tickets
func (ctrl *SupportController) CreateTenantTicket(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok || tenantID == uuid.Nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED_TENANT", "message": "Tenant context required"},
		})
	}

	userID, ok := middleware.GetUserID(c)
	if !ok || userID == uuid.Nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED_USER", "message": "User context required"},
		})
	}

	var body struct {
		Subject     string `json:"subject"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PAYLOAD", "message": "Invalid request body"},
		})
	}

	ticket, err := ctrl.supportService.CreateTicket(c.UserContext(), tenantID, userID, body.Subject, body.Description, body.Priority)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "CREATE_TICKET_FAILED", "message": err.Error()},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    ticket,
	})
}

// ListTenantTickets handles tenant admin GET /api/v1/tenant/admin/support/tickets
func (ctrl *SupportController) ListTenantTickets(c *fiber.Ctx) error {
	tenantID, ok := middleware.GetTenantID(c)
	if !ok || tenantID == uuid.Nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED_TENANT", "message": "Tenant context required"},
		})
	}

	status := c.Query("status")
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	tickets, total, err := ctrl.supportService.ListTickets(c.UserContext(), &tenantID, status, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "FETCH_TICKETS_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    tickets,
		"total":   total,
	})
}
