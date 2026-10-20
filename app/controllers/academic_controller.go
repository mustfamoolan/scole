package controllers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AcademicController struct {
	db          *gorm.DB
	academicSvc *services.AcademicService
}

func NewAcademicController(db *gorm.DB, s *services.AcademicService) *AcademicController {
	return &AcademicController{db: db, academicSvc: s}
}

// CreateStudent handles student admission and profile creation.
func (ctrl *AcademicController) CreateStudent(c *fiber.Ctx) error {
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

	var req services.CreateStudentRequest
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

	profile, err := ctrl.academicSvc.CreateStudentProfile(c.UserContext(), tenant.ID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "STUDENT_CREATION_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    profile,
	})
}

// UpdateStudent updates an existing student profile in the current tenant.
func (ctrl *AcademicController) UpdateStudent(c *fiber.Ctx) error {
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

	studentID, err := uuid.Parse(c.Params("id"))
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

	var req services.UpdateStudentRequest
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

	profile, err := ctrl.academicSvc.UpdateStudentProfile(c.UserContext(), tenant.ID, studentID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "STUDENT_UPDATE_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    profile,
		"message": "تم تحديث بيانات الطالب بنجاح",
	})
}

// ListStudents returns students belonging strictly to the current tenant.
func (ctrl *AcademicController) ListStudents(c *fiber.Ctx) error {
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

	var students []models.StudentProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("Guardians.GuardianPerson").
		Preload("Guardians.GuardianPerson.CommunicationChannels").
		Order("created_at DESC").
		Find(&students).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "QUERY_ERROR",
				Message: "Failed to retrieve student records",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Fetch active academic enrollments for current tenant
	var enrollments []models.AcademicEnrollment
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND status = 'active'", tenant.ID).
		Preload("ClassSection").
		Preload("StudyCohort").
		Find(&enrollments).Error

	enrollmentMap := make(map[uuid.UUID]models.AcademicEnrollment)
	sectionIDs := make([]uuid.UUID, 0)
	for _, en := range enrollments {
		enrollmentMap[en.StudentProfileID] = en
		if en.ClassSectionID != nil {
			sectionIDs = append(sectionIDs, *en.ClassSectionID)
		}
	}

	// Fetch sections with their StudyGrade and EducationalProgram
	var sections []models.ClassSection
	if len(sectionIDs) > 0 {
		_ = ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND id IN ?", tenant.ID, sectionIDs).
			Find(&sections).Error
	}
	sectionMap := make(map[uuid.UUID]models.ClassSection)
	gradeIDs := make([]uuid.UUID, 0)
	for _, sec := range sections {
		sectionMap[sec.ID] = sec
		gradeIDs = append(gradeIDs, sec.StudyGradeID)
	}

	var grades []models.StudyGrade
	if len(gradeIDs) > 0 {
		_ = ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND id IN ?", tenant.ID, gradeIDs).
			Find(&grades).Error
	}
	gradeMap := make(map[uuid.UUID]models.StudyGrade)
	programIDs := make([]uuid.UUID, 0)
	for _, g := range grades {
		gradeMap[g.ID] = g
		programIDs = append(programIDs, g.EducationalProgramID)
	}

	var programs []models.EducationalProgram
	if len(programIDs) > 0 {
		_ = ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND id IN ?", tenant.ID, programIDs).
			Find(&programs).Error
	}
	progMap := make(map[uuid.UUID]models.EducationalProgram)
	for _, p := range programs {
		progMap[p.ID] = p
	}

	// Fetch guardian profiles in this tenant for AccessCode resolution
	var guardianProfiles []models.GuardianProfile
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Find(&guardianProfiles).Error
	guardianCodeMap := make(map[uuid.UUID]string)
	for _, gp := range guardianProfiles {
		guardianCodeMap[gp.PersonID] = gp.AccessCode
	}

	// Assemble rich student response
	type GuardianDTO struct {
		ID               uuid.UUID `json:"id"`
		PersonID         uuid.UUID `json:"person_id"`
		Name             string    `json:"name"`
		RelationshipType string    `json:"relationship_type"`
		Phone            string    `json:"phone"`
		AccessCode       string    `json:"access_code"`
		IsPrimary        bool      `json:"is_primary"`
	}

	type StudentDTO struct {
		models.StudentProfile
		GradeName   string        `json:"grade_name,omitempty"`
		SectionName string        `json:"section_name,omitempty"`
		ProgramName string        `json:"program_name,omitempty"`
		ProgramID   *uuid.UUID    `json:"program_id,omitempty"`
		GradeID     *uuid.UUID    `json:"grade_id,omitempty"`
		SectionID   *uuid.UUID    `json:"section_id,omitempty"`
		Phone       string        `json:"phone,omitempty"`
		Guardians   []GuardianDTO `json:"guardians_info"`
	}

	results := make([]StudentDTO, 0, len(students))
	for _, s := range students {
		dto := StudentDTO{
			StudentProfile: s,
			Guardians:      make([]GuardianDTO, 0),
		}

		if len(s.Person.CommunicationChannels) > 0 {
			dto.Phone = s.Person.CommunicationChannels[0].ChannelValue
		}

		// Resolve enrollment
		if en, ok := enrollmentMap[s.ID]; ok && en.ClassSectionID != nil {
			if sec, okSec := sectionMap[*en.ClassSectionID]; okSec {
				dto.SectionName = sec.Name
				dto.SectionID = &sec.ID
				if gr, okGr := gradeMap[sec.StudyGradeID]; okGr {
					dto.GradeName = gr.Name
					dto.GradeID = &gr.ID
					if pr, okPr := progMap[gr.EducationalProgramID]; okPr {
						dto.ProgramName = pr.Name
						dto.ProgramID = &pr.ID
					}
				}
			}
		}

		// Resolve guardians
		for _, g := range s.Guardians {
			gPhone := ""
			if len(g.GuardianPerson.CommunicationChannels) > 0 {
				gPhone = g.GuardianPerson.CommunicationChannels[0].ChannelValue
			}
			gCode := guardianCodeMap[g.GuardianPersonID]
			dto.Guardians = append(dto.Guardians, GuardianDTO{
				ID:               g.ID,
				PersonID:         g.GuardianPersonID,
				Name:             g.GuardianPerson.FullName(),
				RelationshipType: g.RelationshipType,
				Phone:            gPhone,
				AccessCode:       gCode,
				IsPrimary:        g.IsPrimary,
			})
		}

		results = append(results, dto)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    results,
	})
}

// EnrollStudent registers a student into a term and section/cohort.
func (ctrl *AcademicController) EnrollStudent(c *fiber.Ctx) error {
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

	var req struct {
		StudentProfileID uuid.UUID  `json:"student_profile_id"`
		AcademicTermID   uuid.UUID  `json:"academic_term_id"`
		ClassSectionID   *uuid.UUID `json:"class_section_id,omitempty"`
		StudyCohortID    *uuid.UUID `json:"study_cohort_id,omitempty"`
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

	enrollment, err := ctrl.academicSvc.EnrollStudent(c.UserContext(), tenant.ID, req.StudentProfileID, req.AcademicTermID, req.ClassSectionID, req.StudyCohortID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "ENROLLMENT_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    enrollment,
	})
}

