package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrStudentNotFound    = errors.New("student profile not found in this tenant")
	ErrEnrollmentNotFound = errors.New("enrollment record not found in this tenant")
	ErrTermNotFound       = errors.New("academic term not found in this tenant")
	ErrSectionNotFound    = errors.New("class section not found in this tenant")
	ErrCohortNotFound     = errors.New("study cohort not found in this tenant")
	ErrGuardianNotFound   = errors.New("guardian person record not found")
	ErrInvalidEnrollment  = errors.New("student is already actively enrolled in this term")
	ErrSectionFull        = errors.New("class section capacity reached")
)

// GenerateRandomCode generates an easy-to-type, memorable unique code (e.g. STU-84920 or GRD-19482)
func GenerateRandomCode(prefix string) string {
	n, _ := rand.Int(rand.Reader, big.NewInt(90000))
	num := n.Int64() + 10000
	return fmt.Sprintf("%s-%d", prefix, num)
}

type CreateStudentRequest struct {
	PersonID              uuid.UUID  `json:"person_id"`
	FirstName             string     `json:"first_name"`
	FatherName            *string    `json:"father_name,omitempty"`
	GrandfatherName       *string    `json:"grandfather_name,omitempty"`
	LastName              string     `json:"last_name"`
	Gender                string     `json:"gender"`
	DateOfBirth           *time.Time `json:"date_of_birth,omitempty"`
	NationalIDNumber      *string    `json:"national_id_number,omitempty"`
	Phone                 *string    `json:"phone,omitempty"`
	StudentNumber         string     `json:"student_number"`
	EnrollmentStatus      string     `json:"enrollment_status"`
	MedicalNotes          *string    `json:"medical_notes,omitempty"`
	SpecialEducationNeeds *string    `json:"special_education_needs,omitempty"`
	AccessCode            string     `json:"access_code,omitempty"`

	// Iraqi Student File & Registry (السجل العام والنسب وبيانات السكن العراقية)
	GeneralRegisterNumber *string `json:"general_register_number,omitempty"` // رقم السجل العام الورقي
	MotherName            *string `json:"mother_name,omitempty"`             // اسم الأم
	MotherFatherName      *string `json:"mother_father_name,omitempty"`      // اسم والد الأم
	PlaceOfBirth          *string `json:"place_of_birth,omitempty"`          // محل الولادة
	BloodType             *string `json:"blood_type,omitempty"`             // فصيلة الدم
	Governorate           *string `json:"governorate,omitempty"`            // المحافظة
	CityDistrict          *string `json:"city_district,omitempty"`           // القضاء / المدينة
	Neighborhood          *string `json:"neighborhood,omitempty"`           // الحي / المنطقة
	StreetAlley           *string `json:"street_alley,omitempty"`            // الزقاق / المحلة
	HouseNumber           *string `json:"house_number,omitempty"`            // رقم الدار
	NearestLandmark       *string `json:"nearest_landmark,omitempty"`        // أقرب نقطة دالة
	PreviousSchool        *string `json:"previous_school,omitempty"`         // المدرسة أو الروضة السابقة
	GraduationDocNumber   *string `json:"graduation_doc_number,omitempty"`   // رقم وثيقة التخرج أو كتاب النقل
	IdentityDocType       *string `json:"identity_doc_type,omitempty"`       // نوع الوثيقة: موحدة / أحوال
	CivilVolume           *string `json:"civil_volume,omitempty"`            // رقم السجل المدني
	CivilPage             *string `json:"civil_page,omitempty"`              // رقم الصحيفة المدنية
	EmergencyContactName  *string `json:"emergency_contact_name,omitempty"`  // اسم جهة الطوارئ
	EmergencyContactPhone *string `json:"emergency_contact_phone,omitempty"` // هاتف الطوارئ
	HealthStatus          *string `json:"health_status,omitempty"`           // الحالة الصحية العامة
	PhotoURL              *string `json:"photo_url,omitempty"`                // صورة الطالب
	IDCardFrontURL        *string `json:"id_card_front_url,omitempty"`        // هوية الطالب - الوجه الأمامي
	IDCardBackURL         *string `json:"id_card_back_url,omitempty"`         // هوية الطالب - الوجه الخلفي
	GuardianIDFrontURL    *string `json:"guardian_id_front_url,omitempty"`    // هوية ولي الأمر - الوجه الأمامي
	GuardianIDBackURL     *string `json:"guardian_id_back_url,omitempty"`     // هوية ولي الأمر - الوجه الخلفي

	// Direct Academic Placement
	ClassSectionID *uuid.UUID `json:"class_section_id,omitempty"`
	SectionID      *uuid.UUID `json:"section_id,omitempty"`
	StudyGradeID   *uuid.UUID `json:"study_grade_id,omitempty"`
	GradeID        *uuid.UUID `json:"grade_id,omitempty"`
	StudyCohortID  *uuid.UUID `json:"study_cohort_id,omitempty"`

	// Optional Guardian linking/registration
	ExistingGuardianPersonID         *uuid.UUID `json:"existing_guardian_person_id,omitempty"`
	ExistingGuardianRelationshipType string     `json:"existing_guardian_relationship_type,omitempty"`

	Guardian *struct {
		FirstName        string  `json:"first_name"`
		FatherName       *string `json:"father_name,omitempty"`
		LastName         string  `json:"last_name"`
		RelationshipType string  `json:"relationship_type"` // father, mother, brother, uncle, guardian
		Phone            string  `json:"phone"`
		Occupation       *string `json:"occupation,omitempty"`
		NationalIDNumber *string `json:"national_id_number,omitempty"`
	} `json:"guardian,omitempty"`
}

