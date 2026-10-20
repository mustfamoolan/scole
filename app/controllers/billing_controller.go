package controllers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// BillingController handles plan management, subscription operations, and financial receipt endpoints.
type BillingController struct {
	billingService *services.BillingService
}

// NewBillingController creates a new BillingController.
func NewBillingController(s *services.BillingService) *BillingController {
	return &BillingController{billingService: s}
}

// CreatePlan handles platform administrator creation of plans with whole Iraqi Dinars pricing.
func (ctrl *BillingController) CreatePlan(c *fiber.Ctx) error {
	var req services.CreatePlanRequest
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

	plan, err := ctrl.billingService.CreatePlan(c.UserContext(), req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "PLAN_CREATION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"plan":    plan,
	})
}

// ListAllPlans returns paginated plans for platform administrators.
func (ctrl *BillingController) ListAllPlans(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)

	plans, total, err := ctrl.billingService.ListAllPlans(c.UserContext(), page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to list plans",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    plans,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// UpdatePlan handles updating an existing plan by platform administrators.
func (ctrl *BillingController) UpdatePlan(c *fiber.Ctx) error {
	idParam := c.Params("id")
	planID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for plan ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.UpdatePlanRequest
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

	plan, err := ctrl.billingService.UpdatePlan(c.UserContext(), planID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
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
		"plan":    plan,
	})
}

// DeletePlan handles platform administrator deletion of a plan.
func (ctrl *BillingController) DeletePlan(c *fiber.Ctx) error {
	idParam := c.Params("id")
	planID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for plan ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.billingService.DeletePlan(c.UserContext(), planID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DELETE_PLAN_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Plan deleted successfully",
	})
}

// TogglePlanStatus toggles active state of a plan.
func (ctrl *BillingController) TogglePlanStatus(c *fiber.Ctx) error {
	idParam := c.Params("id")
	planID, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid UUID format for plan ID",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	plan, err := ctrl.billingService.TogglePlanStatus(c.UserContext(), planID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TOGGLE_STATUS_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"plan":    plan,
	})
}

// UploadPlanImage handles uploading an image file from the device for subscription plans.
func (ctrl *BillingController) UploadPlanImage(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		file, err = c.FormFile("file")
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NO_FILE",
				"message": "لم يتم العثور على ملف مرفوع في الطلب",
			},
		})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".svg" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_IMAGE_TYPE",
				"message": "نوع الصورة غير مدعوم. يرجى رفع ملف JPG أو PNG أو WEBP أو SVG",
			},
		})
	}

	uploadDir := "./public/uploads/plans"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPLOAD_DIR_ERROR",
				"message": "فشل إنشاء مجلد رفع الصور",
			},
		})
	}

	filename := fmt.Sprintf("plan_%s%s", uuid.New().String(), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SAVE_FILE_ERROR",
				"message": "فشل حفظ ملف الصورة المرفوع",
			},
		})
	}

	publicURL := fmt.Sprintf("/uploads/plans/%s", filename)
	return c.JSON(fiber.Map{
		"success": true,
		"url":     publicURL,
	})
}

// ListPublicPlans returns all active plans for public or tenant view.
func (ctrl *BillingController) ListPublicPlans(c *fiber.Ctx) error {
	plans, err := ctrl.billingService.ListActivePlans(c.UserContext())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to list active plans",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    plans,
	})
}

// CreateSubscriptionRequest payload for platform subscription assignment.
type CreateSubscriptionRequest struct {
	TenantID     uuid.UUID `json:"tenant_id"`
	PlanID       uuid.UUID `json:"plan_id"`
	DurationDays int       `json:"duration_days"`
}

