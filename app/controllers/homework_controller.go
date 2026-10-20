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

type HomeworkController struct {
	db          *gorm.DB
	homeworkSvc *services.HomeworkService
}

func NewHomeworkController(db *gorm.DB, s *services.HomeworkService) *HomeworkController {
	return &HomeworkController{db: db, homeworkSvc: s}
}

func (ctrl *HomeworkController) resolveTenant(c *fiber.Ctx) *models.Tenant {
	tenant := middleware.GetTenant(c)
	if tenant != nil {
		return tenant
	}
	slug := c.Get("X-Tenant-Slug")
	if slug == "" {
		slug = c.Query("slug")
	}
	if slug != "" {
		var t models.Tenant
		if err := ctrl.db.WithContext(c.UserContext()).Where("slug = ?", slug).First(&t).Error; err == nil {
			return &t
		}
	}
	return nil
}

// UploadAttachment handles uploading photos (e.g. notebook pages or assignment questions).
func (ctrl *HomeworkController) UploadAttachment(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	tenantIDStr := "global"
	if tenant != nil {
		tenantIDStr = tenant.ID.String()[:8]
	}

	file, err := c.FormFile("file")
	if err != nil {
		file, err = c.FormFile("image")
	}
	if err != nil {
		file, err = c.FormFile("photo")
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "NO_FILE_UPLOADED",
				Message: "لم يتم العثور على صورة مرفوعة",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success: false,
			Error: middleware.ErrorDetail{
				Code:    "INVALID_FILE_TYPE",
				Message: "نوع الصورة غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WEBP",
			},
			RequestID: middleware.GetRequestID(c),
		})
	}

	uploadDir := "./public/uploads/homeworks"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "DIR_ERROR", Message: "فشل إنشاء مجلد حفظ الصور"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	filename := fmt.Sprintf("hw_%s_%d%s", tenantIDStr, time.Now().UnixNano(), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "SAVE_ERROR", Message: "فشل حفظ الصورة على الخادم"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"url":      fmt.Sprintf("/uploads/homeworks/%s", filename),
		"filename": filename,
	})
}

// CreateHomeworkRequest defines json body for creating homework
type CreateHomeworkBody struct {
	TeacherAssignmentID string   `json:"teacher_assignment_id"`
	ClassSectionID      *string  `json:"class_section_id,omitempty"`
	StudyGradeID        *string  `json:"study_grade_id,omitempty"`
	Title               string   `json:"title"`
	LessonTopic         *string  `json:"lesson_topic,omitempty"`
	Description         *string  `json:"description,omitempty"`
	AttachmentURLs      []string `json:"attachment_urls,omitempty"`
	DueDate             string   `json:"due_date"`
}

// CreateHomework handles posting a new daily homework/preparation.
func (ctrl *HomeworkController) CreateHomework(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var body CreateHomeworkBody
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Title) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "عنوان الواجب مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	assignmentUUID, err := uuid.Parse(body.TeacherAssignmentID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ASSIGNMENT_ID", Message: "معرف تكليف المدرس غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var sectionUUID *uuid.UUID
	if body.ClassSectionID != nil && *body.ClassSectionID != "" {
		if u, err := uuid.Parse(*body.ClassSectionID); err == nil {
			sectionUUID = &u
		}
	}

	var gradeUUID *uuid.UUID
	if body.StudyGradeID != nil && *body.StudyGradeID != "" {
		if u, err := uuid.Parse(*body.StudyGradeID); err == nil {
			gradeUUID = &u
		}
	}

	dueDate := time.Now().Add(24 * time.Hour)
	if body.DueDate != "" {
		if parsed, err := time.Parse(time.RFC3339, body.DueDate); err == nil {
			dueDate = parsed
		} else if parsedDate, err := time.Parse("2006-01-02", body.DueDate); err == nil {
			dueDate = parsedDate
		}
	}

	hw, err := ctrl.homeworkSvc.CreateDailyHomework(c.UserContext(), tenant.ID, services.CreateHomeworkRequest{
		TeacherAssignmentID: assignmentUUID,
		ClassSectionID:      sectionUUID,
		StudyGradeID:        gradeUUID,
		Title:               strings.TrimSpace(body.Title),
		LessonTopic:         body.LessonTopic,
		Description:         body.Description,
		AttachmentURLs:      body.AttachmentURLs,
		DueDate:             dueDate,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "CREATE_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    hw,
	})
}