type UpdateStudentRequest struct {
	FirstName        string     `json:"first_name"`
	FatherName       *string    `json:"father_name,omitempty"`
	GrandfatherName  *string    `json:"grandfather_name,omitempty"`
	LastName         string     `json:"last_name"`
	Gender           string     `json:"gender"`
	DateOfBirth      *time.Time `json:"date_of_birth,omitempty"`
	PlaceOfBirth     *string    `json:"place_of_birth,omitempty"`
	BloodType        *string    `json:"blood_type,omitempty"`
	NationalIDNumber *string    `json:"national_id_number,omitempty"`
	Phone            *string    `json:"phone,omitempty"`
	MedicalNotes     *string    `json:"medical_notes,omitempty"`
	EnrollmentStatus string     `json:"enrollment_status,omitempty"`

	// Iraqi Registry Fields
	GeneralRegisterNumber *string `json:"general_register_number,omitempty"`
	MotherName            *string `json:"mother_name,omitempty"`
	MotherFatherName      *string `json:"mother_father_name,omitempty"`
	Governorate           *string `json:"governorate,omitempty"`
	CityDistrict          *string `json:"city_district,omitempty"`
	Neighborhood          *string `json:"neighborhood,omitempty"`
	StreetAlley           *string `json:"street_alley,omitempty"`
	HouseNumber           *string `json:"house_number,omitempty"`
	NearestLandmark       *string `json:"nearest_landmark,omitempty"`
	PreviousSchool        *string `json:"previous_school,omitempty"`
	GraduationDocNumber   *string `json:"graduation_doc_number,omitempty"`
	IdentityDocType       *string `json:"identity_doc_type,omitempty"`
	CivilVolume           *string `json:"civil_volume,omitempty"`
	CivilPage             *string `json:"civil_page,omitempty"`
	EmergencyContactName  *string `json:"emergency_contact_name,omitempty"`
	EmergencyContactPhone *string `json:"emergency_contact_phone,omitempty"`
	HealthStatus          *string `json:"health_status,omitempty"`
	PhotoURL              *string `json:"photo_url,omitempty"`
	IDCardFrontURL        *string `json:"id_card_front_url,omitempty"`
	IDCardBackURL         *string `json:"id_card_back_url,omitempty"`
	GuardianIDFrontURL    *string `json:"guardian_id_front_url,omitempty"`
	GuardianIDBackURL     *string `json:"guardian_id_back_url,omitempty"`

	// Academic Section
	ClassSectionID *uuid.UUID `json:"class_section_id,omitempty"`
	SectionID      *uuid.UUID `json:"section_id,omitempty"`
	StudyGradeID   *uuid.UUID `json:"study_grade_id,omitempty"`
	GradeID        *uuid.UUID `json:"grade_id,omitempty"`
}

