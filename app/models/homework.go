package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DailyHomework represents a daily homework assignment or lesson preparation topic.
type DailyHomework struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	TeacherAssignmentID uuid.UUID      `gorm:"type:uuid;not null;index" json:"teacher_assignment_id"`
	ClassSectionID      *uuid.UUID     `gorm:"type:uuid;index" json:"class_section_id,omitempty"`
	StudyGradeID        *uuid.UUID     `gorm:"type:uuid;index" json:"study_grade_id,omitempty"`
	Title               string         `gorm:"type:varchar(255);not null" json:"title"`
	LessonTopic         *string        `gorm:"type:varchar(255)" json:"lesson_topic,omitempty"`
	Description         *string        `gorm:"type:text" json:"description,omitempty"`
	AttachmentURLs      string         `gorm:"type:jsonb;default:'[]'" json:"attachment_urls"` // JSON array of string URLs
	DueDate             time.Time      `gorm:"not null;index" json:"due_date"`
	Status              string         `gorm:"type:varchar(50);not null;default:'active'" json:"status"` // active, closed
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	TeacherAssignment TeacherAssignment    `gorm:"foreignKey:TeacherAssignmentID" json:"teacher_assignment,omitempty"`
	ClassSection      *ClassSection        `gorm:"foreignKey:ClassSectionID" json:"class_section,omitempty"`
	StudyGrade        *StudyGrade          `gorm:"foreignKey:StudyGradeID" json:"study_grade,omitempty"`
	Submissions       []HomeworkSubmission `gorm:"foreignKey:DailyHomeworkID" json:"submissions,omitempty"`
}

func (DailyHomework) TableName() string {
	return "daily_homeworks"
}

// HomeworkSubmission represents a student's submission (text and/or photos of their notebook/answers).
type HomeworkSubmission struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	DailyHomeworkID  uuid.UUID      `gorm:"type:uuid;not null;index;uniqueIndex:uq_hw_student" json:"daily_homework_id"`
	StudentProfileID uuid.UUID      `gorm:"type:uuid;not null;index;uniqueIndex:uq_hw_student" json:"student_profile_id"`
	SubmittedBy      string         `gorm:"type:varchar(50);not null;default:'student'" json:"submitted_by"` // student, guardian
	SubmissionText   *string        `gorm:"type:text" json:"submission_text,omitempty"`
	Images           string         `gorm:"type:jsonb;default:'[]'" json:"images"` // JSON array of image URLs
	SubmittedAt      time.Time      `gorm:"not null" json:"submitted_at"`
	ReviewStatus     string         `gorm:"type:varchar(50);not null;default:'pending';index" json:"review_status"` // pending, reviewed, needs_resubmission
	TeacherRating    *string        `gorm:"type:varchar(50)" json:"teacher_rating,omitempty"`                        // excellent, good, acceptable, incomplete, not_done
	TeacherFeedback  *string        `gorm:"type:text" json:"teacher_feedback,omitempty"`
	ReviewedAt       *time.Time     `json:"reviewed_at,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	DailyHomework  *DailyHomework  `gorm:"foreignKey:DailyHomeworkID" json:"daily_homework,omitempty"`
	StudentProfile *StudentProfile `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
}

func (HomeworkSubmission) TableName() string {
	return "homework_submissions"
}

// StudentSchoolHomework represents homework/preparation brought by the student from their day school
// which the institute teachers review to assist and tutor the student.
type StudentSchoolHomework struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID uuid.UUID      `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	ClassSectionID   *uuid.UUID     `gorm:"type:uuid;index" json:"class_section_id,omitempty"`
	StudyGradeID     *uuid.UUID     `gorm:"type:uuid;index" json:"study_grade_id,omitempty"`
	SubjectName      string         `gorm:"type:varchar(150);not null" json:"subject_name"`
	Title            string         `gorm:"type:varchar(255);not null" json:"title"`
	Description      *string        `gorm:"type:text" json:"description,omitempty"`
	Images           string         `gorm:"type:jsonb;default:'[]'" json:"images"` // JSON array of image URLs
	SubmittedBy      string         `gorm:"type:varchar(50);not null;default:'student'" json:"submitted_by"` // student, guardian
	TeacherProfileID *uuid.UUID     `gorm:"type:uuid;index" json:"teacher_profile_id,omitempty"`
	TeacherComment   *string        `gorm:"type:text" json:"teacher_comment,omitempty"`
	IsSeen           bool           `gorm:"not null;default:false" json:"is_seen"`
	SeenAt           *time.Time     `json:"seen_at,omitempty"`
	CreatedAt        time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	StudentProfile *StudentProfile `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
	ClassSection   *ClassSection   `gorm:"foreignKey:ClassSectionID" json:"class_section,omitempty"`
	StudyGrade     *StudyGrade     `gorm:"foreignKey:StudyGradeID" json:"study_grade,omitempty"`
	TeacherProfile *TeacherProfile `gorm:"foreignKey:TeacherProfileID" json:"teacher_profile,omitempty"`
}

func (StudentSchoolHomework) TableName() string {
	return "student_school_homeworks"
}