// ListGuardians returns all guardian profiles for the tenant with their linked students
func (ctrl *AcademicController) ListGuardians(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var guardians []models.GuardianProfile
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Order("created_at DESC").
		Find(&guardians).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to retrieve guardians"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Fetch student relations
	var relations []models.GuardianStudentRelation
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("StudentProfile.Person").
		Find(&relations).Error

	relMap := make(map[uuid.UUID][]models.GuardianStudentRelation)
	for _, r := range relations {
		relMap[r.GuardianPersonID] = append(relMap[r.GuardianPersonID], r)
	}

	type LinkedStudentDTO struct {
		RelationID       uuid.UUID `json:"relation_id"`
		StudentID        uuid.UUID `json:"student_id"`
		StudentNumber    string    `json:"student_number"`
		StudentName      string    `json:"student_name"`
		RelationshipType string    `json:"relationship_type"`
		AccessCode       string    `json:"access_code"`
	}

	type GuardianResponseDTO struct {
		ID         uuid.UUID          `json:"id"`
		PersonID   uuid.UUID          `json:"person_id"`
		FullName   string             `json:"full_name"`
		FirstName  string             `json:"first_name"`
		LastName   string             `json:"last_name"`
		Phone      string             `json:"phone"`
		AccessCode string             `json:"access_code"`
		Occupation *string            `json:"occupation,omitempty"`
		Students   []LinkedStudentDTO `json:"students"`
	}

	results := make([]GuardianResponseDTO, 0, len(guardians))
	for _, g := range guardians {
		phone := ""
		if len(g.Person.CommunicationChannels) > 0 {
			phone = g.Person.CommunicationChannels[0].ChannelValue
		}

		linked := make([]LinkedStudentDTO, 0)
		for _, r := range relMap[g.PersonID] {
			if r.StudentProfile != nil {
				stName := ""
				if r.StudentProfile.Person.FirstName != "" {
					stName = r.StudentProfile.Person.FullName()
				}
				linked = append(linked, LinkedStudentDTO{
					RelationID:       r.ID,
					StudentID:        r.StudentProfile.ID,
					StudentNumber:    r.StudentProfile.StudentNumber,
					StudentName:      stName,
					RelationshipType: r.RelationshipType,
					AccessCode:       r.StudentProfile.AccessCode,
				})
			}
		}

		results = append(results, GuardianResponseDTO{
			ID:         g.ID,
			PersonID:   g.PersonID,
			FullName:   g.Person.FullName(),
			FirstName:  g.Person.FirstName,
			LastName:   g.Person.LastName,
			Phone:      phone,
			AccessCode: g.AccessCode,
			Occupation: g.Occupation,
			Students:   linked,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    results,
	})
}

// CreateGuardian creates a guardian with a simple fast AccessCode
func (ctrl *AcademicController) CreateGuardian(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		FirstName        string      `json:"first_name"`
		FatherName       *string     `json:"father_name,omitempty"`
		LastName         string      `json:"last_name"`
		Phone            string      `json:"phone"`
		Occupation       *string     `json:"occupation,omitempty"`
		NationalIDNumber *string     `json:"national_id_number,omitempty"`
		StudentIDs       []uuid.UUID `json:"student_ids,omitempty"`
		RelationshipType string      `json:"relationship_type,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "الاسم الأول واللقب مطلوبان لولي الأمر"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// 1. Create central Person
	person := models.Person{
		ID:               uuid.New(),
		FirstName:        strings.TrimSpace(req.FirstName),
		FatherName:       req.FatherName,
		LastName:         strings.TrimSpace(req.LastName),
		Gender:           "male",
		NationalIDNumber: req.NationalIDNumber,
	}
	if err := ctrl.db.WithContext(c.UserContext()).Create(&person).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DB_ERROR", Message: "فشل حفظ بيانات الشخص"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// 2. Add phone communication channel
	if strings.TrimSpace(req.Phone) != "" {
		comm := models.CommunicationChannel{
			ID:           uuid.New(),
			PersonID:     person.ID,
			ChannelType:  "phone",
			ChannelValue: strings.TrimSpace(req.Phone),
			IsPrimary:    true,
		}
		_ = ctrl.db.WithContext(c.UserContext()).Create(&comm)
	}

	// 3. Create tenant-specific GuardianProfile with unique easy AccessCode (e.g. GRD-58291)
	accessCode := services.GenerateRandomCode("GRD")
	guardianProfile := models.GuardianProfile{
		ID:         uuid.New(),
		TenantID:   tenant.ID,
		PersonID:   person.ID,
		AccessCode: accessCode,
		Occupation: req.Occupation,
	}
	if err := ctrl.db.WithContext(c.UserContext()).Create(&guardianProfile).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DB_ERROR", Message: "فشل إنشاء ملف ولي الأمر"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// 4. Link students if provided
	relType := req.RelationshipType
	if relType == "" {
		relType = "father"
	}
	for _, sID := range req.StudentIDs {
		rel := models.GuardianStudentRelation{
			ID:                       uuid.New(),
			TenantID:                 tenant.ID,
			GuardianPersonID:         person.ID,
			StudentProfileID:         sID,
			RelationshipType:         relType,
			IsPrimary:                true,
			CanViewGrades:            true,
			CanViewAttendance:        true,
			CanReceiveNotifications:  true,
			CanPickupStudent:         true,
			IsFinanciallyResponsible: true,
		}
		_ = ctrl.db.WithContext(c.UserContext()).Create(&rel)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    guardianProfile,
	})
}

// LinkStudentToGuardian binds an existing student to an existing guardian in this tenant
func (ctrl *AcademicController) LinkStudentToGuardian(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		GuardianPersonID uuid.UUID `json:"guardian_person_id"`
		StudentProfileID uuid.UUID `json:"student_profile_id"`
		RelationshipType string    `json:"relationship_type"`
	}
	if err := c.BodyParser(&req); err != nil || req.GuardianPersonID == uuid.Nil || req.StudentProfileID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "معرف ولي الأمر والطالب مطلوبان"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	relType := req.RelationshipType
	if relType == "" {
		relType = "father"
	}

	rel := models.GuardianStudentRelation{
		ID:                       uuid.New(),
		TenantID:                 tenant.ID,
		GuardianPersonID:         req.GuardianPersonID,
		StudentProfileID:         req.StudentProfileID,
		RelationshipType:         relType,
		IsPrimary:                true,
		CanViewGrades:            true,
		CanViewAttendance:        true,
		CanReceiveNotifications:  true,
		CanPickupStudent:         true,
		IsFinanciallyResponsible: true,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&rel).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "LINK_ERROR", Message: "العلاقة موجودة مسبقاً أو تعذر الربط"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    rel,
	})
}

// UnlinkStudentFromGuardian removes a guardian-student relation
func (ctrl *AcademicController) UnlinkStudentFromGuardian(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	relationID, err := uuid.Parse(c.Params("relationId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف الرابط غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", relationID, tenant.ID).
		Delete(&models.GuardianStudentRelation{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_ERROR", Message: "فشل فك ارتباط الطالب بولي الأمر"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم فك ارتباط الطالب بنجاح",
	})
}

// TransferSection moves an enrollment to another section with audit trail.
func (ctrl *AcademicController) TransferSection(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	enrollmentID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_ID",
				Message: "Invalid enrollment UUID format",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		NewSectionID uuid.UUID `json:"new_section_id"`
		Reason       string    `json:"reason"`
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
	var changedBy uuid.UUID
	if user != nil {
		changedBy = user.ID
	}

	if err := ctrl.academicSvc.TransferSection(c.UserContext(), tenant.ID, enrollmentID, req.NewSectionID, changedBy, req.Reason); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "TRANSFER_FAILED",
				Message: err.Error(),
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Student transferred successfully",
	})
}

// Helper to get or auto-initialize an active AcademicCycle for the tenant
func (ctrl *AcademicController) getOrCreateAcademicCycle(ctx *fiber.Ctx, tenantID uuid.UUID) (*models.AcademicCycle, error) {
	var cycle models.AcademicCycle
	err := ctrl.db.WithContext(ctx.UserContext()).
		Where("tenant_id = ? AND is_current = ?", tenantID, true).
		First(&cycle).Error
	if err == nil {
		return &cycle, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	err = ctrl.db.WithContext(ctx.UserContext()).
		Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		First(&cycle).Error
	if err == nil {
		return &cycle, nil
	}

	startDate := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2027, 6, 30, 23, 59, 59, 0, time.UTC)
	cycle = models.AcademicCycle{
		ID:        uuid.New(),
		TenantID:  tenantID,
		Name:      "2026-2027",
		StartDate: startDate,
		EndDate:   endDate,
		IsCurrent: true,
		Status:    "active",
	}
	if err := ctrl.db.WithContext(ctx.UserContext()).Create(&cycle).Error; err != nil {
		return nil, err
	}

	term := models.AcademicTerm{
		ID:              uuid.New(),
		TenantID:        tenantID,
		AcademicCycleID: cycle.ID,
		Name:            "الفصل الدراسي الأول",
		TermOrder:       1,
		StartDate:       startDate,
		EndDate:         time.Date(2027, 1, 31, 23, 59, 59, 0, time.UTC),
		IsActive:        true,
	}
	_ = ctrl.db.WithContext(ctx.UserContext()).Create(&term)

	return &cycle, nil
}

// GetAcademicStructure returns the full tree of stages, grades, sections, and curricula.
func (ctrl *AcademicController) GetAcademicStructure(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// 1. Fetch educational programs with nested grades and sections
	var programs []models.EducationalProgram
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("Grades", func(db *gorm.DB) *gorm.DB {
			return db.Order("grade_level ASC")
		}).
		Preload("Grades.Sections", func(db *gorm.DB) *gorm.DB {
			return db.Order("name ASC")
		}).
		Order("created_at ASC").
		Find(&programs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "Failed to retrieve educational structure"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// 2. Fetch adopted curricula with subject and grade details
	var adoptedList []models.AdoptedCurriculum
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ?", tenant.ID).
		Preload("CurriculumEdition.Definition.Subject").
		Preload("StudyGrade").
		Preload("StudyGrade.EducationalProgram").
		Order("created_at DESC").
		Find(&adoptedList).Error

	// 3. Fetch subjects
	var subjects []models.Subject
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? OR tenant_id IS NULL", tenant.ID).
		Order("name ASC").
		Find(&subjects).Error

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"programs":          programs,
			"adopted_curricula": adoptedList,
			"subjects":          subjects,
		},
	})
}

// CreateEducationalProgram creates a new stage/program (e.g. primary, intermediate, preparatory, or custom courses)
func (ctrl *AcademicController) CreateEducationalProgram(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		Code        string  `json:"code"`
		Name        string  `json:"name"`
		ProgramType string  `json:"program_type"` // k12, language_course, vocational, private_tutoring, custom
		Description *string `json:"description,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "اسم المرحلة/القسم مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		code = fmt.Sprintf("prog_%d", time.Now().UnixNano()%1000000)
	}
	pType := req.ProgramType
	if pType == "" {
		pType = "k12"
	}

	prog := models.EducationalProgram{
		ID:          uuid.New(),
		TenantID:    tenant.ID,
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		ProgramType: pType,
		Description: req.Description,
		IsActive:    true,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&prog).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CREATION_FAILED", Message: "فشل إنشاء المرحلة التعليمية، تأكد من عدم تكرار الرمز"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    prog,
	})
}