type LinkGuardianRequest struct {
	GuardianPersonID         uuid.UUID `json:"guardian_person_id"`
	RelationshipType         string    `json:"relationship_type"`
	IsPrimary                bool      `json:"is_primary"`
	CanViewGrades            bool      `json:"can_view_grades"`
	CanViewAttendance        bool      `json:"can_view_attendance"`
	CanReceiveNotifications  bool      `json:"can_receive_notifications"`
	CanPickupStudent         bool      `json:"can_pickup_student"`
	IsFinanciallyResponsible bool      `json:"is_financially_responsible"`
}

type AcademicService struct {
	db *gorm.DB
}

func NewAcademicService(db *gorm.DB) *AcademicService {
	return &AcademicService{db: db}
}

// CreateStudentProfile establishes a local student profile inside the tenant linked to a central Person.
func (s *AcademicService) CreateStudentProfile(ctx context.Context, tenantID uuid.UUID, req CreateStudentRequest) (*models.StudentProfile, error) {
	status := req.EnrollmentStatus
	if status == "" {
		status = "registered"
	}

	personID := req.PersonID
	if personID == uuid.Nil {
		if req.FirstName == "" || req.LastName == "" {
			return nil, errors.New("first name and last name are required when person_id is omitted")
		}
		gender := req.Gender
		if gender == "" {
			gender = "male"
		}

		person := models.Person{
			ID:               uuid.New(),
			NationalIDNumber: req.NationalIDNumber,
			FirstName:        strings.TrimSpace(req.FirstName),
			FatherName:       req.FatherName,
			GrandfatherName:  req.GrandfatherName,
			LastName:         strings.TrimSpace(req.LastName),
			Gender:           gender,
			DateOfBirth:      req.DateOfBirth,
			MotherName:       req.MotherName,
			MotherFatherName: req.MotherFatherName,
			PlaceOfBirth:     req.PlaceOfBirth,
			BloodType:        req.BloodType,
			Governorate:      req.Governorate,
			CityDistrict:     req.CityDistrict,
			Neighborhood:     req.Neighborhood,
			StreetAlley:      req.StreetAlley,
			HouseNumber:      req.HouseNumber,
			NearestLandmark:  req.NearestLandmark,
			AvatarURL:        req.PhotoURL,
		}
		if err := s.db.WithContext(ctx).Create(&person).Error; err != nil {
			return nil, fmt.Errorf("failed to create central person: %w", err)
		}
		personID = person.ID

		if req.Phone != nil && *req.Phone != "" {
			comm := models.CommunicationChannel{
				ID:           uuid.New(),
				PersonID:     personID,
				ChannelType:  "phone",
				ChannelValue: strings.TrimSpace(*req.Phone),
				IsPrimary:    true,
			}
			_ = s.db.WithContext(ctx).Create(&comm)
		}
	} else {
		// Verify central person exists
		var person models.Person
		if err := s.db.WithContext(ctx).Where("id = ?", personID).First(&person).Error; err != nil {
			return nil, fmt.Errorf("person not found: %w", err)
		}
	}

	// Auto-generate student_number if empty
	studentNumber := strings.TrimSpace(req.StudentNumber)
	if studentNumber == "" {
		studentNumber = fmt.Sprintf("STD-%d", time.Now().Unix()%1000000)
	}

	// Auto-generate or format easy access_code for student app
	accessCode := strings.TrimSpace(req.AccessCode)
	if accessCode == "" {
		accessCode = GenerateRandomCode("STU")
	}

	profile := &models.StudentProfile{
		ID:                    uuid.New(),
		TenantID:              tenantID,
		PersonID:              personID,
		StudentNumber:         studentNumber,
		AccessCode:            accessCode,
		EnrollmentStatus:      status,
		MedicalNotes:          req.MedicalNotes,
		SpecialEducationNeeds: req.SpecialEducationNeeds,
		GeneralRegisterNumber: req.GeneralRegisterNumber,
		PreviousSchool:        req.PreviousSchool,
		GraduationDocNumber:   req.GraduationDocNumber,
		IdentityDocType:       req.IdentityDocType,
		CivilVolume:           req.CivilVolume,
		CivilPage:             req.CivilPage,
		EmergencyContactName:  req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
		HealthStatus:          req.HealthStatus,
		PhotoURL:              req.PhotoURL,
		IDCardFrontURL:        req.IDCardFrontURL,
		IDCardBackURL:         req.IDCardBackURL,
		GuardianIDFrontURL:    req.GuardianIDFrontURL,
		GuardianIDBackURL:     req.GuardianIDBackURL,
	}

	if err := s.db.WithContext(ctx).Create(profile).Error; err != nil {
		return nil, fmt.Errorf("failed to create student profile: %w", err)
	}

	// Guardian Handling: Either link existing guardian OR create new guardian on the fly
	if req.ExistingGuardianPersonID != nil && *req.ExistingGuardianPersonID != uuid.Nil {
		relType := req.ExistingGuardianRelationshipType
		if relType == "" {
			relType = "father"
		}
		rel := models.GuardianStudentRelation{
			ID:                       uuid.New(),
			TenantID:                 tenantID,
			GuardianPersonID:         *req.ExistingGuardianPersonID,
			StudentProfileID:         profile.ID,
			RelationshipType:         relType,
			IsPrimary:                true,
			CanViewGrades:            true,
			CanViewAttendance:        true,
			CanReceiveNotifications:  true,
			CanPickupStudent:         true,
			IsFinanciallyResponsible: true,
		}
		_ = s.db.WithContext(ctx).Create(&rel)
	} else if req.Guardian != nil && strings.TrimSpace(req.Guardian.FirstName) != "" {
		guardianPerson := models.Person{
			ID:               uuid.New(),
			FirstName:        strings.TrimSpace(req.Guardian.FirstName),
			FatherName:       req.Guardian.FatherName,
			LastName:         strings.TrimSpace(req.Guardian.LastName),
			Gender:           "male", // Default or derived
			NationalIDNumber: req.Guardian.NationalIDNumber,
		}
		if err := s.db.WithContext(ctx).Create(&guardianPerson).Error; err == nil {
			if req.Guardian.Phone != "" {
				gComm := models.CommunicationChannel{
					ID:           uuid.New(),
					PersonID:     guardianPerson.ID,
					ChannelType:  "phone",
					ChannelValue: strings.TrimSpace(req.Guardian.Phone),
					IsPrimary:    true,
				}
				_ = s.db.WithContext(ctx).Create(&gComm)
			}

			// Create tenant-specific GuardianProfile with unique easy AccessCode for parent app
			guardianAccessCode := GenerateRandomCode("GRD")
			guardianProfile := models.GuardianProfile{
				ID:         uuid.New(),
				TenantID:   tenantID,
				PersonID:   guardianPerson.ID,
				AccessCode: guardianAccessCode,
				Occupation: req.Guardian.Occupation,
			}
			_ = s.db.WithContext(ctx).Create(&guardianProfile)

			relType := req.Guardian.RelationshipType
			if relType == "" {
				relType = "father"
			}

			rel := models.GuardianStudentRelation{
				ID:                       uuid.New(),
				TenantID:                 tenantID,
				GuardianPersonID:         guardianPerson.ID,
				StudentProfileID:         profile.ID,
				RelationshipType:         relType,
				IsPrimary:                true,
				CanViewGrades:            true,
				CanViewAttendance:        true,
				CanReceiveNotifications:  true,
				CanPickupStudent:         true,
				IsFinanciallyResponsible: true,
			}
			_ = s.db.WithContext(ctx).Create(&rel)
		}
	}

	// Resolve Target Section: from class_section_id, section_id, or first section of study_grade_id / grade_id
	targetSectionID := req.ClassSectionID
	if targetSectionID == nil || *targetSectionID == uuid.Nil {
		targetSectionID = req.SectionID
	}

	if targetSectionID == nil || *targetSectionID == uuid.Nil {
		targetGradeID := req.StudyGradeID
		if targetGradeID == nil || *targetGradeID == uuid.Nil {
			targetGradeID = req.GradeID
		}
		if targetGradeID != nil && *targetGradeID != uuid.Nil {
			var firstSec models.ClassSection
			if errG := s.db.WithContext(ctx).
				Where("tenant_id = ? AND study_grade_id = ?", tenantID, *targetGradeID).
				Order("name ASC").
				First(&firstSec).Error; errG == nil {
				targetSectionID = &firstSec.ID
			}
		}
	}

	// Fallback to tenant's first section if none specified
	if targetSectionID == nil || *targetSectionID == uuid.Nil {
		var defaultSec models.ClassSection
		if errD := s.db.WithContext(ctx).
			Where("tenant_id = ?", tenantID).
			Order("created_at ASC").
			First(&defaultSec).Error; errD == nil {
			targetSectionID = &defaultSec.ID
		}
	}

	// Enroll student automatically into active academic term
	if targetSectionID != nil && *targetSectionID != uuid.Nil {
		var activeTerm models.AcademicTerm
		err := s.db.WithContext(ctx).
			Where("tenant_id = ? AND is_active = ?", tenantID, true).
			Order("created_at DESC").
			First(&activeTerm).Error
		if err != nil {
			// Fallback to any term for the tenant
			err = s.db.WithContext(ctx).
				Where("tenant_id = ?", tenantID).
				Order("created_at DESC").
				First(&activeTerm).Error
		}
		if err == nil {
			enrollment := models.AcademicEnrollment{
				ID:               uuid.New(),
				TenantID:         tenantID,
				StudentProfileID: profile.ID,
				AcademicTermID:   activeTerm.ID,
				ClassSectionID:   targetSectionID,
				StudyCohortID:    req.StudyCohortID,
				EnrollmentDate:   time.Now(),
				EnrollmentType:   "standard",
				Status:           "active",
			}
			_ = s.db.WithContext(ctx).Create(&enrollment)
		}
	}

	_ = s.db.WithContext(ctx).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("Guardians.GuardianPerson").
		Preload("Guardians.GuardianPerson.CommunicationChannels").
		First(profile, profile.ID)

	return profile, nil
}

