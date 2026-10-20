package controllers

import (
	"strings"
	"time"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type HRController struct {
	db            *gorm.DB
	workforceSvc  *services.WorkforceService
	contractSvc   *services.ContractService
	teachingSvc   *services.TeachingService
	attendanceSvc *services.StaffAttendanceService
	payoutSvc     *services.TeacherPayoutService
}

func NewHRController(
	db *gorm.DB,
	workforceSvc *services.WorkforceService,
	contractSvc *services.ContractService,
	teachingSvc *services.TeachingService,
	attendanceSvc *services.StaffAttendanceService,
	payoutSvc *services.TeacherPayoutService,
) *HRController {
	return &HRController{
		db:            db,
		workforceSvc:  workforceSvc,
		contractSvc:   contractSvc,
		teachingSvc:   teachingSvc,
		attendanceSvc: attendanceSvc,
		payoutSvc:     payoutSvc,
	}
}

// CreateStaff handles hiring a new staff member.
func (ctrl *HRController) CreateStaff(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.CreateStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Malformed JSON payload"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	staff, err := ctrl.workforceSvc.CreateStaffProfile(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "STAFF_CREATION_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    staff,
	})
}

// ListStaff returns all staff members belonging to the current tenant.
func (ctrl *HRController) ListStaff(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var staffList []models.StaffProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("Person").
		Preload("Assignments.Position").
		Preload("Assignments.Department").
		Find(&staffList).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to query staff"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    staffList,
	})
}

// CreateTeacher handles adding a teacher profile.
func (ctrl *HRController) CreateTeacher(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.CreateTeacherProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Malformed JSON payload"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	teacher, err := ctrl.teachingSvc.CreateTeacherProfile(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TEACHER_CREATION_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    teacher,
	})
}

// ListTeachers returns all teacher profiles belonging to the current tenant.
func (ctrl *HRController) ListTeachers(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var teachers []models.TeacherProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("Person.CommunicationChannels").
		Preload("Person").
		Preload("StaffProfile").
		Find(&teachers).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to query teachers"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    teachers,
	})
}

// GetTeacher returns a single teacher profile with full relations and assignments.
func (ctrl *HRController) GetTeacher(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	teacherID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "Invalid teacher ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var teacher models.TeacherProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", teacherID, tenant.ID).
		Preload("Person.CommunicationChannels").
		Preload("Person").
		Preload("StaffProfile").
		First(&teacher).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "Teacher profile not found"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var assignments []models.TeacherAssignment
	ctrl.db.WithContext(c.UserContext()).
		Where("teacher_profile_id = ? AND tenant_id = ?", teacherID, tenant.ID).
		Preload("AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		Preload("AdoptedCurriculum.StudyGrade.EducationalProgram").
		Preload("ClassSection").
		Find(&assignments)

	return c.JSON(fiber.Map{
		"success":     true,
		"data":        teacher,
		"assignments": assignments,
	})
}