// UpdateEducationalProgram updates an existing stage/program
func (ctrl *AcademicController) UpdateEducationalProgram(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	progID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		Name        string  `json:"name"`
		ProgramType string  `json:"program_type"`
		Description *string `json:"description,omitempty"`
		IsActive    *bool   `json:"is_active,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "اسم المرحلة/القسم مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	updates := map[string]interface{}{
		"name":         strings.TrimSpace(req.Name),
		"program_type": req.ProgramType,
		"description":  req.Description,
		"updated_at":   time.Now(),
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Model(&models.EducationalProgram{}).
		Where("id = ? AND tenant_id = ?", progID, tenant.ID).
		Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPDATE_FAILED", Message: "فشل تحديث بيانات المرحلة"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تحديث المرحلة بنجاح",
	})
}

// DeleteEducationalProgram removes an educational program
func (ctrl *AcademicController) DeleteEducationalProgram(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	progID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", progID, tenant.ID).
		Delete(&models.EducationalProgram{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_FAILED", Message: "فشل حذف المرحلة التعليمية"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حذف المرحلة التعليمية",
	})
}

// CreateStudyGrade adds a new class/grade level to a program
func (ctrl *AcademicController) CreateStudyGrade(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req struct {
		EducationalProgramID uuid.UUID `json:"educational_program_id"`
		Name                 string    `json:"name"`
		GradeLevel           int       `json:"grade_level"`
		DefaultSectionName   string    `json:"default_section_name,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" || req.EducationalProgramID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى اختيار المرحلة وتحديد اسم الصف الدراسي"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	gradeLevel := req.GradeLevel
	if gradeLevel <= 0 {
		gradeLevel = 1
	}

	grade := models.StudyGrade{
		ID:                   uuid.New(),
		TenantID:             tenant.ID,
		EducationalProgramID: req.EducationalProgramID,
		Name:                 strings.TrimSpace(req.Name),
		GradeLevel:           gradeLevel,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&grade).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CREATION_FAILED", Message: "فشل إضافة الصف الدراسي"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Create default section only if explicitly requested
	secName := strings.TrimSpace(req.DefaultSectionName)
	if secName != "" {
		sec := models.ClassSection{
			ID:           uuid.New(),
			TenantID:     tenant.ID,
			StudyGradeID: grade.ID,
			Name:         secName,
			Capacity:     30,
		}
		_ = ctrl.db.WithContext(c.UserContext()).Create(&sec)
		grade.Sections = []models.ClassSection{sec}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    grade,
	})
}

// UpdateStudyGrade updates a class/grade
func (ctrl *AcademicController) UpdateStudyGrade(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	gradeID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		Name       string `json:"name"`
		GradeLevel int    `json:"grade_level"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "اسم الصف الدراسي مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Model(&models.StudyGrade{}).
		Where("id = ? AND tenant_id = ?", gradeID, tenant.ID).
		Updates(map[string]interface{}{
			"name":        strings.TrimSpace(req.Name),
			"grade_level": req.GradeLevel,
			"updated_at":  time.Now(),
		}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPDATE_FAILED", Message: "فشل تحديث بيانات الصف الدراسي"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تحديث الصف الدراسي بنجاح",
	})
}

// DeleteStudyGrade removes a class/grade
func (ctrl *AcademicController) DeleteStudyGrade(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	gradeID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", gradeID, tenant.ID).
		Delete(&models.StudyGrade{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_FAILED", Message: "فشل حذف الصف الدراسي"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حذف الصف الدراسي بنجاح",
	})
}

// CreateClassSection creates a section for a grade
func (ctrl *AcademicController) CreateClassSection(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req struct {
		StudyGradeID uuid.UUID `json:"study_grade_id"`
		Name         string    `json:"name"`
		Capacity     int       `json:"capacity"`
		RoomNumber   *string   `json:"room_number,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" || req.StudyGradeID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى تحديد الصف واسم الشعبة"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	capacity := req.Capacity
	if capacity <= 0 {
		capacity = 30
	}

	sec := models.ClassSection{
		ID:           uuid.New(),
		TenantID:     tenant.ID,
		StudyGradeID: req.StudyGradeID,
		Name:         strings.TrimSpace(req.Name),
		Capacity:     capacity,
		RoomNumber:   req.RoomNumber,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&sec).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CREATION_FAILED", Message: "فشل إضافة الشعبة"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    sec,
	})
}

// DeleteClassSection removes a section
func (ctrl *AcademicController) DeleteClassSection(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	secID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", secID, tenant.ID).
		Delete(&models.ClassSection{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_FAILED", Message: "فشل حذف الشعبة"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حذف الشعبة بنجاح",
	})
}

