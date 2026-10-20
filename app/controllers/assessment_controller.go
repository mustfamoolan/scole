package controllers

import (
	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AssessmentController struct {
	db            *gorm.DB
	assessmentSvc *services.AssessmentService
}

func NewAssessmentController(db *gorm.DB, s *services.AssessmentService) *AssessmentController {
	return &AssessmentController{db: db, assessmentSvc: s}
}

// RecordAttendance handles attendance logging for a session.
func (ctrl *AssessmentController) RecordAttendance(c *fiber.Ctx) error {
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

	var req services.RecordAttendanceRequest
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
		req.RecordedByUserID = user.ID
	}

	rec, err := ctrl.assessmentSvc.RecordAttendance(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "ATTENDANCE_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    rec,
	})
}

// SubmitGrade handles submitting an exam or assignment grade.
func (ctrl *AssessmentController) SubmitGrade(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req services.SubmitGradeRequest
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
		req.RecordedByUserID = user.ID
	}

	grade, err := ctrl.assessmentSvc.SubmitGrade(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "GRADE_SUBMISSION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    grade,
	})
}

// ReviseGrade corrects a previously approved grade with mandatory audit log and reason (Scenario 12).
func (ctrl *AssessmentController) ReviseGrade(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	gradeID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid grade UUID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		NewScore          float64 `json:"new_score"`
		Reason            string  `json:"reason"`
		ApprovedRefNumber *string `json:"approved_ref_number,omitempty"`
	}
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
	var modifiedBy uuid.UUID
	if user != nil {
		modifiedBy = user.ID
	}

	if err := ctrl.assessmentSvc.ReviseGradeWithAudit(c.UserContext(), tenant.ID, gradeID, modifiedBy, req.NewScore, req.Reason, req.ApprovedRefNumber); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "GRADE_REVISION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Grade revised and audit log created successfully",
	})
}

// ListStudentGrades returns a student's grade records including their audit history.
func (ctrl *AssessmentController) ListStudentGrades(c *fiber.Ctx) error {
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

	var grades []models.StudentGradeRecord
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND student_profile_id = ?", tenant.ID, studentID).
		Preload("AuditLogs").
		Find(&grades).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "QUERY_ERROR",
				Message: "Failed to retrieve student grades",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    grades,
	})
}