// CreateSubscription allows platform admins to provision or assign a subscription.
func (ctrl *BillingController) CreateSubscription(c *fiber.Ctx) error {
	var req CreateSubscriptionRequest
	if err := c.BodyParser(&req); err != nil || req.TenantID == uuid.Nil || req.PlanID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "tenant_id and plan_id are required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	sub, err := ctrl.billingService.CreateSubscription(c.UserContext(), req.TenantID, req.PlanID, req.DurationDays)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "SUBSCRIPTION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// RenewSubscriptionPayload payload for extending subscription.
type RenewSubscriptionPayload struct {
	ExtensionDays int `json:"extension_days"`
}

// RenewSubscription extends an existing subscription.
func (ctrl *BillingController) RenewSubscription(c *fiber.Ctx) error {
	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid subscription ID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req RenewSubscriptionPayload
	_ = c.BodyParser(&req)
	if req.ExtensionDays <= 0 {
		req.ExtensionDays = 30
	}

	sub, err := ctrl.billingService.RenewSubscription(c.UserContext(), subID, req.ExtensionDays)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "RENEWAL_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// ActivateSubscriptionPayload payload for platform admin activation.
type ActivateSubscriptionPayload struct {
	ExtensionDays int `json:"extension_days"`
}

// ActivateSubscription officially activates a trialing or pending subscription.
func (ctrl *BillingController) ActivateSubscription(c *fiber.Ctx) error {
	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid subscription ID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req ActivateSubscriptionPayload
	_ = c.BodyParser(&req)
	if req.ExtensionDays <= 0 {
		req.ExtensionDays = 30
	}

	sub, err := ctrl.billingService.ActivateSubscription(c.UserContext(), subID, req.ExtensionDays)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "ACTIVATION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// ChangePlanRequest specifies payload for upgrading or switching subscription tier.
type ChangePlanRequest struct {
	PlanID uuid.UUID `json:"plan_id"`
}

// ChangePlan updates an active subscription to a new plan immediately.
func (ctrl *BillingController) ChangePlan(c *fiber.Ctx) error {
	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid subscription ID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req ChangePlanRequest
	if err := c.BodyParser(&req); err != nil || req.PlanID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "plan_id is required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	sub, err := ctrl.billingService.ChangePlanBySubscription(c.UserContext(), subID, req.PlanID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "CHANGE_PLAN_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// CancelSubscription marks a subscription as canceled while retaining data.
func (ctrl *BillingController) CancelSubscription(c *fiber.Ctx) error {
	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid subscription ID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	sub, err := ctrl.billingService.CancelSubscription(c.UserContext(), subID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "CANCELLATION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// ListAllSubscriptions returns paginated subscriptions across all tenants for Platform Admin.
func (ctrl *BillingController) ListAllSubscriptions(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)

	subs, total, err := ctrl.billingService.ListAllSubscriptions(c.UserContext(), page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to list subscriptions",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    subs,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// RecordPaymentRequestPayload defines payload for recording manual receipt.
type RecordPaymentRequestPayload struct {
	TenantID       uuid.UUID  `json:"tenant_id"`
	SubscriptionID *uuid.UUID `json:"subscription_id,omitempty"`
	AmountIQD      int64      `json:"amount_iqd"` // Strictly whole Iraqi Dinars (no fils)
	PaymentMethod  string     `json:"payment_method"`
	ReferenceNote  string     `json:"reference_note,omitempty"`
}

// RecordPayment creates an immutable payment receipt in whole Iraqi Dinars (IQD).
func (ctrl *BillingController) RecordPayment(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "UNAUTHORIZED",
				Message: "Authentication required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req RecordPaymentRequestPayload
	if err := c.BodyParser(&req); err != nil || req.TenantID == uuid.Nil || req.AmountIQD <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_REQUEST",
				Message: "tenant_id and a positive amount_iqd in whole Dinars are required",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	receipt, err := ctrl.billingService.RecordManualPayment(c.UserContext(), req.TenantID, user.ID, services.RecordPaymentRequest{
		SubscriptionID: req.SubscriptionID,
		AmountIQD:      req.AmountIQD,
		PaymentMethod:  req.PaymentMethod,
		ReferenceNote:  req.ReferenceNote,
	})
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "PAYMENT_RECORDING_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"receipt": receipt,
	})
}

// ListAllReceipts returns paginated payment receipts across platform for auditing.
func (ctrl *BillingController) ListAllReceipts(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)

	receipts, total, err := ctrl.billingService.ListAllReceipts(c.UserContext(), page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to list payment receipts",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    receipts,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetTenantSubscription returns the active subscription for the resolved institute.
func (ctrl *BillingController) GetTenantSubscription(c *fiber.Ctx) error {
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

	sub, err := ctrl.billingService.GetActiveSubscription(c.UserContext(), tenantID)
	if err != nil {
		if errors.Is(err, models.ErrSubscriptionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success: false,
				Error: middleware.ErrorDetail{
					Code:    "NO_ACTIVE_SUBSCRIPTION",
					Message: "Institute has no active subscription",
				},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to fetch subscription",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"subscription": sub,
	})
}

// ListTenantReceipts returns all receipts belonging to the current institute.
func (ctrl *BillingController) ListTenantReceipts(c *fiber.Ctx) error {
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

	receipts, err := ctrl.billingService.ListTenantReceipts(c.UserContext(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "DATABASE_ERROR",
				Message: "Failed to fetch institute receipts",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    receipts,
	})
}