// UpdateStudentProfile updates an existing student profile, personal details, contact channel, and academic section.
func (s *AcademicService) UpdateStudentProfile(ctx context.Context, tenantID uuid.UUID, studentID uuid.UUID, req UpdateStudentRequest) (*models.StudentProfile, error) {
	var profile models.StudentProfile
	if err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", studentID, tenantID).
		Preload("Person").
		First(&profile).Error; err != nil {
		return nil, fmt.Errorf("student profile not found: %w", err)
	}

	// Update Person details
	personUpdates := map[string]interface{}{}
	if req.FirstName != "" {
		personUpdates["first_name"] = strings.TrimSpace(req.FirstName)
	}
	if req.LastName != "" {
		personUpdates["last_name"] = strings.TrimSpace(req.LastName)
	}
	if req.FatherName != nil {
		personUpdates["father_name"] = req.FatherName
	}
	if req.GrandfatherName != nil {
		personUpdates["grandfather_name"] = req.GrandfatherName
	}
	if req.Gender != "" {
		personUpdates["gender"] = req.Gender
	}
	if req.DateOfBirth != nil {
		personUpdates["date_of_birth"] = req.DateOfBirth
	}
	if req.PlaceOfBirth != nil {
		personUpdates["place_of_birth"] = req.PlaceOfBirth
	}
	if req.BloodType != nil {
		personUpdates["blood_type"] = req.BloodType
	}
	if req.NationalIDNumber != nil {
		personUpdates["national_id_number"] = req.NationalIDNumber
	}
	if req.MotherName != nil {
		personUpdates["mother_name"] = req.MotherName
	}
	if req.MotherFatherName != nil {
		personUpdates["mother_father_name"] = req.MotherFatherName
	}
	if req.Governorate != nil {
		personUpdates["governorate"] = req.Governorate
	}
	if req.CityDistrict != nil {
		personUpdates["city_district"] = req.CityDistrict
	}
	if req.Neighborhood != nil {
		personUpdates["neighborhood"] = req.Neighborhood
	}
	if req.StreetAlley != nil {
		personUpdates["street_alley"] = req.StreetAlley
	}
	if req.HouseNumber != nil {
		personUpdates["house_number"] = req.HouseNumber
	}
	if req.NearestLandmark != nil {
		personUpdates["nearest_landmark"] = req.NearestLandmark
	}

	if len(personUpdates) > 0 {
		if err := s.db.WithContext(ctx).Model(&models.Person{}).Where("id = ?", profile.PersonID).Updates(personUpdates).Error; err != nil {
			return nil, fmt.Errorf("failed to update person: %w", err)
		}
	}

	// Update phone in communication channels
	if req.Phone != nil && strings.TrimSpace(*req.Phone) != "" {
		var comm models.CommunicationChannel
		if errC := s.db.WithContext(ctx).Where("person_id = ? AND channel_type = 'phone'", profile.PersonID).First(&comm).Error; errC == nil {
			s.db.WithContext(ctx).Model(&comm).Update("channel_value", strings.TrimSpace(*req.Phone))
		} else {
			newComm := models.CommunicationChannel{
				ID:           uuid.New(),
				PersonID:     profile.PersonID,
				ChannelType:  "phone",
				ChannelValue: strings.TrimSpace(*req.Phone),
				IsPrimary:    true,
				IsVerified:   false,
			}
			_ = s.db.WithContext(ctx).Create(&newComm)
		}
	}

	// Update StudentProfile fields
	profileUpdates := map[string]interface{}{}
	if req.GeneralRegisterNumber != nil {
		profileUpdates["general_register_number"] = req.GeneralRegisterNumber
	}
	if req.PreviousSchool != nil {
		profileUpdates["previous_school"] = req.PreviousSchool
	}
	if req.GraduationDocNumber != nil {
		profileUpdates["graduation_doc_number"] = req.GraduationDocNumber
	}
	if req.IdentityDocType != nil {
		profileUpdates["identity_doc_type"] = req.IdentityDocType
	}
	if req.CivilVolume != nil {
		profileUpdates["civil_volume"] = req.CivilVolume
	}
	if req.CivilPage != nil {
		profileUpdates["civil_page"] = req.CivilPage
	}
	if req.EmergencyContactName != nil {
		profileUpdates["emergency_contact_name"] = req.EmergencyContactName
	}
	if req.EmergencyContactPhone != nil {
		profileUpdates["emergency_contact_phone"] = req.EmergencyContactPhone
	}
	if req.HealthStatus != nil {
		profileUpdates["health_status"] = req.HealthStatus
	}
	if req.MedicalNotes != nil {
		profileUpdates["medical_notes"] = req.MedicalNotes
	}
	if req.EnrollmentStatus != "" {
		profileUpdates["enrollment_status"] = req.EnrollmentStatus
	}
	if req.PhotoURL != nil && *req.PhotoURL != "" {
		profileUpdates["photo_url"] = req.PhotoURL
	}
	if req.IDCardFrontURL != nil && *req.IDCardFrontURL != "" {
		profileUpdates["id_card_front_url"] = req.IDCardFrontURL
	}
	if req.IDCardBackURL != nil && *req.IDCardBackURL != "" {
		profileUpdates["id_card_back_url"] = req.IDCardBackURL
	}
	if req.GuardianIDFrontURL != nil && *req.GuardianIDFrontURL != "" {
		profileUpdates["guardian_id_front_url"] = req.GuardianIDFrontURL
	}
	if req.GuardianIDBackURL != nil && *req.GuardianIDBackURL != "" {
		profileUpdates["guardian_id_back_url"] = req.GuardianIDBackURL
	}

	if len(profileUpdates) > 0 {
		if err := s.db.WithContext(ctx).Model(&models.StudentProfile{}).Where("id = ?", profile.ID).Updates(profileUpdates).Error; err != nil {
			return nil, fmt.Errorf("failed to update student profile: %w", err)
		}
	}

	// Handle section change or new enrollment
	targetSectionID := req.ClassSectionID
	if targetSectionID == nil || *targetSectionID == uuid.Nil {
		targetSectionID = req.SectionID
	}
	if targetSectionID == nil || *targetSectionID == uuid.Nil {
		targetGradeID := req.StudyGradeID
		if targetGradeID == nil || *targetGradeID == uuid.Nil {
			targetGradeID = req.GradeID
		}
		if targetGradeID != nil && *targetGradeID != uuid.Nil {
			var firstSec models.ClassSection
			if errG := s.db.WithContext(ctx).
				Where("tenant_id = ? AND study_grade_id = ?", tenantID, *targetGradeID).
				Order("name ASC").
				First(&firstSec).Error; errG == nil {
				targetSectionID = &firstSec.ID
			}
		}
	}

	if targetSectionID != nil && *targetSectionID != uuid.Nil {
		var existingEnrollment models.AcademicEnrollment
		if errEn := s.db.WithContext(ctx).
			Where("student_profile_id = ? AND tenant_id = ?", profile.ID, tenantID).
			Order("created_at DESC").
			First(&existingEnrollment).Error; errEn == nil {
			// Update existing enrollment with new section
			_ = s.db.WithContext(ctx).Model(&existingEnrollment).Update("class_section_id", targetSectionID)
		} else {
			// Create enrollment if student didn't have one
			var activeTerm models.AcademicTerm
			_ = s.db.WithContext(ctx).Where("tenant_id = ?", tenantID).Order("is_active DESC, created_at DESC").First(&activeTerm).Error
			newEn := models.AcademicEnrollment{
				ID:               uuid.New(),
				TenantID:         tenantID,
				StudentProfileID: profile.ID,
				AcademicTermID:   activeTerm.ID,
				ClassSectionID:   targetSectionID,
				EnrollmentDate:   time.Now(),
				EnrollmentType:   "standard",
				Status:           "active",
			}
			_ = s.db.WithContext(ctx).Create(&newEn)
		}
	}

	// Reload updated profile
	var updated models.StudentProfile
	_ = s.db.WithContext(ctx).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("Guardians.GuardianPerson").
		Preload("Guardians.GuardianPerson.CommunicationChannels").
		First(&updated, profile.ID)

	return &updated, nil
}

