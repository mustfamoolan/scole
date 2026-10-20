package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrHomeworkNotFound   = errors.New("daily homework not found in this institution")
	ErrSubmissionNotFound = errors.New("homework submission not found")
)

type HomeworkService struct {
	db *gorm.DB
}

func NewHomeworkService(db *gorm.DB) *HomeworkService {
	return &HomeworkService{db: db}
}

// CreateHomeworkRequest defines parameters for posting homework/preparation.
type CreateHomeworkRequest struct {
	TeacherAssignmentID uuid.UUID  `json:"teacher_assignment_id"`
	ClassSectionID      *uuid.UUID `json:"class_section_id,omitempty"`
	StudyGradeID        *uuid.UUID `json:"study_grade_id,omitempty"`
	Title               string     `json:"title"`
	LessonTopic         *string    `json:"lesson_topic,omitempty"`
	Description         *string    `json:"description,omitempty"`
	AttachmentURLs      []string   `json:"attachment_urls,omitempty"`
	DueDate             time.Time  `json:"due_date"`
}

// StudentHomeworkItemDTO represents a homework record with student's personal submission status.
type StudentHomeworkItemDTO struct {
	models.DailyHomework
	SubjectName    string                     `json:"subject_name"`
	TeacherName    string                     `json:"teacher_name"`
	GradeName      string                     `json:"grade_name"`
	SectionName    string                     `json:"section_name"`
	UserSubmission *models.HomeworkSubmission `json:"user_submission,omitempty"`
	IsSubmitted    bool                       `json:"is_submitted"`
}