// UpdateTeacher handles updating an existing teacher's profile and personal identity.
func (ctrl *HRController) UpdateTeacher(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	teacherID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "Invalid teacher ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		FirstName      string           `json:"first_name"`
		FatherName     *string          `json:"father_name,omitempty"`
		LastName       string           `json:"last_name"`
		Gender         string           `json:"gender"`
		Specialization *string          `json:"specialization,omitempty"`
		EmploymentType string           `json:"employment_type"`
		HourlyRate     *decimal.Decimal `json:"hourly_rate,omitempty"`
		MonthlySalary  *decimal.Decimal `json:"monthly_salary,omitempty"`
		Status         string           `json:"status"`
		Phone          *string          `json:"phone,omitempty"`
		Email          *string          `json:"email,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Malformed JSON payload"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var teacher models.TeacherProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Preload("Person").
		First(&teacher, "id = ? AND tenant_id = ?", teacherID, tenant.ID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "Teacher profile not found"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Update Teacher Profile fields
	if req.Specialization != nil {
		teacher.Specialization = req.Specialization
	}
	if req.EmploymentType != "" {
		teacher.EmploymentType = req.EmploymentType
	}
	if req.HourlyRate != nil {
		teacher.HourlyRate = req.HourlyRate
	}
	if req.MonthlySalary != nil {
		teacher.MonthlySalary = req.MonthlySalary
	}
	if req.Status != "" {
		teacher.Status = req.Status
	}

	if err := ctrl.db.WithContext(c.UserContext()).Save(&teacher).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPDATE_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Update associated Person name if provided
	if req.FirstName != "" && req.LastName != "" && teacher.PersonID != uuid.Nil {
		ctrl.db.WithContext(c.UserContext()).Model(&models.Person{}).
			Where("id = ?", teacher.PersonID).
			Updates(map[string]interface{}{
				"first_name":  strings.TrimSpace(req.FirstName),
				"father_name": req.FatherName,
				"last_name":   strings.TrimSpace(req.LastName),
				"gender":      strings.ToLower(strings.TrimSpace(req.Gender)),
			})
	}

	// Update or insert phone communication channel
	if req.Phone != nil && teacher.PersonID != uuid.Nil {
		phoneVal := strings.TrimSpace(*req.Phone)
		var ch models.CommunicationChannel
		if err := ctrl.db.WithContext(c.UserContext()).
			Where("person_id = ? AND channel_type = ?", teacher.PersonID, "phone").
			First(&ch).Error; err != nil {
			if phoneVal != "" {
				ctrl.db.WithContext(c.UserContext()).Create(&models.CommunicationChannel{
					PersonID:     teacher.PersonID,
					ChannelType:  "phone",
					ChannelValue: phoneVal,
					IsPrimary:    true,
				})
			}
		} else {
			ctrl.db.WithContext(c.UserContext()).Model(&ch).Update("channel_value", phoneVal)
		}
	}

	// Update or insert email communication channel
	if req.Email != nil && teacher.PersonID != uuid.Nil {
		emailVal := strings.TrimSpace(*req.Email)
		var ch models.CommunicationChannel
		if err := ctrl.db.WithContext(c.UserContext()).
			Where("person_id = ? AND channel_type = ?", teacher.PersonID, "email").
			First(&ch).Error; err != nil {
			if emailVal != "" {
				ctrl.db.WithContext(c.UserContext()).Create(&models.CommunicationChannel{
					PersonID:     teacher.PersonID,
					ChannelType:  "email",
					ChannelValue: emailVal,
					IsPrimary:    true,
				})
			}
		} else {
			ctrl.db.WithContext(c.UserContext()).Model(&ch).Update("channel_value", emailVal)
		}
	}

	// Re-fetch complete object
	ctrl.db.WithContext(c.UserContext()).
		Preload("Person.CommunicationChannels").
		Preload("Person").
		Preload("StaffProfile").
		First(&teacher, "id = ?", teacherID)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    teacher,
	})
}

// ToggleTeacherStatus toggles or sets teacher status (active, inactive, suspended)
func (ctrl *HRController) ToggleTeacherStatus(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	teacherID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "Invalid teacher ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Status field is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).Model(&models.TeacherProfile{}).
		Where("id = ? AND tenant_id = ?", teacherID, tenant.ID).
		Update("status", req.Status).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPDATE_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"status":  req.Status,
	})
}

// ListPayoutAccruals returns payout accruals for teachers.
func (ctrl *HRController) ListPayoutAccruals(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var accruals []models.TeacherPayoutAccrual
	query := ctrl.db.WithContext(c.UserContext()).Where("tenant_id = ?", tenant.ID)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Preload("TeacherProfile.Person").Order("accrual_date DESC").Find(&accruals).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to query accruals"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    accruals,
	})
}

// ApprovePayoutAccrual approves a pending payout.
func (ctrl *HRController) ApprovePayoutAccrual(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	user := middleware.GetUser(c)
	if tenant == nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "Authentication required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	accrualID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_UUID", Message: "Invalid accrual ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	accrual, err := ctrl.payoutSvc.ApprovePayoutAccrual(c.UserContext(), tenant.ID, accrualID, user.ID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "APPROVAL_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    accrual,
	})
}

// DisbursePayout executes payment and marks accrual as paid.
func (ctrl *HRController) DisbursePayout(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	user := middleware.GetUser(c)
	if tenant == nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "Authentication required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	accrualID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_UUID", Message: "Invalid accrual ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req services.ExecutePayoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Malformed JSON payload"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	txn, err := ctrl.payoutSvc.ExecutePayout(c.UserContext(), tenant.ID, accrualID, user.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DISBURSEMENT_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    txn,
	})
}

// ListAdoptedCurricula returns the curricula adopted in this institution for assignment selection.
func (ctrl *HRController) ListAdoptedCurricula(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var list []models.AdoptedCurriculum
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("CurriculumEdition.Definition.Subject").
		Preload("StudyGrade.EducationalProgram").
		Find(&list).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to list curricula"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// CreateTeacherAssignment handles assigning an active teacher to an adopted curriculum/cohort.
func (ctrl *HRController) CreateTeacherAssignment(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	teacherID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "Invalid teacher ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		AdoptedCurriculumID uuid.UUID  `json:"adopted_curriculum_id"`
		ClassSectionID      *uuid.UUID `json:"class_section_id,omitempty"`
		StudyCohortID       *uuid.UUID `json:"study_cohort_id,omitempty"`
		IsLeadTeacher       bool       `json:"is_lead_teacher"`
		StartDate           time.Time  `json:"start_date"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "Malformed JSON payload"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	assignment, err := ctrl.teachingSvc.AssignTeacher(c.UserContext(), tenant.ID, services.AssignTeacherRequest{
		TeacherProfileID:    teacherID,
		AdoptedCurriculumID: req.AdoptedCurriculumID,
		ClassSectionID:      req.ClassSectionID,
		StudyCohortID:       req.StudyCohortID,
		IsLeadTeacher:       req.IsLeadTeacher,
		StartDate:           req.StartDate,
	})
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "ASSIGNMENT_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    assignment,
	})
}

// TerminateTeacherAssignment terminates or completes a teacher assignment.
func (ctrl *HRController) TerminateTeacherAssignment(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	assignID, err := uuid.Parse(c.Params("assignment_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "Invalid assignment ID"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	now := time.Now()
	res := ctrl.db.WithContext(c.UserContext()).Model(&models.TeacherAssignment{}).
		Where("id = ? AND tenant_id = ?", assignID, tenant.ID).
		Updates(map[string]interface{}{
			"status":   "terminated",
			"end_date": &now,
		})
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TERMINATE_FAILED", Message: res.Error.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "Assignment not found"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Teacher assignment terminated successfully",
	})
}