// LinkGuardian links an identified Person as guardian to the student's profile with strict ownership verification.
func (s *AcademicService) LinkGuardian(ctx context.Context, tenantID, studentProfileID uuid.UUID, req LinkGuardianRequest) (*models.GuardianStudentRelation, error) {
	// 1. Verify student profile belongs to this tenant
	var student models.StudentProfile
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, studentProfileID).First(&student).Error; err != nil {
		return nil, ErrStudentNotFound
	}

	// 2. Verify guardian person exists
	var guardian models.Person
	if err := s.db.WithContext(ctx).Where("id = ?", req.GuardianPersonID).First(&guardian).Error; err != nil {
		return nil, ErrGuardianNotFound
	}

	rel := &models.GuardianStudentRelation{
		ID:                       uuid.New(),
		TenantID:                 tenantID,
		GuardianPersonID:         req.GuardianPersonID,
		StudentProfileID:         studentProfileID,
		RelationshipType:         req.RelationshipType,
		IsPrimary:                req.IsPrimary,
		CanViewGrades:            req.CanViewGrades,
		CanViewAttendance:        req.CanViewAttendance,
		CanReceiveNotifications:  req.CanReceiveNotifications,
		CanPickupStudent:         req.CanPickupStudent,
		IsFinanciallyResponsible: req.IsFinanciallyResponsible,
	}

	if err := s.db.WithContext(ctx).Create(rel).Error; err != nil {
		return nil, fmt.Errorf("failed to link guardian: %w", err)
	}

	return rel, nil
}