// ListSubjects returns all available subjects for the tenant
func (ctrl *AcademicController) ListSubjects(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var list []models.Subject
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? OR tenant_id IS NULL", tenant.ID).
		Order("name ASC").
		Find(&list).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "فشل استرجاع قائمة المواد الدراسية"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// CreateSubject adds a new custom or standard subject for the tenant
func (ctrl *AcademicController) CreateSubject(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req struct {
		Name        string  `json:"name"`
		Code        string  `json:"code"`
		Description *string `json:"description,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "اسم المادة الدراسية مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		code = fmt.Sprintf("SUB_%d", time.Now().UnixNano()%100000)
	}

	sub := models.Subject{
		ID:          uuid.New(),
		TenantID:    &tenant.ID,
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&sub).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CREATION_FAILED", Message: "فشل إنشاء المادة الدراسية"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    sub,
	})
}

// DeleteSubject removes a subject and its associated definitions
func (ctrl *AcademicController) DeleteSubject(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	subID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف مادة غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND (tenant_id = ? OR tenant_id IS NULL)", subID, tenant.ID).
		Delete(&models.Subject{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_FAILED", Message: "فشل حذف المادة الدراسية"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم حذف المادة الدراسية بنجاح",
	})
}


// AdoptCurriculum links a curriculum/subject to a grade and sets weekly session load
func (ctrl *AcademicController) AdoptCurriculum(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	var req struct {
		StudyGradeID        uuid.UUID  `json:"study_grade_id"`
		SubjectID           *uuid.UUID `json:"subject_id,omitempty"`
		SubjectName         string     `json:"subject_name,omitempty"`
		WeeklySessionsCount int        `json:"weekly_sessions_count"`
	}
	if err := c.BodyParser(&req); err != nil || req.StudyGradeID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى تحديد الصف الدراسي والمادة المراد اعتمادها"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	cycle, err := ctrl.getOrCreateAcademicCycle(c, tenant.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CYCLE_ERROR", Message: "فشل استرجاع أو تهيئة العام الأكاديمي للمعهد"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Resolve or create subject
	var subject models.Subject
	if req.SubjectID != nil && *req.SubjectID != uuid.Nil {
		if err := ctrl.db.WithContext(c.UserContext()).
			Where("(tenant_id = ? OR tenant_id IS NULL) AND id = ?", tenant.ID, *req.SubjectID).
			First(&subject).Error; err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "SUBJECT_NOT_FOUND", Message: "المادة الدراسية المحددة غير موجودة"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	} else if strings.TrimSpace(req.SubjectName) != "" {
		sName := strings.TrimSpace(req.SubjectName)
		err := ctrl.db.WithContext(c.UserContext()).
			Where("(tenant_id = ? OR tenant_id IS NULL) AND name = ?", tenant.ID, sName).
			First(&subject).Error
		if err != nil {
			subject = models.Subject{
				ID:       uuid.New(),
				TenantID: &tenant.ID,
				Code:     fmt.Sprintf("SUB_%d", time.Now().UnixNano()%100000),
				Name:     sName,
			}
			if err := ctrl.db.WithContext(c.UserContext()).Create(&subject).Error; err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
					Success:   false,
					Error:     middleware.ErrorDetail{Code: "SUBJECT_CREATE_FAILED", Message: "فشل إنشاء المادة الدراسية"},
					RequestID: middleware.GetRequestID(c),
				})
			}
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "SUBJECT_REQUIRED", Message: "يرجى اختيار مادة دراسية مسجلة أو كتابة اسم مادة جديدة"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Resolve or create curriculum definition & edition for this subject
	var def models.CurriculumDefinition
	err = ctrl.db.WithContext(c.UserContext()).
		Where("subject_id = ? AND (tenant_id = ? OR tenant_id IS NULL)", subject.ID, tenant.ID).
		First(&def).Error
	if err != nil {
		def = models.CurriculumDefinition{
			ID:        uuid.New(),
			TenantID:  &tenant.ID,
			SubjectID: subject.ID,
			Name:      fmt.Sprintf("منهج %s المعتمد", subject.Name),
		}
		if err := ctrl.db.WithContext(c.UserContext()).Create(&def).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "DEF_CREATE_FAILED", Message: "فشل إنشاء تعريف المنهج"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	}

	var edition models.CurriculumEdition
	err = ctrl.db.WithContext(c.UserContext()).
		Where("curriculum_definition_id = ?", def.ID).
		First(&edition).Error
	if err != nil {
		edition = models.CurriculumEdition{
			ID:                     uuid.New(),
			CurriculumDefinitionID: def.ID,
			EditionName:            "طبعة 2026 الرسمية",
			YearPublished:          2026,
			Status:                 "active",
			TotalTeachingHours:     60,
		}
		if err := ctrl.db.WithContext(c.UserContext()).Create(&edition).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "EDITION_CREATE_FAILED", Message: "فشل إنشاء طبعة المنهج"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	}

	sessionsCount := req.WeeklySessionsCount
	if sessionsCount <= 0 {
		sessionsCount = 4
	}

	// Check if already adopted for this grade and cycle
	var existing models.AdoptedCurriculum
	err = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND study_grade_id = ? AND curriculum_edition_id = ? AND academic_cycle_id = ?",
			tenant.ID, req.StudyGradeID, edition.ID, cycle.ID).
		First(&existing).Error
	if err == nil {
		existing.WeeklySessionsCount = sessionsCount
		ctrl.db.Save(&existing)
		return c.JSON(fiber.Map{
			"success": true,
			"data":    existing,
			"message": "تم تحديث حصص المقرر المعتمد للصف الدراسي",
		})
	}

	adopted := models.AdoptedCurriculum{
		ID:                  uuid.New(),
		TenantID:            tenant.ID,
		CurriculumEditionID: edition.ID,
		StudyGradeID:        &req.StudyGradeID,
		AcademicCycleID:     cycle.ID,
		WeeklySessionsCount: sessionsCount,
	}

	if err := ctrl.db.WithContext(c.UserContext()).Create(&adopted).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "ADOPTION_FAILED", Message: "فشل اعتماد المقرر للصف الدراسي"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Preload full details
	_ = ctrl.db.WithContext(c.UserContext()).
		Preload("CurriculumEdition.Definition.Subject").
		Preload("StudyGrade").
		First(&adopted, "id = ?", adopted.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    adopted,
		"message": "تم اعتماد المقرر الدراسي للصف بنجاح",
	})
}

// RemoveAdoptedCurriculum deletes an adopted curriculum
func (ctrl *AcademicController) RemoveAdoptedCurriculum(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	adoptedID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if err := ctrl.db.WithContext(c.UserContext()).
		Where("id = ? AND tenant_id = ?", adoptedID, tenant.ID).
		Delete(&models.AdoptedCurriculum{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DELETE_FAILED", Message: "فشل إلغاء اعتماد المقرر"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم إلغاء اعتماد المقرر الدراسي بنجاح",
	})
}

// InitializeDefaultStructure seeds the official Iraqi educational structure (2026/2027) with accurate subjects for each grade without dummy sections
func (ctrl *AcademicController) InitializeDefaultStructure(c *fiber.Ctx) error {
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "TENANT_NOT_RESOLVED", Message: "Tenant context is required"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var req struct {
		Stages        []string `json:"stages"`
		ResetExisting bool     `json:"reset_existing"`
	}
	_ = c.BodyParser(&req)

	cycle, err := ctrl.getOrCreateAcademicCycle(c, tenant.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CYCLE_ERROR", Message: "فشل تهيئة العام الدراسي للمعهد"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	type gradeDef struct {
		Name         string
		Level        int
		SubjectCodes []string
	}
	type progDef struct {
		Code        string
		Name        string
		Type        string
		Description string
		Grades      []gradeDef
	}

	allPrograms := []progDef{
		{
			Code:        "primary",
			Name:        "المرحلة الابتدائية",
			Type:        "k12",
			Description: "التعليم الأساسي من الصف الأول إلى الصف السادس الابتدائي",
			Grades: []gradeDef{
				{
					Name:         "الأول الابتدائي",
					Level:        1,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "ENGL", "ART", "PE"},
				},
				{
					Name:         "الثاني الابتدائي",
					Level:        2,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "ENGL", "ART", "PE"},
				},
				{
					Name:         "الثالث الابتدائي",
					Level:        3,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "ENGL", "ART", "PE"},
				},
				{
					Name:         "الرابع الابتدائي",
					Level:        4,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "SOCIAL", "ENGL", "ART", "PE"},
				},
				{
					Name:         "الخامس الابتدائي",
					Level:        5,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "SOCIAL", "ENGL", "ART", "PE"},
				},
				{
					Name:         "السادس الابتدائي",
					Level:        6,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "MATH", "SCI", "SOCIAL", "ENGL"},
				},
			},
		},
		{
			Code:        "intermediate",
			Name:        "المرحلة المتوسطة",
			Type:        "k12",
			Description: "التعليم المتوسط من الأول إلى الثالث المتوسط (الوزاري)",
			Grades: []gradeDef{
				{
					Name:         "الأول المتوسط",
					Level:        1,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "SCI", "SOCIAL", "COMP"},
				},
				{
					Name:         "الثاني المتوسط",
					Level:        2,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "SCI", "SOCIAL", "COMP"},
				},
				{
					Name:         "الثالث المتوسط",
					Level:        3,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "PHYS", "CHEM", "BIO", "SOCIAL"},
				},
			},
		},
		{
			Code:        "prep_scientific",
			Name:        "المرحلة الإعدادية - الفرع العلمي",
			Type:        "k12",
			Description: "الإعدادية العلمية (الرابع والخامس والسادس العلمي - البكالوريا)",
			Grades: []gradeDef{
				{
					Name:         "الرابع العلمي",
					Level:        4,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "PHYS", "CHEM", "BIO", "COMP"},
				},
				{
					Name:         "الخامس العلمي",
					Level:        5,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "PHYS", "CHEM", "BIO", "COMP"},
				},
				{
					Name:         "السادس العلمي",
					Level:        6,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "PHYS", "CHEM", "BIO"},
				},
			},
		},
		{
			Code:        "prep_literary",
			Name:        "المرحلة الإعدادية - الفرع الأدبي",
			Type:        "k12",
			Description: "الإعدادية الأدبية (الرابع والخامس والسادس الأدبي - البكالوريا)",
			Grades: []gradeDef{
				{
					Name:         "الرابع الأدبي",
					Level:        4,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "HIST", "GEOG", "COMP"},
				},
				{
					Name:         "الخامس الأدبي",
					Level:        5,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "HIST", "GEOG", "PHIL", "COMP"},
				},
				{
					Name:         "السادس الأدبي",
					Level:        6,
					SubjectCodes: []string{"ISLAMIC", "ARABIC", "ENGL", "MATH", "HIST", "GEOG", "ECON"},
				},
			},
		},
	}

	// Filter requested stages if specified
	selectedPrograms := allPrograms
	if len(req.Stages) > 0 {
		stageMap := make(map[string]bool)
		for _, s := range req.Stages {
			stageMap[s] = true
		}
		selectedPrograms = make([]progDef, 0)
		for _, p := range allPrograms {
			if stageMap[p.Code] {
				selectedPrograms = append(selectedPrograms, p)
			}
		}
	}

	err = ctrl.db.WithContext(c.UserContext()).Transaction(func(tx *gorm.DB) error {
		// 1. If reset_existing requested, hard delete old data for this tenant
		if req.ResetExisting {
			if err := tx.Unscoped().Where("tenant_id = ?", tenant.ID).Delete(&models.AdoptedCurriculum{}).Error; err != nil {
				return err
			}
			if err := tx.Unscoped().Where("tenant_id = ?", tenant.ID).Delete(&models.ClassSection{}).Error; err != nil {
				return err
			}
			if err := tx.Unscoped().Where("tenant_id = ?", tenant.ID).Delete(&models.StudyGrade{}).Error; err != nil {
				return err
			}
			if err := tx.Unscoped().Where("tenant_id = ?", tenant.ID).Delete(&models.EducationalProgram{}).Error; err != nil {
				return err
			}
		}

		// 2. Fetch or create subjects map
		var editions []models.CurriculumEdition
		if err := tx.Preload("Definition.Subject").Find(&editions).Error; err != nil {
			return err
		}

		editionMap := make(map[string]models.CurriculumEdition)
		for _, ed := range editions {
			if ed.Definition.Subject.Code != "" {
				editionMap[ed.Definition.Subject.Code] = ed
			}
		}

		// 3. Create stages, grades, and bind adopted curricula
		for _, p := range selectedPrograms {
			var prog models.EducationalProgram
			err := tx.Unscoped().Where("tenant_id = ? AND code = ?", tenant.ID, p.Code).First(&prog).Error
			if err == nil {
				if err := tx.Unscoped().Model(&models.EducationalProgram{}).Where("id = ?", prog.ID).Updates(map[string]interface{}{
					"name":         p.Name,
					"program_type": p.Type,
					"description":  p.Description,
					"is_active":    true,
					"deleted_at":   nil,
				}).Error; err != nil {
					return err
				}
			} else {
				prog = models.EducationalProgram{
					ID:          uuid.New(),
					TenantID:    tenant.ID,
					Code:        p.Code,
					Name:        p.Name,
					ProgramType: p.Type,
					Description: &p.Description,
					IsActive:    true,
				}
				if err := tx.Create(&prog).Error; err != nil {
					return err
				}
			}

			for _, g := range p.Grades {
				var grade models.StudyGrade
				err := tx.Unscoped().Where("tenant_id = ? AND educational_program_id = ? AND name = ?", tenant.ID, prog.ID, g.Name).First(&grade).Error
				if err == nil {
					if err := tx.Unscoped().Model(&models.StudyGrade{}).Where("id = ?", grade.ID).Updates(map[string]interface{}{
						"grade_level": g.Level,
						"deleted_at":  nil,
					}).Error; err != nil {
						return err
					}
				} else {
					grade = models.StudyGrade{
						ID:                   uuid.New(),
						TenantID:             tenant.ID,
						EducationalProgramID: prog.ID,
						Name:                 g.Name,
						GradeLevel:           g.Level,
					}
					if err := tx.Create(&grade).Error; err != nil {
						return err
					}
				}

				// Create default sections: 3 sections for primary & intermediate, 2 sections for preparatory
				sectionCount := 3
				if p.Code == "prep_scientific" || p.Code == "prep_literary" {
					sectionCount = 2
				}
				sectionNames := []string{"شعبة أ", "شعبة ب", "شعبة ج"}
				for i := 0; i < sectionCount; i++ {
					secName := sectionNames[i]
					var sec models.ClassSection
					if err := tx.Where("tenant_id = ? AND study_grade_id = ? AND name = ?", tenant.ID, grade.ID, secName).First(&sec).Error; err != nil {
						sec = models.ClassSection{
							ID:           uuid.New(),
							TenantID:     tenant.ID,
							StudyGradeID: grade.ID,
							Name:         secName,
							Capacity:     30,
						}
						_ = tx.Create(&sec)
					}
				}

				// Adopt curricula for this grade automatically
				for _, subCode := range g.SubjectCodes {
					ed, ok := editionMap[subCode]
					if ok {
						var ac models.AdoptedCurriculum
						if err := tx.Where("tenant_id = ? AND study_grade_id = ? AND curriculum_edition_id = ?", tenant.ID, grade.ID, ed.ID).First(&ac).Error; err != nil {
							ac = models.AdoptedCurriculum{
								ID:                  uuid.New(),
								TenantID:            tenant.ID,
								CurriculumEditionID: ed.ID,
								StudyGradeID:        &grade.ID,
								AcademicCycleID:     cycle.ID,
								WeeklySessionsCount: 4,
							}
							_ = tx.Create(&ac)
						}
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INIT_FAILED", Message: fmt.Sprintf("فشل تهيئة الهيكل الأكاديمي: %s", err.Error())},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "تم تهيئة المراحل والصفوف والمناهج المعتمدة الرسمية بنجاح",
	})
}

// UploadStudentDocument handles uploading student personal photo or identity card faces.
func (ctrl *AcademicController) UploadStudentDocument(c *fiber.Ctx) error {
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

	file, err := c.FormFile("file")
	if err != nil {
		file, err = c.FormFile("photo")
	}
	if err != nil {
		file, err = c.FormFile("image")
	}
	if err != nil {
		file, err = c.FormFile("document")
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "NO_FILE_UPLOADED",
				Message: "لم يتم العثور على ملف مرفوع",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".pdf" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_FILE_TYPE",
				Message: "نوع الملف غير مدعوم. يرجى رفع ملف بصيغة JPG أو PNG أو WEBP أو PDF",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	docType := c.FormValue("doc_type")
	if docType == "" {
		docType = "doc"
	}

	uploadDir := "./public/uploads/students"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "UPLOAD_DIR_ERROR",
				Message: "فشل إنشاء مجلد حفظ المستندات",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	filename := fmt.Sprintf("%s_%s_%d%s", docType, tenant.ID.String()[:8], time.Now().UnixNano(), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "SAVE_FILE_ERROR",
				Message: "فشل حفظ الملف على الخادم",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	publicURL := fmt.Sprintf("/uploads/students/%s", filename)

	return c.JSON(fiber.Map{
		"success":  true,
		"url":      publicURL,
		"filename": filename,
	})
}

// StudentCodeLoginRequest defines the JSON body for student code authentication.
type StudentCodeLoginRequest struct {
	AccessCode string `json:"access_code"`
	Slug       string `json:"slug,omitempty"`
}

// StudentCodeLogin authenticates a student using their unique institutional access code (e.g. STU-XXXXX).
func (ctrl *AcademicController) StudentCodeLogin(c *fiber.Ctx) error {
	var req StudentCodeLoginRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.AccessCode) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى إدخال كود الطالب الخاص بك"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	code := strings.ToUpper(strings.TrimSpace(req.AccessCode))
	tenant := middleware.GetTenant(c)

	// If tenant not resolved by middleware, try resolving from header, query, or body
	if tenant == nil {
		slug := c.Get("X-Tenant-Slug")
		if slug == "" {
			slug = c.Query("slug")
		}
		if slug == "" {
			slug = req.Slug
		}
		if slug != "" {
			var t models.Tenant
			if err := ctrl.db.WithContext(c.UserContext()).Where("slug = ?", slug).First(&t).Error; err == nil {
				tenant = &t
			}
		}
	}

	var student models.StudentProfile
	query := ctrl.db.WithContext(c.UserContext()).
		Where("UPPER(access_code) = ?", code).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("Guardians.GuardianPerson")

	if tenant != nil {
		query = query.Where("tenant_id = ?", tenant.ID)
	}

	if err := query.First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "STUDENT_NOT_FOUND", Message: "كود الطالب غير صحيح أو غير مسجل في هذا المعهد"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "حدث خطأ أثناء التحقق من كود الطالب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Auto-resolve tenant from student record if not pre-resolved
	if tenant == nil {
		var t models.Tenant
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", student.TenantID).First(&t).Error; err == nil {
			tenant = &t
		} else {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "TENANT_NOT_FOUND", Message: "لم يتم العثور على بيانات المعهد المرتبط بهذا الطالب"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	}

	// Fetch active academic enrollment if any
	var enrollment models.AcademicEnrollment
	var gradeName, sectionName, programName, termName string
	if err := ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND student_profile_id = ?", tenant.ID, student.ID).
		Preload("ClassSection").
		Preload("AcademicTerm").
		Order("created_at DESC").
		First(&enrollment).Error; err == nil {
		if enrollment.ClassSection != nil {
			sectionName = enrollment.ClassSection.Name
			var grade models.StudyGrade
			if errG := ctrl.db.WithContext(c.UserContext()).
				Where("id = ?", enrollment.ClassSection.StudyGradeID).
				First(&grade).Error; errG == nil {
				gradeName = grade.Name
				var prog models.EducationalProgram
				if errP := ctrl.db.WithContext(c.UserContext()).
					Where("id = ?", grade.EducationalProgramID).
					First(&prog).Error; errP == nil {
					programName = prog.Name
				}
			}
		}
		if enrollment.AcademicTerm.Name != "" {
			termName = enrollment.AcademicTerm.Name
		}
	}

	// Auto-fallback to tenant's first section if student is not yet enrolled
	if gradeName == "" || sectionName == "" {
		var defaultSec models.ClassSection
		if errD := ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ?", tenant.ID).
			Order("created_at ASC").
			First(&defaultSec).Error; errD == nil {
			var activeTerm models.AcademicTerm
			_ = ctrl.db.WithContext(c.UserContext()).
				Where("tenant_id = ?", tenant.ID).
				Order("is_active DESC, created_at DESC").
				First(&activeTerm).Error
			newEn := models.AcademicEnrollment{
				ID:               uuid.New(),
				TenantID:         tenant.ID,
				StudentProfileID: student.ID,
				AcademicTermID:   activeTerm.ID,
				ClassSectionID:   &defaultSec.ID,
				EnrollmentDate:   time.Now(),
				EnrollmentType:   "standard",
				Status:           "active",
			}
			_ = ctrl.db.WithContext(c.UserContext()).Create(&newEn)
			sectionName = defaultSec.Name
			var grade models.StudyGrade
			if errG := ctrl.db.WithContext(c.UserContext()).
				Where("id = ?", defaultSec.StudyGradeID).
				First(&grade).Error; errG == nil {
				gradeName = grade.Name
				var prog models.EducationalProgram
				if errP := ctrl.db.WithContext(c.UserContext()).
					Where("id = ?", grade.EducationalProgramID).
					First(&prog).Error; errP == nil {
					programName = prog.Name
				}
			}
			if activeTerm.Name != "" {
				termName = activeTerm.Name
			}
		}
	}

	primaryGuardianName := ""
	primaryGuardianPhone := ""
	for _, g := range student.Guardians {
		if g.IsPrimary || primaryGuardianName == "" {
			primaryGuardianName = g.GuardianPerson.FullName()
			if len(g.GuardianPerson.CommunicationChannels) > 0 {
				primaryGuardianPhone = g.GuardianPerson.CommunicationChannels[0].ChannelValue
			}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"student": fiber.Map{
				"id":                      student.ID,
				"student_number":          student.StudentNumber,
				"access_code":             student.AccessCode,
				"enrollment_status":       student.EnrollmentStatus,
				"full_name":               student.Person.FullName(),
				"first_name":              student.Person.FirstName,
				"father_name":             student.Person.FatherName,
				"grandfather_name":        student.Person.GrandfatherName,
				"last_name":               student.Person.LastName,
				"gender":                  student.Person.Gender,
				"date_of_birth":           student.Person.DateOfBirth,
				"photo_url":               student.PhotoURL,
				"general_register_number": student.GeneralRegisterNumber,
				"governorate":             student.Person.Governorate,
				"city_district":           student.Person.CityDistrict,
				"neighborhood":            student.Person.Neighborhood,
				"emergency_contact_name":  student.EmergencyContactName,
				"emergency_contact_phone": student.EmergencyContactPhone,
				"primary_guardian_name":   primaryGuardianName,
				"primary_guardian_phone":  primaryGuardianPhone,
			},
			"academic": fiber.Map{
				"grade_name":   gradeName,
				"section_name": sectionName,
				"program_name": programName,
				"term_name":    termName,
			},
			"tenant": fiber.Map{
				"id":            tenant.ID,
				"name":          tenant.Name,
				"slug":          tenant.Slug,
				"logo_url":      tenant.LogoURL,
				"primary_color": tenant.PrimaryColor,
				"phone":         tenant.Phone,
				"email":         tenant.Email,
				"address":       tenant.Address,
			},
		},
	})
}

// GuardianCodeLoginRequest defines the JSON body for guardian code authentication.
type GuardianCodeLoginRequest struct {
	AccessCode string `json:"access_code"`
	Slug       string `json:"slug,omitempty"`
}

// GuardianCodeLogin authenticates a guardian using their unique institutional access code (e.g. GRD-XXXXX).
func (ctrl *AcademicController) GuardianCodeLogin(c *fiber.Ctx) error {
	var req GuardianCodeLoginRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.AccessCode) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى إدخال كود ولي الأمر الخاص بك"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	code := strings.ToUpper(strings.TrimSpace(req.AccessCode))
	tenant := middleware.GetTenant(c)

	// If tenant not resolved by middleware, try resolving from header, query, or body
	if tenant == nil {
		slug := c.Get("X-Tenant-Slug")
		if slug == "" {
			slug = c.Query("slug")
		}
		if slug == "" {
			slug = req.Slug
		}
		if slug != "" {
			var t models.Tenant
			if err := ctrl.db.WithContext(c.UserContext()).Where("slug = ?", slug).First(&t).Error; err == nil {
				tenant = &t
			}
		}
	}

	var guardian models.GuardianProfile
	query := ctrl.db.WithContext(c.UserContext()).
		Where("UPPER(access_code) = ?", code).
		Preload("Person").
		Preload("Person.CommunicationChannels")

	if tenant != nil {
		query = query.Where("tenant_id = ?", tenant.ID)
	}

	if err := query.First(&guardian).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "GUARDIAN_NOT_FOUND", Message: "كود ولي الأمر غير صحيح أو غير مسجل في هذا المعهد"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "حدث خطأ أثناء التحقق من كود ولي الأمر"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Auto-resolve tenant from guardian record if not pre-resolved
	if tenant == nil {
		var t models.Tenant
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", guardian.TenantID).First(&t).Error; err == nil {
			tenant = &t
		} else {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "TENANT_NOT_FOUND", Message: "لم يتم العثور على بيانات المعهد المرتبط بولي الأمر هذا"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	}

	phone := ""
	if len(guardian.Person.CommunicationChannels) > 0 {
		phone = guardian.Person.CommunicationChannels[0].ChannelValue
	}

	var relations []models.GuardianStudentRelation
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND guardian_person_id = ?", tenant.ID, guardian.PersonID).
		Preload("StudentProfile").
		Preload("StudentProfile.Person").
		Find(&relations).Error

	type LinkedStudentAppDTO struct {
		ID                    uuid.UUID `json:"id"`
		StudentNumber         string    `json:"student_number"`
		FullName              string    `json:"full_name"`
		PhotoURL              *string   `json:"photo_url,omitempty"`
		GradeName             string    `json:"grade_name"`
		SectionName           string    `json:"section_name"`
		EnrollmentStatus      string    `json:"enrollment_status"`
		RelationshipType      string    `json:"relationship_type"`
		IsPrimary             bool      `json:"is_primary"`
		GeneralRegisterNumber *string   `json:"general_register_number,omitempty"`
		AccessCode            string    `json:"access_code"`
	}

	studentsList := make([]LinkedStudentAppDTO, 0, len(relations))
	for _, rel := range relations {
		if rel.StudentProfile == nil {
			continue
		}
		st := rel.StudentProfile
		stName := st.Person.FullName()

		gradeName := ""
		sectionName := ""
		var enrollment models.AcademicEnrollment
		if err := ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND student_profile_id = ?", tenant.ID, st.ID).
			Preload("ClassSection").
			Order("created_at DESC").
			First(&enrollment).Error; err == nil {
			if enrollment.ClassSection != nil {
				sectionName = enrollment.ClassSection.Name
				var grade models.StudyGrade
				if errG := ctrl.db.WithContext(c.UserContext()).
					Where("id = ?", enrollment.ClassSection.StudyGradeID).
					First(&grade).Error; errG == nil {
					gradeName = grade.Name
				}
			}
		}

		if gradeName == "" || sectionName == "" {
			var defaultSec models.ClassSection
			if errD := ctrl.db.WithContext(c.UserContext()).
				Where("tenant_id = ?", tenant.ID).
				Order("created_at ASC").
				First(&defaultSec).Error; errD == nil {
				var activeTerm models.AcademicTerm
				_ = ctrl.db.WithContext(c.UserContext()).
					Where("tenant_id = ?", tenant.ID).
					Order("is_active DESC, created_at DESC").
					First(&activeTerm).Error
				newEn := models.AcademicEnrollment{
					ID:               uuid.New(),
					TenantID:         tenant.ID,
					StudentProfileID: st.ID,
					AcademicTermID:   activeTerm.ID,
					ClassSectionID:   &defaultSec.ID,
					EnrollmentDate:   time.Now(),
					EnrollmentType:   "standard",
					Status:           "active",
				}
				_ = ctrl.db.WithContext(c.UserContext()).Create(&newEn)
				sectionName = defaultSec.Name
				var grade models.StudyGrade
				if errG := ctrl.db.WithContext(c.UserContext()).
					Where("id = ?", defaultSec.StudyGradeID).
					First(&grade).Error; errG == nil {
					gradeName = grade.Name
				}
			}
		}

		studentsList = append(studentsList, LinkedStudentAppDTO{
			ID:                    st.ID,
			StudentNumber:         st.StudentNumber,
			FullName:              stName,
			PhotoURL:              st.PhotoURL,
			GradeName:             gradeName,
			SectionName:           sectionName,
			EnrollmentStatus:      st.EnrollmentStatus,
			RelationshipType:      rel.RelationshipType,
			IsPrimary:             rel.IsPrimary,
			GeneralRegisterNumber: st.GeneralRegisterNumber,
			AccessCode:            st.AccessCode,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"guardian": fiber.Map{
				"id":          guardian.ID,
				"person_id":   guardian.PersonID,
				"full_name":   guardian.Person.FullName(),
				"first_name":  guardian.Person.FirstName,
				"last_name":   guardian.Person.LastName,
				"phone":       phone,
				"access_code": guardian.AccessCode,
				"occupation":  guardian.Occupation,
			},
			"students": studentsList,
			"tenant": fiber.Map{
				"id":            tenant.ID,
				"name":          tenant.Name,
				"slug":          tenant.Slug,
				"logo_url":      tenant.LogoURL,
				"primary_color": tenant.PrimaryColor,
				"phone":         tenant.Phone,
				"email":         tenant.Email,
				"address":       tenant.Address,
			},
		},
	})
}

// TeacherCodeLoginRequest defines the JSON body for teacher code authentication.
type TeacherCodeLoginRequest struct {
	AccessCode string `json:"access_code"`
	Slug       string `json:"slug,omitempty"`
}

// TeacherCodeLogin authenticates a teacher using their unique institutional access code (e.g. TCH-XXXXX).
func (ctrl *AcademicController) TeacherCodeLogin(c *fiber.Ctx) error {
	var req TeacherCodeLoginRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.AccessCode) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى إدخال كود المعلم / المدرس الخاص بك"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	code := strings.ToUpper(strings.TrimSpace(req.AccessCode))
	tenant := middleware.GetTenant(c)

	if tenant == nil {
		slug := c.Get("X-Tenant-Slug")
		if slug == "" {
			slug = c.Query("slug")
		}
		if slug == "" {
			slug = req.Slug
		}
		if slug != "" {
			var t models.Tenant
			if err := ctrl.db.WithContext(c.UserContext()).Where("slug = ?", slug).First(&t).Error; err == nil {
				tenant = &t
			}
		}
	}

	var teacher models.TeacherProfile
	query := ctrl.db.WithContext(c.UserContext()).
		Where("UPPER(access_code) = ?", code).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("StaffProfile")

	if tenant != nil {
		query = query.Where("tenant_id = ?", tenant.ID)
	}

	if err := query.First(&teacher).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "TEACHER_NOT_FOUND", Message: "كود المدرس غير صحيح أو غير مسجل في هذا المعهد"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "QUERY_ERROR", Message: "حدث خطأ أثناء التحقق من كود المدرس"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	if tenant == nil {
		var t models.Tenant
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", teacher.TenantID).First(&t).Error; err == nil {
			tenant = &t
		} else {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "TENANT_NOT_FOUND", Message: "لم يتم العثور على بيانات المعهد المرتبط بهذا المدرس"},
				RequestID: middleware.GetRequestID(c),
			})
		}
	}

	var assignments []models.TeacherAssignment
	_ = ctrl.db.WithContext(c.UserContext()).
		Where("tenant_id = ? AND teacher_profile_id = ? AND status = 'active'", tenant.ID, teacher.ID).
		Preload("AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		Preload("AdoptedCurriculum.StudyGrade").
		Find(&assignments).Error

	assignmentIDs := make([]uuid.UUID, 0, len(assignments))
	sectionIDs := make([]uuid.UUID, 0)
	for _, a := range assignments {
		assignmentIDs = append(assignmentIDs, a.ID)
		if a.ClassSectionID != nil {
			sectionIDs = append(sectionIDs, *a.ClassSectionID)
		}
	}

	sectionMap := make(map[uuid.UUID]string)
	gradeMap := make(map[uuid.UUID]string)
	if len(sectionIDs) > 0 {
		var sections []models.ClassSection
		if errSec := ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND id IN ?", tenant.ID, sectionIDs).
			Find(&sections).Error; errSec == nil {
			var gradeIDs []uuid.UUID
			for _, sec := range sections {
				sectionMap[sec.ID] = sec.Name
				gradeIDs = append(gradeIDs, sec.StudyGradeID)
			}
			if len(gradeIDs) > 0 {
				var grades []models.StudyGrade
				if errG := ctrl.db.WithContext(c.UserContext()).
					Where("tenant_id = ? AND id IN ?", tenant.ID, gradeIDs).
					Find(&grades).Error; errG == nil {
					for _, g := range grades {
						gradeMap[g.ID] = g.Name
					}
				}
			}
		}
	}

	type FormattedAssignment struct {
		ID            uuid.UUID `json:"id"`
		SubjectName   string    `json:"subject_name"`
		CourseName    string    `json:"course_name"`
		SectionName   string    `json:"section_name"`
		GradeName     string    `json:"grade_name"`
		IsLeadTeacher bool      `json:"is_lead_teacher"`
		Status        string    `json:"status"`
	}

	formattedAssignments := make([]FormattedAssignment, 0, len(assignments))
	for _, a := range assignments {
		secName := "عام"
		grName := "عام"
		if a.ClassSectionID != nil {
			if sName, ok := sectionMap[*a.ClassSectionID]; ok {
				secName = sName
			}
		}
		if a.AdoptedCurriculum.StudyGrade != nil && a.AdoptedCurriculum.StudyGrade.Name != "" {
			grName = a.AdoptedCurriculum.StudyGrade.Name
		}
		subName := "مادة دراسية"
		courseName := "منهج تعليمي"
		if a.AdoptedCurriculum.CurriculumEdition.Definition.Subject.Name != "" {
			subName = a.AdoptedCurriculum.CurriculumEdition.Definition.Subject.Name
		}
		if a.AdoptedCurriculum.CurriculumEdition.Definition.Name != "" {
			courseName = a.AdoptedCurriculum.CurriculumEdition.Definition.Name
		}
		formattedAssignments = append(formattedAssignments, FormattedAssignment{
			ID:            a.ID,
			SubjectName:   subName,
			CourseName:    courseName,
			SectionName:   secName,
			GradeName:     grName,
			IsLeadTeacher: a.IsLeadTeacher,
			Status:        a.Status,
		})
	}

	type FormattedSlot struct {
		ID          uuid.UUID `json:"id"`
		DayOfWeek   int       `json:"day_of_week"`
		StartTime   string    `json:"start_time"`
		EndTime     string    `json:"end_time"`
		RoomNumber  string    `json:"room_number"`
		SubjectName string    `json:"subject_name"`
		SectionName string    `json:"section_name"`
	}

	formattedSlots := make([]FormattedSlot, 0)
	if len(assignmentIDs) > 0 {
		var slots []models.PlannedScheduleSlot
		if errS := ctrl.db.WithContext(c.UserContext()).
			Where("tenant_id = ? AND teacher_assignment_id IN ? AND is_active = true", tenant.ID, assignmentIDs).
			Order("day_of_week ASC, start_time ASC").
			Find(&slots).Error; errS == nil {
			for _, sl := range slots {
				rn := "القاعة 1"
				if sl.RoomNumber != nil && *sl.RoomNumber != "" {
					rn = *sl.RoomNumber
				}
				sName := "مادة عامة"
				secN := "شعبة أ"
				for _, fa := range formattedAssignments {
					if fa.ID == sl.TeacherAssignmentID {
						sName = fa.SubjectName
						secN = fa.SectionName
						break
					}
				}
				formattedSlots = append(formattedSlots, FormattedSlot{
					ID:          sl.ID,
					DayOfWeek:   sl.DayOfWeek,
					StartTime:   sl.StartTime,
					EndTime:     sl.EndTime,
					RoomNumber:  rn,
					SubjectName: sName,
					SectionName: secN,
				})
			}
		}
	}

	phone := ""
	email := ""
	for _, ch := range teacher.Person.CommunicationChannels {
		if ch.ChannelType == "phone" && (phone == "" || ch.IsPrimary) {
			phone = ch.ChannelValue
		}
		if ch.ChannelType == "email" && (email == "" || ch.IsPrimary) {
			email = ch.ChannelValue
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"teacher": fiber.Map{
				"id":              teacher.ID,
				"staff_number":    teacher.StaffNumber,
				"access_code":     teacher.AccessCode,
				"specialization":  teacher.Specialization,
				"employment_type": teacher.EmploymentType,
				"status":          teacher.Status,
				"full_name":       teacher.Person.FullName(),
				"first_name":      teacher.Person.FirstName,
				"last_name":       teacher.Person.LastName,
				"phone":           phone,
				"email":           email,
				"gender":          teacher.Person.Gender,
				"avatar_url":      teacher.Person.AvatarURL,
			},
			"assignments": formattedAssignments,
			"schedules":   formattedSlots,
			"tenant": fiber.Map{
				"id":            tenant.ID,
				"name":          tenant.Name,
				"slug":          tenant.Slug,
				"logo_url":      tenant.LogoURL,
				"primary_color": tenant.PrimaryColor,
				"phone":         tenant.Phone,
				"email":         tenant.Email,
				"address":       tenant.Address,
			},
		},
	})
}