// StudentRosterSubmissionDTO represents each student in a section and their submission status.
type StudentRosterSubmissionDTO struct {
	StudentID       uuid.UUID  `json:"student_id"`
	StudentNumber   string     `json:"student_number"`
	FullName        string     `json:"full_name"`
	PhotoURL        *string    `json:"photo_url,omitempty"`
	SubmissionID    *uuid.UUID `json:"submission_id,omitempty"`
	SubmittedAt     *time.Time `json:"submitted_at,omitempty"`
	SubmittedBy     *string    `json:"submitted_by,omitempty"`
	SubmissionText  *string    `json:"submission_text,omitempty"`
	Images          []string   `json:"images"`
	ReviewStatus    string     `json:"review_status"` // not_submitted, pending, reviewed, needs_resubmission
	TeacherRating   *string    `json:"teacher_rating,omitempty"`
	TeacherFeedback *string    `json:"teacher_feedback,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
}

// CreateDailyHomework publishes a new homework or lesson preparation.
func (s *HomeworkService) CreateDailyHomework(ctx context.Context, tenantID uuid.UUID, req CreateHomeworkRequest) (*models.DailyHomework, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}

	// Validate teacher assignment
	var assignment models.TeacherAssignment
	if err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", req.TeacherAssignmentID, tenantID).
		Preload("ClassSection").
		First(&assignment).Error; err != nil {
		return nil, ErrAssignmentNotFound
	}

	sectionID := req.ClassSectionID
	if sectionID == nil && assignment.ClassSectionID != nil {
		sectionID = assignment.ClassSectionID
	}

	var gradeID *uuid.UUID = req.StudyGradeID
	if gradeID == nil && assignment.ClassSection != nil {
		gradeID = &assignment.ClassSection.StudyGradeID
	}

	attachmentsJSON := "[]"
	if len(req.AttachmentURLs) > 0 {
		if bytes, err := json.Marshal(req.AttachmentURLs); err == nil {
			attachmentsJSON = string(bytes)
		}
	}

	dueDate := req.DueDate
	if dueDate.IsZero() {
		dueDate = time.Now().Add(24 * time.Hour)
	}

	hw := models.DailyHomework{
		TenantID:            tenantID,
		TeacherAssignmentID: req.TeacherAssignmentID,
		ClassSectionID:      sectionID,
		StudyGradeID:        gradeID,
		Title:               req.Title,
		LessonTopic:         req.LessonTopic,
		Description:         req.Description,
		AttachmentURLs:      attachmentsJSON,
		DueDate:             dueDate,
		Status:              "active",
	}

	if err := s.db.WithContext(ctx).Create(&hw).Error; err != nil {
		return nil, err
	}

	return &hw, nil
}

// GetDailyHomeworks fetches homework list with optional filters (for teacher or admin).
func (s *HomeworkService) GetDailyHomeworks(ctx context.Context, tenantID uuid.UUID, teacherProfileID *uuid.UUID, sectionID *uuid.UUID, gradeID *uuid.UUID) ([]models.DailyHomework, error) {
	query := s.db.WithContext(ctx).
		Where("daily_homeworks.tenant_id = ?", tenantID).
		Preload("TeacherAssignment.TeacherProfile.Person").
		Preload("TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		Preload("ClassSection").
		Preload("StudyGrade").
		Order("daily_homeworks.due_date DESC")

	if sectionID != nil {
		query = query.Where("daily_homeworks.class_section_id = ?", *sectionID)
	}
	if gradeID != nil {
		query = query.Where("daily_homeworks.study_grade_id = ?", *gradeID)
	}
	if teacherProfileID != nil {
		query = query.Joins("JOIN teacher_assignments ON teacher_assignments.id = daily_homeworks.teacher_assignment_id").
			Where("teacher_assignments.teacher_profile_id = ?", *teacherProfileID)
	}

	var list []models.DailyHomework
	if err := query.Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

// GetStudentHomeworks retrieves all homeworks assigned to student's enrolled sections.
func (s *HomeworkService) GetStudentHomeworks(ctx context.Context, tenantID uuid.UUID, studentProfileID uuid.UUID) ([]StudentHomeworkItemDTO, error) {
	// 1. Find student's active enrollment to determine their class section
	var enrollments []models.AcademicEnrollment
	if err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND student_profile_id = ? AND status = 'active'", tenantID, studentProfileID).
		Find(&enrollments).Error; err != nil {
		return nil, err
	}

	if len(enrollments) == 0 {
		return []StudentHomeworkItemDTO{}, nil
	}

	var sectionIDs []uuid.UUID
	for _, en := range enrollments {
		if en.ClassSectionID != nil {
			sectionIDs = append(sectionIDs, *en.ClassSectionID)
		}
	}

	if len(sectionIDs) == 0 {
		return []StudentHomeworkItemDTO{}, nil
	}

	// 2. Fetch all homeworks for these sections
	var homeworks []models.DailyHomework
	if err := s.db.WithContext(ctx).
		Where("daily_homeworks.tenant_id = ? AND daily_homeworks.class_section_id IN ?", tenantID, sectionIDs).
		Preload("TeacherAssignment.TeacherProfile.Person").
		Preload("TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		Preload("ClassSection").
		Preload("StudyGrade").
		Order("daily_homeworks.due_date DESC").
		Find(&homeworks).Error; err != nil {
		return nil, err
	}

	if len(homeworks) == 0 {
		return []StudentHomeworkItemDTO{}, nil
	}

	var hwIDs []uuid.UUID
	for _, hw := range homeworks {
		hwIDs = append(hwIDs, hw.ID)
	}

	// 3. Fetch submissions by this student for these homeworks
	var submissions []models.HomeworkSubmission
	_ = s.db.WithContext(ctx).
		Where("tenant_id = ? AND student_profile_id = ? AND daily_homework_id IN ?", tenantID, studentProfileID, hwIDs).
		Find(&submissions).Error

	submissionMap := make(map[uuid.UUID]models.HomeworkSubmission)
	for _, sub := range submissions {
		submissionMap[sub.DailyHomeworkID] = sub
	}

	// 4. Assemble DTOs
	var result []StudentHomeworkItemDTO
	for _, hw := range homeworks {
		subjectName := "مادة دراسية"
		if hw.TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Subject.Name != "" {
			subjectName = hw.TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Subject.Name
		} else if hw.TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Name != "" {
			subjectName = hw.TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Name
		}

		teacherName := "مدرس معتمد"
		if hw.TeacherAssignment.TeacherProfile.Person.FirstName != "" {
			teacherName = hw.TeacherAssignment.TeacherProfile.Person.FullName()
		}

		gradeName := ""
		if hw.StudyGrade != nil {
			gradeName = hw.StudyGrade.Name
		}

		sectionName := ""
		if hw.ClassSection != nil {
			sectionName = hw.ClassSection.Name
		}

		dto := StudentHomeworkItemDTO{
			DailyHomework: hw,
			SubjectName:   subjectName,
			TeacherName:   teacherName,
			GradeName:     gradeName,
			SectionName:   sectionName,
		}

		if sub, ok := submissionMap[hw.ID]; ok {
			dto.UserSubmission = &sub
			dto.IsSubmitted = true
		} else {
			dto.IsSubmitted = false
		}

		result = append(result, dto)
	}

	return result, nil
}

// SubmitHomework handles a student/guardian submitting homework (text and/or image URLs).
func (s *HomeworkService) SubmitHomework(ctx context.Context, tenantID uuid.UUID, homeworkID uuid.UUID, studentID uuid.UUID, submittedBy string, text *string, images []string) (*models.HomeworkSubmission, error) {
	var hw models.DailyHomework
	if err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", homeworkID, tenantID).
		First(&hw).Error; err != nil {
		return nil, ErrHomeworkNotFound
	}

	imagesJSON := "[]"
	if len(images) > 0 {
		if bytes, err := json.Marshal(images); err == nil {
			imagesJSON = string(bytes)
		}
	}

	if submittedBy != "guardian" {
		submittedBy = "student"
	}

	var existing models.HomeworkSubmission
	err := s.db.WithContext(ctx).
		Where("daily_homework_id = ? AND student_profile_id = ?", homeworkID, studentID).
		First(&existing).Error

	now := time.Now()
	if err == nil {
		// Update existing submission
		existing.SubmittedBy = submittedBy
		existing.SubmissionText = text
		existing.Images = imagesJSON
		existing.SubmittedAt = now
		existing.ReviewStatus = "pending" // reset to pending on resubmit
		if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, err
		}
		return &existing, nil
	}

	// Create new submission
	sub := models.HomeworkSubmission{
		TenantID:         tenantID,
		DailyHomeworkID:  homeworkID,
		StudentProfileID: studentID,
		SubmittedBy:      submittedBy,
		SubmissionText:   text,
		Images:           imagesJSON,
		SubmittedAt:      now,
		ReviewStatus:     "pending",
	}

	if err := s.db.WithContext(ctx).Create(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

// GetHomeworkRosterWithSubmissions returns the complete student roster of the section with each student's submission status.
func (s *HomeworkService) GetHomeworkRosterWithSubmissions(ctx context.Context, tenantID uuid.UUID, homeworkID uuid.UUID) (*models.DailyHomework, []StudentRosterSubmissionDTO, error) {
	var hw models.DailyHomework
	if err := s.db.WithContext(ctx).
		Where("daily_homeworks.id = ? AND daily_homeworks.tenant_id = ?", homeworkID, tenantID).
		Preload("TeacherAssignment.TeacherProfile.Person").
		Preload("TeacherAssignment.AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		Preload("ClassSection").
		Preload("StudyGrade").
		First(&hw).Error; err != nil {
		return nil, nil, ErrHomeworkNotFound
	}

	if hw.ClassSectionID == nil {
		return &hw, []StudentRosterSubmissionDTO{}, nil
	}

	// Fetch all students actively enrolled in this class section
	var enrollments []models.AcademicEnrollment
	if err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND class_section_id = ? AND status = 'active'", tenantID, *hw.ClassSectionID).
		Preload("StudentProfile.Person").
		Find(&enrollments).Error; err != nil {
		return &hw, nil, err
	}

	// Fetch all submissions for this homework
	var submissions []models.HomeworkSubmission
	_ = s.db.WithContext(ctx).
		Where("tenant_id = ? AND daily_homework_id = ?", tenantID, homeworkID).
		Find(&submissions).Error

	subMap := make(map[uuid.UUID]models.HomeworkSubmission)
	for _, sub := range submissions {
		subMap[sub.StudentProfileID] = sub
	}

	var roster []StudentRosterSubmissionDTO
	for _, en := range enrollments {
		st := en.StudentProfile
		fullName := "طالب"
		if st.Person.FirstName != "" {
			fullName = st.Person.FullName()
		}

		item := StudentRosterSubmissionDTO{
			StudentID:     st.ID,
			StudentNumber: st.StudentNumber,
			FullName:      fullName,
			PhotoURL:      st.PhotoURL,
			ReviewStatus:  "not_submitted",
			Images:        []string{},
		}

		if sub, ok := subMap[st.ID]; ok {
			item.SubmissionID = &sub.ID
			item.SubmittedAt = &sub.SubmittedAt
			item.SubmittedBy = &sub.SubmittedBy
			item.SubmissionText = sub.SubmissionText
			item.ReviewStatus = sub.ReviewStatus
			item.TeacherRating = sub.TeacherRating
			item.TeacherFeedback = sub.TeacherFeedback
			item.ReviewedAt = sub.ReviewedAt

			// Parse images JSON array
			var imgList []string
			if err := json.Unmarshal([]byte(sub.Images), &imgList); err == nil {
				item.Images = imgList
			}
		}

		roster = append(roster, item)
	}

	return &hw, roster, nil
}

// ReviewSubmission updates teacher's rating and feedback for a student submission.
func (s *HomeworkService) ReviewSubmission(ctx context.Context, tenantID uuid.UUID, submissionID uuid.UUID, rating *string, feedback *string, reviewStatus string) (*models.HomeworkSubmission, error) {
	var sub models.HomeworkSubmission
	if err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", submissionID, tenantID).
		First(&sub).Error; err != nil {
		return nil, ErrSubmissionNotFound
	}

	if reviewStatus == "" {
		reviewStatus = "reviewed"
	}

	now := time.Now()
	sub.ReviewStatus = reviewStatus
	sub.TeacherRating = rating
	sub.TeacherFeedback = feedback
	sub.ReviewedAt = &now

	if err := s.db.WithContext(ctx).Save(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

// UploadSchoolHomeworkRequest defines payload for student/parent uploading school homework.
type UploadSchoolHomeworkRequest struct {
	StudentID   uuid.UUID `json:"student_id"`
	SubjectName string    `json:"subject_name"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Images      []string  `json:"images,omitempty"`
	SubmittedBy string    `json:"submitted_by"` // student or guardian
}