// ListHomeworks returns list of homeworks for the tenant (filtered by teacher, section, grade).
func (ctrl *HomeworkController) ListHomeworks(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var teacherProfileUUID *uuid.UUID
	if tStr := c.Query("teacher_id"); tStr != "" {
		if u, err := uuid.Parse(tStr); err == nil {
			teacherProfileUUID = &u
		}
	}

	var sectionUUID *uuid.UUID
	if sStr := c.Query("section_id"); sStr != "" {
		if u, err := uuid.Parse(sStr); err == nil {
			sectionUUID = &u
		}
	}

	var gradeUUID *uuid.UUID
	if gStr := c.Query("grade_id"); gStr != "" {
		if u, err := uuid.Parse(gStr); err == nil {
			gradeUUID = &u
		}
	}

	list, err := ctrl.homeworkSvc.GetDailyHomeworks(c.UserContext(), tenant.ID, teacherProfileUUID, sectionUUID, gradeUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "FETCH_FAILED", Message: "فشل استرجاع قائمة الواجبات"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// GetHomeworkDetails returns homework info along with roster submission status.
func (ctrl *HomeworkController) GetHomeworkDetails(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	hwUUID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف الواجب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	hw, roster, err := ctrl.homeworkSvc.GetHomeworkRosterWithSubmissions(c.UserContext(), tenant.ID, hwUUID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "لم يتم العثور على الواجب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"homework": hw,
			"roster":   roster,
		},
	})
}

