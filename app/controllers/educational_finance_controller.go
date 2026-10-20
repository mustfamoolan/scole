package controllers

import (
	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EducationalFinanceController struct {
	db         *gorm.DB
	financeSvc *services.EducationalFinanceService
}

func NewEducationalFinanceController(db *gorm.DB, s *services.EducationalFinanceService) *EducationalFinanceController {
	return &EducationalFinanceController{db: db, financeSvc: s}
}

// CreateCharge posts a new fee accrual for a student.
func (ctrl *EducationalFinanceController) CreateCharge(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_NOT_RESOLVED",
				Message: "Tenant context is required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.CreateChargeRequest
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

	accrual, err := ctrl.financeSvc.CreateChargeAccrual(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "CHARGE_CREATION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    accrual,
	})
}

// ListStudentCharges returns all financial accruals for a student.
func (ctrl *EducationalFinanceController) ListStudentCharges(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	studentID, err := uuid.Parse(c.Params("student_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid student UUID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var accruals []models.ChargeAccrual
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND student_profile_id = ?", tenant.ID, studentID).
		Preload("Discounts").
		Preload("Allocations").
		Find(&accruals).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "QUERY_ERROR",
				Message: "Failed to retrieve student accruals",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    accruals,
	})
}

// CollectPayment receives funds and allocates them to accruals atomically (Scenario 8).
func (ctrl *EducationalFinanceController) CollectPayment(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TENANT_NOT_RESOLVED",
				Message: "Tenant context is required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.CollectPaymentRequest
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

	user := middleware.GetUser(c)
	if user != nil {
		req.CashierUserID = user.ID
	}

	payment, err := ctrl.financeSvc.CollectPaymentAndAllocate(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "PAYMENT_COLLECTION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    payment,
	})
}

// ProcessRefund returns funds with an immutable link to the original payment receipt (Scenario 14).
func (ctrl *EducationalFinanceController) ProcessRefund(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req services.ProcessRefundRequest
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

	user := middleware.GetUser(c)
	if user != nil {
		req.ApprovedByUserID = user.ID
	}

	refund, err := ctrl.financeSvc.ProcessRefund(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "REFUND_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    refund,
	})
}