// UploadSchoolHomework records a homework assignment received from regular day school.
func (s *HomeworkService) UploadSchoolHomework(ctx context.Context, tenantID uuid.UUID, req UploadSchoolHomeworkRequest) (*models.StudentSchoolHomework, error) {
	// Look up student's active enrollment to attach section and grade automatically
	var enrollment models.AcademicEnrollment
	var sectionID *uuid.UUID
	var gradeID *uuid.UUID

	if err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND student_profile_id = ? AND status = 'active'", tenantID, req.StudentID).
		Preload("ClassSection").
		First(&enrollment).Error; err == nil {
		if enrollment.ClassSectionID != nil {
			sectionID = enrollment.ClassSectionID
			if enrollment.ClassSection != nil && enrollment.ClassSection.StudyGradeID != uuid.Nil {
				gID := enrollment.ClassSection.StudyGradeID
				gradeID = &gID
			}
		}
	}

	imagesJSON := "[]"
	if len(req.Images) > 0 {
		if b, err := json.Marshal(req.Images); err == nil {
			imagesJSON = string(b)
		}
	}

	submittedBy := req.SubmittedBy
	if submittedBy == "" {
		submittedBy = "student"
	}

	hw := models.StudentSchoolHomework{
		TenantID:         tenantID,
		StudentProfileID: req.StudentID,
		ClassSectionID:   sectionID,
		StudyGradeID:     gradeID,
		SubjectName:      req.SubjectName,
		Title:            req.Title,
		Description:      req.Description,
		Images:           imagesJSON,
		SubmittedBy:      submittedBy,
		IsSeen:           false,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(&hw).Error; err != nil {
		return nil, err
	}

	// Reload with relations
	_ = s.db.WithContext(ctx).
		Preload("StudentProfile.Person").
		Preload("ClassSection").
		Preload("StudyGrade").
		First(&hw, "id = ?", hw.ID)

	return &hw, nil
}

// GetStudentSchoolHomeworks returns all school homeworks uploaded by/for a specific student.
func (s *HomeworkService) GetStudentSchoolHomeworks(ctx context.Context, tenantID uuid.UUID, studentID uuid.UUID) ([]models.StudentSchoolHomework, error) {
	var list []models.StudentSchoolHomework
	err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND student_profile_id = ?", tenantID, studentID).
		Preload("StudentProfile.Person").
		Preload("ClassSection").
		Preload("StudyGrade").
		Preload("TeacherProfile.Person").
		Order("created_at DESC").
		Find(&list).Error
	return list, err
}

// GetSchoolHomeworksFeed returns the feed of school homeworks for teachers or institute admin.
func (s *HomeworkService) GetSchoolHomeworksFeed(ctx context.Context, tenantID uuid.UUID, teacherProfileID *uuid.UUID, sectionID *uuid.UUID, gradeID *uuid.UUID, subjectName string) ([]models.StudentSchoolHomework, error) {
	query := s.db.WithContext(ctx).
		Where("student_school_homeworks.tenant_id = ?", tenantID).
		Preload("StudentProfile.Person").
		Preload("ClassSection").
		Preload("StudyGrade").
		Preload("TeacherProfile.Person")

	if sectionID != nil {
		query = query.Where("student_school_homeworks.class_section_id = ?", *sectionID)
	}

	if gradeID != nil {
		query = query.Where("student_school_homeworks.study_grade_id = ?", *gradeID)
	}

	if subjectName != "" {
		query = query.Where("student_school_homeworks.subject_name ILIKE ?", "%"+subjectName+"%")
	}

	// If teacher profile is passed and no specific section is forced, filter to sections taught by teacher
	if teacherProfileID != nil && sectionID == nil {
		var assignments []models.TeacherAssignment
		if err := s.db.WithContext(ctx).
			Where("tenant_id = ? AND teacher_profile_id = ? AND status = 'active'", tenantID, *teacherProfileID).
			Find(&assignments).Error; err == nil && len(assignments) > 0 {
			var sectionIDs []uuid.UUID
			for _, a := range assignments {
				if a.ClassSectionID != nil {
					sectionIDs = append(sectionIDs, *a.ClassSectionID)
				}
			}
			if len(sectionIDs) > 0 {
				query = query.Where("student_school_homeworks.class_section_id IN ?", sectionIDs)
			}
		}
	}

	var list []models.StudentSchoolHomework
	if err := query.Order("student_school_homeworks.created_at DESC").Limit(100).Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

// AcknowledgeSchoolHomework records teacher viewing/commenting on student's homework.
func (s *HomeworkService) AcknowledgeSchoolHomework(ctx context.Context, tenantID uuid.UUID, homeworkID uuid.UUID, teacherProfileID *uuid.UUID, teacherComment *string) (*models.StudentSchoolHomework, error) {
	var hw models.StudentSchoolHomework
	if err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", homeworkID, tenantID).
		First(&hw).Error; err != nil {
		return nil, ErrHomeworkNotFound
	}

	now := time.Now()
	hw.IsSeen = true
	hw.SeenAt = &now
	if teacherProfileID != nil {
		hw.TeacherProfileID = teacherProfileID
	}
	if teacherComment != nil && *teacherComment != "" {
		hw.TeacherComment = teacherComment
	}

	if err := s.db.WithContext(ctx).Save(&hw).Error; err != nil {
		return nil, err
	}

	// Preload relations
	_ = s.db.WithContext(ctx).
		Preload("StudentProfile.Person").
		Preload("ClassSection").
		Preload("StudyGrade").
		Preload("TeacherProfile.Person").
		First(&hw, "id = ?", hw.ID)

	return &hw, nil
}

