package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AttendanceRecord captures the real-world physical or virtual presence of a student.
type AttendanceRecord struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID uuid.UUID `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	ActualSessionID  uuid.UUID `gorm:"type:uuid;not null;index" json:"actual_session_id"`
	RecordDate       time.Time `gorm:"not null" json:"record_date"`
	Status           string    `gorm:"type:varchar(30);not null" json:"status"` // present, absent_unexcused, absent_excused, late, left_early
	MinutesLate      int       `gorm:"not null;default:0" json:"minutes_late"`
	ExcuseDocument   *string   `gorm:"type:varchar(500)" json:"excuse_document,omitempty"`
	ExcuseNotes      *string   `gorm:"type:text" json:"excuse_notes,omitempty"`
	RecordedByUserID uuid.UUID `gorm:"type:uuid;not null" json:"recorded_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	StudentProfile StudentProfile     `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
	ActualSession  ActualClassSession `gorm:"foreignKey:ActualSessionID" json:"actual_session,omitempty"`
}

func (AttendanceRecord) TableName() string {
	return "attendance_records"
}

// AssessmentPlan defines the grading policy and weight breakdown for an adopted curriculum or term.
type AssessmentPlan struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	AdoptedCurriculumID uuid.UUID      `gorm:"type:uuid;not null;index" json:"adopted_curriculum_id"`
	AcademicTermID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"academic_term_id"`
	Name                string         `gorm:"type:varchar(150);not null" json:"name"`
	TotalMaxScore       float64        `gorm:"type:numeric(5,2);not null;default:100.00" json:"total_max_score"`
	PassingScore        float64        `gorm:"type:numeric(5,2);not null;default:50.00" json:"passing_score"`
	PolicyVersion       string         `gorm:"type:varchar(50);not null;default:'v1'" json:"policy_version"`
	IsLocked            bool           `gorm:"not null;default:false" json:"is_locked"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	Items []AssessmentItem `gorm:"foreignKey:AssessmentPlanID" json:"items,omitempty"`
}

func (AssessmentPlan) TableName() string {
	return "assessment_plans"
}

// AssessmentItem represents a specific exam, quiz, assignment, or practical assessment.
type AssessmentItem struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	AssessmentPlanID uuid.UUID  `gorm:"type:uuid;not null;index" json:"assessment_plan_id"`
	ClassSectionID   *uuid.UUID `gorm:"type:uuid;index" json:"class_section_id,omitempty"`
	StudyCohortID    *uuid.UUID `gorm:"type:uuid;index" json:"study_cohort_id,omitempty"`
	Title            string     `gorm:"type:varchar(150);not null" json:"title"`
	ItemType         string     `gorm:"type:varchar(50);not null" json:"item_type"` // quiz, midterm_exam, final_exam, homework, project
	MaxScore         float64    `gorm:"type:numeric(5,2);not null" json:"max_score"`
	WeightPercentage float64    `gorm:"type:numeric(5,2);not null" json:"weight_percentage"`
	AssessmentDate   time.Time  `gorm:"not null" json:"assessment_date"`
	IsFinalized      bool       `gorm:"not null;default:false" json:"is_finalized"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (AssessmentItem) TableName() string {
	return "assessment_items"
}

// StudentGradeRecord stores the officially recorded score of a student on an assessment item.
type StudentGradeRecord struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	AssessmentItemID uuid.UUID  `gorm:"type:uuid;not null;index:idx_student_assessment,unique" json:"assessment_item_id"`
	StudentProfileID uuid.UUID  `gorm:"type:uuid;not null;index:idx_student_assessment,unique" json:"student_profile_id"`
	RawScore         float64    `gorm:"type:numeric(5,2);not null" json:"raw_score"`
	FinalScore       float64    `gorm:"type:numeric(5,2);not null" json:"final_score"`
	GradeLetter      *string    `gorm:"type:varchar(10)" json:"grade_letter,omitempty"` // "A+", "B", "Pass"
	IsAbsent         bool       `gorm:"not null;default:false" json:"is_absent"`
	IsExcused        bool       `gorm:"not null;default:false" json:"is_excused"`
	Status           string     `gorm:"type:varchar(50);not null;default:'submitted'" json:"status"` // draft, submitted, approved, revised
	RecordedByUserID uuid.UUID  `gorm:"type:uuid;not null" json:"recorded_by_user_id"`
	ApprovedByUserID *uuid.UUID `gorm:"type:uuid" json:"approved_by_user_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	AuditLogs []GradeAuditLog `gorm:"foreignKey:StudentGradeRecordID" json:"audit_logs,omitempty"`
}

func (StudentGradeRecord) TableName() string {
	return "student_grade_records"
}

// GradeAuditLog enforces complete transparency whenever an approved grade is altered.
type GradeAuditLog struct {
	ID                   uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentGradeRecordID uuid.UUID `gorm:"type:uuid;not null;index" json:"student_grade_record_id"`
	PreviousScore        float64   `gorm:"type:numeric(5,2);not null" json:"previous_score"`
	NewScore             float64   `gorm:"type:numeric(5,2);not null" json:"new_score"`
	ChangeReason         string    `gorm:"type:text;not null" json:"change_reason"`
	ApprovedRefNumber    *string   `gorm:"type:varchar(100)" json:"approved_ref_number,omitempty"`
	ModifiedByUserID     uuid.UUID `gorm:"type:uuid;not null" json:"modified_by_user_id"`
	ModifiedAt           time.Time `gorm:"not null" json:"modified_at"`
}

func (GradeAuditLog) TableName() string {
	return "grade_audit_logs"
}

// BehaviorIncident tracks positive or disciplinary conduct incidents.
type BehaviorIncident struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID         uuid.UUID `gorm:"type:uuid;not null;index" json:"tenant_id"`
	StudentProfileID uuid.UUID `gorm:"type:uuid;not null;index" json:"student_profile_id"`
	IncidentDate     time.Time `gorm:"not null" json:"incident_date"`
	IncidentType     string    `gorm:"type:varchar(50);not null" json:"incident_type"` // positive_merit, minor_misconduct, serious_violation
	Title            string    `gorm:"type:varchar(200);not null" json:"title"`
	Description      string    `gorm:"type:text;not null" json:"description"`
	ReportedByUserID uuid.UUID `gorm:"type:uuid;not null" json:"reported_by_user_id"`
	IsConfidential   bool      `gorm:"not null;default:false" json:"is_confidential"`
	Status           string    `gorm:"type:varchar(50);not null;default:'under_review'" json:"status"` // reported, under_review, resolved, dismissed
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (BehaviorIncident) TableName() string {
	return "behavior_incidents"
}
