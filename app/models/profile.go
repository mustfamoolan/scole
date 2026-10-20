package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// StudentProfile represents a student's institutional record within a specific tenant.
type StudentProfile struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID              uuid.UUID      `gorm:"type:uuid;not null;index:idx_student_tenant_person,unique" json:"tenant_id"`
	PersonID              uuid.UUID      `gorm:"type:uuid;not null;index:idx_student_tenant_person,unique" json:"person_id"`
	StudentNumber         string         `gorm:"type:varchar(50);not null;index:idx_student_tenant_num,unique" json:"student_number"`
	EnrollmentStatus      string         `gorm:"type:varchar(50);not null;default:'registered';index" json:"enrollment_status"` // registered, active, withdrawn, suspended, graduated
	MedicalNotes          *string        `gorm:"type:text" json:"medical_notes,omitempty"`
	SpecialEducationNeeds *string        `gorm:"type:text" json:"special_education_needs,omitempty"`
	AccessCode            string         `gorm:"type:varchar(50);index:idx_student_tenant_code,unique" json:"access_code"` // Easy login code for student app (e.g. STU-84920)
	GeneralRegisterNumber *string        `gorm:"type:varchar(100);index" json:"general_register_number,omitempty"`         // رقم السجل العام الورقي
	PreviousSchool        *string        `gorm:"type:varchar(200)" json:"previous_school,omitempty"`                       // المدرسة أو المعهد السابق
	GraduationDocNumber   *string        `gorm:"type:varchar(100)" json:"graduation_doc_number,omitempty"`                 // رقم وثيقة التخرج أو كتاب النقل
	IdentityDocType       *string        `gorm:"type:varchar(50)" json:"identity_doc_type,omitempty"`                     // نوع الوثيقة: بطاقة وطنية أو هوية أحوال
	CivilVolume           *string        `gorm:"type:varchar(50)" json:"civil_volume,omitempty"`                          // رقم السجل المدني
	CivilPage             *string        `gorm:"type:varchar(50)" json:"civil_page,omitempty"`                            // رقم الصحيفة
	EmergencyContactName  *string        `gorm:"type:varchar(100)" json:"emergency_contact_name,omitempty"`               // اسم جهة الطوارئ
	EmergencyContactPhone *string        `gorm:"type:varchar(50)" json:"emergency_contact_phone,omitempty"`              // هاتف الطوارئ
	HealthStatus          *string        `gorm:"type:varchar(150)" json:"health_status,omitempty"`                        // الحالة الصحية العامة
	PhotoURL              *string        `gorm:"type:text" json:"photo_url,omitempty"`                                    // صورة الطالب الشخصية
	IDCardFrontURL        *string        `gorm:"type:text" json:"id_card_front_url,omitempty"`                            // هوية/بطاقة الطالب - الوجه الأمامي
	IDCardBackURL         *string        `gorm:"type:text" json:"id_card_back_url,omitempty"`                             // هوية/بطاقة الطالب - الوجه الخلفي
	GuardianIDFrontURL    *string        `gorm:"type:text" json:"guardian_id_front_url,omitempty"`                        // هوية/بطاقة ولي الأمر - الوجه الأمامي
	GuardianIDBackURL     *string        `gorm:"type:text" json:"guardian_id_back_url,omitempty"`                         // هوية/بطاقة ولي الأمر - الوجه الخلفي
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`

	Person    Person                   `gorm:"foreignKey:PersonID" json:"person,omitempty"`
	Tenant    *Tenant                  `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Guardians []GuardianStudentRelation `gorm:"foreignKey:StudentProfileID" json:"guardians,omitempty"`
}

func (StudentProfile) TableName() string {
	return "student_profiles"
}