// EnrollStudent registers a student in a specific term after verifying tenant ownership of student, term, section, and cohort.
func (s *AcademicService) EnrollStudent(ctx context.Context, tenantID, studentProfileID, termID uuid.UUID, sectionID, cohortID *uuid.UUID) (*models.AcademicEnrollment, error) {
	// 1. Verify student profile belongs to this tenant
	var student models.StudentProfile
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, studentProfileID).First(&student).Error; err != nil {
		return nil, ErrStudentNotFound
	}

	// 2. Verify academic term belongs to this tenant
	var term models.AcademicTerm
	if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, termID).First(&term).Error; err != nil {
		return nil, ErrTermNotFound
	}

	// 3. Verify cohort belongs to this tenant if provided
	if cohortID != nil {
		var cohort models.StudyCohort
		if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, *cohortID).First(&cohort).Error; err != nil {
			return nil, ErrCohortNotFound
		}
	}

	// 4. Verify duplicate active enrollment
	var count int64
	s.db.WithContext(ctx).Model(&models.AcademicEnrollment{}).
		Where("tenant_id = ? AND student_profile_id = ? AND academic_term_id = ? AND status = 'active'", tenantID, studentProfileID, termID).
		Count(&count)
	if count > 0 {
		return nil, ErrInvalidEnrollment
	}

	// 5. Validate section ownership and capacity if section is provided
	if sectionID != nil {
		var section models.ClassSection
		if err := s.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, *sectionID).First(&section).Error; err != nil {
			return nil, ErrSectionNotFound
		}

		var enrolledCount int64
		s.db.WithContext(ctx).Model(&models.AcademicEnrollment{}).
			Where("tenant_id = ? AND class_section_id = ? AND status = 'active'", tenantID, *sectionID).
			Count(&enrolledCount)

		if int(enrolledCount) >= section.Capacity {
			return nil, ErrSectionFull
		}
	}

	enrollment := &models.AcademicEnrollment{
		ID:               uuid.New(),
		TenantID:         tenantID,
		StudentProfileID: studentProfileID,
		AcademicTermID:   termID,
		ClassSectionID:   sectionID,
		StudyCohortID:    cohortID,
		EnrollmentDate:   time.Now(),
		EnrollmentType:   "standard",
		Status:           "active",
	}

	if err := s.db.WithContext(ctx).Create(enrollment).Error; err != nil {
		return nil, fmt.Errorf("failed to enroll student: %w", err)
	}

	_ = s.db.WithContext(ctx).Model(&models.StudentProfile{}).
		Where("tenant_id = ? AND id = ?", tenantID, studentProfileID).
		Update("enrollment_status", "active")

	return enrollment, nil
}