// StudentHomeworks returns homeworks for a student (accessed via Student or Guardian App).
func (ctrl *HomeworkController) StudentHomeworks(c *fiber.Ctx) error {
	studentIDStr := c.Query("student_id")
	if studentIDStr == "" {
		studentIDStr = c.Params("student_id")
	}

	studentUUID, err := uuid.Parse(studentIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_STUDENT_ID", Message: "معرف الطالب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// Resolve tenant from context or lookup student
	tenant := ctrl.resolveTenant(c)
	var tenantID uuid.UUID
	if tenant != nil {
		tenantID = tenant.ID
	} else {
		var st models.StudentProfile
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", studentUUID).First(&st).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "STUDENT_NOT_FOUND", Message: "لم يتم العثور على الطالب"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		tenantID = st.TenantID
	}

	list, err := ctrl.homeworkSvc.GetStudentHomeworks(c.UserContext(), tenantID, studentUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "FETCH_FAILED", Message: "فشل استرجاع واجبات الطالب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

type SubmitHomeworkBody struct {
	StudentID      string   `json:"student_id"`
	SubmittedBy    string   `json:"submitted_by"` // student or guardian
	SubmissionText *string  `json:"submission_text,omitempty"`
	Images         []string `json:"images,omitempty"`
}

// SubmitHomework handles submitting daily homework solution.
func (ctrl *HomeworkController) SubmitHomework(c *fiber.Ctx) error {
	hwUUID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_HOMEWORK_ID", Message: "معرف الواجب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var body SubmitHomeworkBody
	if err := c.BodyParser(&body); err != nil || body.StudentID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "معرف الطالب مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	studentUUID, err := uuid.Parse(body.StudentID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_STUDENT_ID", Message: "معرف الطالب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	tenant := ctrl.resolveTenant(c)
	var tenantID uuid.UUID
	if tenant != nil {
		tenantID = tenant.ID
	} else {
		var st models.StudentProfile
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", studentUUID).First(&st).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "STUDENT_NOT_FOUND", Message: "لم يتم العثور على الطالب"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		tenantID = st.TenantID
	}

	sub, err := ctrl.homeworkSvc.SubmitHomework(c.UserContext(), tenantID, hwUUID, studentUUID, body.SubmittedBy, body.SubmissionText, body.Images)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "SUBMISSION_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    sub,
	})
}

type ReviewSubmissionBody struct {
	TeacherRating   *string `json:"teacher_rating,omitempty"`   // excellent, good, acceptable, incomplete, not_done
	TeacherFeedback *string `json:"teacher_feedback,omitempty"` // notes
	ReviewStatus    string  `json:"review_status"`              // reviewed, needs_resubmission
}

// ReviewSubmission updates rating and teacher notes on a student submission.
func (ctrl *HomeworkController) ReviewSubmission(c *fiber.Ctx) error {
	subUUID, err := uuid.Parse(c.Params("submission_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_SUBMISSION_ID", Message: "معرف التسليم غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var body ReviewSubmissionBody
	_ = c.BodyParser(&body)

	tenant := ctrl.resolveTenant(c)
	var tenantID uuid.UUID
	if tenant != nil {
		tenantID = tenant.ID
	} else {
		var sub models.HomeworkSubmission
		if err := ctrl.db.WithContext(c.UserContext()).Where("id = ?", subUUID).First(&sub).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "لم يتم العثور على التسليم"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		tenantID = sub.TenantID
	}

	updated, err := ctrl.homeworkSvc.ReviewSubmission(c.UserContext(), tenantID, subUUID, body.TeacherRating, body.TeacherFeedback, body.ReviewStatus)
	if err != nil {
		if errors.Is(err, services.ErrSubmissionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(middleware.APIError{
				Success:   false,
				Error:     middleware.ErrorDetail{Code: "NOT_FOUND", Message: "لم يتم العثور على التسليم"},
				RequestID: middleware.GetRequestID(c),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "REVIEW_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    updated,
	})
}

type UploadSchoolHomeworkBody struct {
	StudentID   string   `json:"student_id"`
	SubjectName string   `json:"subject_name"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
	Images      []string `json:"images,omitempty"`
	SubmittedBy string   `json:"submitted_by"` // student or guardian
}

// UploadSchoolHomework handles student or guardian uploading school homework photos/text.
func (ctrl *HomeworkController) UploadSchoolHomework(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var body UploadSchoolHomeworkBody
	if err := c.BodyParser(&body); err != nil || body.StudentID == "" || strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.SubjectName) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_REQUEST", Message: "يرجى اختيار المادة وكتابة عنوان الواجب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	studentUUID, err := uuid.Parse(body.StudentID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_STUDENT_ID", Message: "معرف الطالب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	hw, err := ctrl.homeworkSvc.UploadSchoolHomework(c.UserContext(), tenant.ID, services.UploadSchoolHomeworkRequest{
		StudentID:   studentUUID,
		SubjectName: strings.TrimSpace(body.SubjectName),
		Title:       strings.TrimSpace(body.Title),
		Description: body.Description,
		Images:      body.Images,
		SubmittedBy: body.SubmittedBy,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPLOAD_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    hw,
	})
}

// ListSchoolHomeworksFeed returns the feed of school homeworks for teachers, students, or admin.
func (ctrl *HomeworkController) ListSchoolHomeworksFeed(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	// If student_id is requested, fetch personal list
	if studentIDStr := c.Query("student_id"); studentIDStr != "" {
		studentUUID, err := uuid.Parse(studentIDStr)
		if err == nil {
			list, err := ctrl.homeworkSvc.GetStudentSchoolHomeworks(c.UserContext(), tenant.ID, studentUUID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
					Success:   false,
					Error:     middleware.ErrorDetail{Code: "FETCH_FAILED", Message: "فشل استرجاع واجبات الطالب"},
					RequestID: middleware.GetRequestID(c),
				})
			}
			return c.JSON(fiber.Map{"success": true, "data": list})
		}
	}

	var teacherProfileUUID *uuid.UUID
	if tStr := c.Query("teacher_id"); tStr != "" {
		if u, err := uuid.Parse(tStr); err == nil {
			teacherProfileUUID = &u
		}
	}

	var sectionUUID *uuid.UUID
	if sStr := c.Query("section_id"); sStr != "" {
		if u, err := uuid.Parse(sStr); err == nil {
			sectionUUID = &u
		}
	}

	var gradeUUID *uuid.UUID
	if gStr := c.Query("grade_id"); gStr != "" {
		if u, err := uuid.Parse(gStr); err == nil {
			gradeUUID = &u
		}
	}

	subjectName := c.Query("subject")

	list, err := ctrl.homeworkSvc.GetSchoolHomeworksFeed(c.UserContext(), tenant.ID, teacherProfileUUID, sectionUUID, gradeUUID, subjectName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "FETCH_FAILED", Message: "فشل استرجاع سجل الواجبات"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

type AcknowledgeSchoolHomeworkBody struct {
	TeacherID string  `json:"teacher_id"`
	Comment   *string `json:"comment,omitempty"`
}

// AcknowledgeSchoolHomework marks a homework as seen with an optional teacher response message.
func (ctrl *HomeworkController) AcknowledgeSchoolHomework(c *fiber.Ctx) error {
	tenant := ctrl.resolveTenant(c)
	if tenant == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UNAUTHORIZED", Message: "سياق المعهد مطلوب"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	hwUUID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "INVALID_ID", Message: "معرف الواجب غير صالح"},
			RequestID: middleware.GetRequestID(c),
		})
	}

	var body AcknowledgeSchoolHomeworkBody
	_ = c.BodyParser(&body)

	var teacherProfileUUID *uuid.UUID
	if body.TeacherID != "" {
		if u, err := uuid.Parse(body.TeacherID); err == nil {
			teacherProfileUUID = &u
		}
	}

	updated, err := ctrl.homeworkSvc.AcknowledgeSchoolHomework(c.UserContext(), tenant.ID, hwUUID, teacherProfileUUID, body.Comment)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(middleware.APIError{
			Success:   false,
			Error:     middleware.ErrorDetail{Code: "UPDATE_FAILED", Message: err.Error()},
			RequestID: middleware.GetRequestID(c),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    updated,
	})
}