// GuardianProfile represents a parent/guardian institutional record within a specific tenant.
type GuardianProfile struct {
	ID         uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID   uuid.UUID      `gorm:"type:uuid;not null;index:idx_guardian_tenant_person,unique" json:"tenant_id"`
	PersonID   uuid.UUID      `gorm:"type:uuid;not null;index:idx_guardian_tenant_person,unique" json:"person_id"`
	AccessCode string         `gorm:"type:varchar(50);not null;index:idx_guardian_tenant_code,unique" json:"access_code"` // Easy login code for guardian app (e.g. GRD-93214)
	Occupation *string        `gorm:"type:varchar(100)" json:"occupation,omitempty"`
	Notes      *string        `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	Person   Person                    `gorm:"foreignKey:PersonID" json:"person,omitempty"`
	Tenant   *Tenant                   `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Students []GuardianStudentRelation `gorm:"foreignKey:GuardianPersonID;references:PersonID" json:"students,omitempty"`
}

func (GuardianProfile) TableName() string {
	return "guardian_profiles"
}

// TeacherProfile represents a teacher/instructor's institutional record within a specific tenant.
type TeacherProfile struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID       uuid.UUID      `gorm:"type:uuid;not null;index:idx_teacher_tenant_person,unique" json:"tenant_id"`
	PersonID       uuid.UUID      `gorm:"type:uuid;not null;index:idx_teacher_tenant_person,unique" json:"person_id"`
	StaffNumber    string           `gorm:"type:varchar(50);not null;index:idx_teacher_tenant_num,unique" json:"staff_number"`
	AccessCode     string           `gorm:"type:varchar(50);index:idx_teacher_tenant_access_code,unique" json:"access_code"`
	Specialization *string          `gorm:"type:varchar(150)" json:"specialization,omitempty"`
	EmploymentType string           `gorm:"type:varchar(50);not null;default:'full_time'" json:"employment_type"` // full_time, part_time, per_session, contractor
	HourlyRate     *decimal.Decimal `gorm:"type:numeric(15,4)" json:"hourly_rate,omitempty"`
	MonthlySalary  *decimal.Decimal `gorm:"type:numeric(15,4)" json:"monthly_salary,omitempty"`
	Status         string           `gorm:"type:varchar(50);not null;default:'active';index" json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	StaffProfileID *uuid.UUID     `gorm:"type:uuid;index" json:"staff_profile_id,omitempty"`

	Person       Person        `gorm:"foreignKey:PersonID" json:"person,omitempty"`
	Tenant       *Tenant       `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	StaffProfile *StaffProfile `gorm:"foreignKey:StaffProfileID" json:"staff_profile,omitempty"`
}

func (TeacherProfile) TableName() string {
	return "teacher_profiles"
}

// GuardianStudentRelation links a Guardian (Person) to a Student Profile with granular permissions.
type GuardianStudentRelation struct {
	ID                       uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID                 uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	GuardianPersonID         uuid.UUID  `gorm:"type:uuid;not null;index:idx_guardian_student,unique" json:"guardian_person_id"`
	StudentProfileID         uuid.UUID  `gorm:"type:uuid;not null;index:idx_guardian_student,unique" json:"student_profile_id"`
	RelationshipType         string     `gorm:"type:varchar(50);not null" json:"relationship_type"` // father, mother, uncle, legal_guardian, sponsor
	IsPrimary                bool       `gorm:"not null;default:false" json:"is_primary"`
	CanViewGrades            bool       `gorm:"not null;default:true" json:"can_view_grades"`
	CanViewAttendance        bool       `gorm:"not null;default:true" json:"can_view_attendance"`
	CanReceiveNotifications  bool       `gorm:"not null;default:true" json:"can_receive_notifications"`
	CanPickupStudent         bool       `gorm:"not null;default:false" json:"can_pickup_student"`
	IsFinanciallyResponsible bool       `gorm:"not null;default:false" json:"is_financially_responsible"`
	ValidUntil               *time.Time `json:"valid_until,omitempty"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`

	GuardianPerson Person          `gorm:"foreignKey:GuardianPersonID" json:"guardian_person,omitempty"`
	StudentProfile *StudentProfile `gorm:"foreignKey:StudentProfileID" json:"student_profile,omitempty"`
}

func (GuardianStudentRelation) TableName() string {
	return "guardian_student_relations"
}