// TransferSection transfers a student to a new section, verifying section ownership and recording history.
func (s *AcademicService) TransferSection(ctx context.Context, tenantID, enrollmentID, newSectionID, changedBy uuid.UUID, reason string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var enrollment models.AcademicEnrollment
		if err := tx.Where("tenant_id = ? AND id = ?", tenantID, enrollmentID).First(&enrollment).Error; err != nil {
			return ErrEnrollmentNotFound
		}

		// Verify target section belongs to this tenant and check capacity
		var newSection models.ClassSection
		if err := tx.Where("tenant_id = ? AND id = ?", tenantID, newSectionID).First(&newSection).Error; err != nil {
			return ErrSectionNotFound
		}

		var enrolledCount int64
		tx.Model(&models.AcademicEnrollment{}).
			Where("tenant_id = ? AND class_section_id = ? AND status = 'active'", tenantID, newSectionID).
			Count(&enrolledCount)

		if int(enrolledCount) >= newSection.Capacity {
			return ErrSectionFull
		}

		// Record status transition
		history := models.EnrollmentStatusHistory{
			ID:             uuid.New(),
			TenantID:       tenantID,
			EnrollmentID:   enrollmentID,
			PreviousStatus: enrollment.Status,
			NewStatus:      "transferred",
			Reason:         reason,
			ChangedBy:      changedBy,
			CreatedAt:      time.Now(),
		}
		if err := tx.Create(&history).Error; err != nil {
			return fmt.Errorf("failed to record transfer history: %w", err)
		}

		// Update to new section
		if err := tx.Model(&enrollment).Updates(map[string]interface{}{
			"class_section_id": newSectionID,
			"updated_at":       time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("failed to update enrollment section: %w", err)
		}

		return nil
	})
}

// WithdrawStudent records a student's withdrawal while keeping historical traces intact.
func (s *AcademicService) WithdrawStudent(ctx context.Context, tenantID, enrollmentID, changedBy uuid.UUID, reason string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var enrollment models.AcademicEnrollment
		if err := tx.Where("tenant_id = ? AND id = ?", tenantID, enrollmentID).First(&enrollment).Error; err != nil {
			return ErrEnrollmentNotFound
		}

		history := models.EnrollmentStatusHistory{
			ID:             uuid.New(),
			TenantID:       tenantID,
			EnrollmentID:   enrollmentID,
			PreviousStatus: enrollment.Status,
			NewStatus:      "withdrawn",
			Reason:         reason,
			ChangedBy:      changedBy,
			CreatedAt:      time.Now(),
		}
		if err := tx.Create(&history).Error; err != nil {
			return fmt.Errorf("failed to record withdrawal history: %w", err)
		}

		if err := tx.Model(&enrollment).Update("status", "withdrawn").Error; err != nil {
			return fmt.Errorf("failed to update enrollment status: %w", err)
		}

		if err := tx.Model(&models.StudentProfile{}).
			Where("tenant_id = ? AND id = ?", tenantID, enrollment.StudentProfileID).
			Update("enrollment_status", "withdrawn").Error; err != nil {
			return fmt.Errorf("failed to update profile status: %w", err)
		}

		return nil
	})
}
