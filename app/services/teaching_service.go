package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrTeacherNotFound         = errors.New("teacher profile not found or inactive in this institution")
	ErrCurriculumNotFound      = errors.New("curriculum not found in this institution")
	ErrAssignmentNotFound      = errors.New("teacher assignment not found in this institution")
	ErrSubstituteNotFound      = errors.New("substitute teacher profile not found or inactive")
	ErrTeacherScheduleConflict = errors.New("schedule conflict: teacher already has an active class slot during this time")
	ErrRoomScheduleConflict    = errors.New("schedule conflict: room is already booked for another session during this time")
	ErrDuplicatePayoutAccrual  = errors.New("a payout accrual already exists for this class session")
)

type TeachingService struct {
	db *gorm.DB
}

func NewTeachingService(db *gorm.DB) *TeachingService {
	return &TeachingService{db: db}
}

// CreateTeacherProfileRequest holds input payload to establish a teacher record.
type CreateTeacherProfileRequest struct {
	PersonID       *uuid.UUID       `json:"person_id,omitempty"`
	FirstName      string           `json:"first_name"`
	FatherName     *string          `json:"father_name,omitempty"`
	LastName       string           `json:"last_name"`
	Gender         string           `json:"gender"`
	StaffNumber    string           `json:"staff_number"`
	Specialization *string          `json:"specialization,omitempty"`
	EmploymentType string           `json:"employment_type"` // full_time, part_time, per_session, contractor
	HourlyRate     *decimal.Decimal `json:"hourly_rate,omitempty"`
	MonthlySalary  *decimal.Decimal `json:"monthly_salary,omitempty"`
	StaffID        *uuid.UUID       `json:"staff_id,omitempty"`
	Phone          *string          `json:"phone,omitempty"`
	Email          *string          `json:"email,omitempty"`
}

func (s *TeachingService) CreateTeacherProfile(ctx context.Context, tenantID uuid.UUID, req CreateTeacherProfileRequest) (*models.TeacherProfile, error) {
	staffNum := strings.TrimSpace(req.StaffNumber)
	if staffNum == "" {
		return nil, errors.New("staff_number is required")
	}

	var targetPersonID uuid.UUID

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Resolve or Create Person
		if req.PersonID != nil && *req.PersonID != uuid.Nil {
			var person models.Person
			if err := tx.First(&person, "id = ?", *req.PersonID).Error; err != nil {
				return fmt.Errorf("person with id %s does not exist: %w", req.PersonID.String(), err)
			}
			targetPersonID = person.ID
		} else {
			if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" {
				return errors.New("first name and last name are required when person_id is omitted")
			}
			gender := strings.ToLower(strings.TrimSpace(req.Gender))
			if gender == "" {
				gender = "unspecified"
			}

			newPerson := models.Person{
				FirstName:  strings.TrimSpace(req.FirstName),
				FatherName: req.FatherName,
				LastName:   strings.TrimSpace(req.LastName),
				Gender:     gender,
			}
			if err := tx.Create(&newPerson).Error; err != nil {
				return fmt.Errorf("failed to create central person: %w", err)
			}
			targetPersonID = newPerson.ID

			// Persist primary communication channels if provided
			if req.Phone != nil && strings.TrimSpace(*req.Phone) != "" {
				phoneChan := models.CommunicationChannel{
					PersonID:     targetPersonID,
					ChannelType:  "phone",
					ChannelValue: strings.TrimSpace(*req.Phone),
					IsPrimary:    true,
				}
				if err := tx.Create(&phoneChan).Error; err != nil {
					return fmt.Errorf("failed to save phone channel: %w", err)
				}
			}
			if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
				emailChan := models.CommunicationChannel{
					PersonID:     targetPersonID,
					ChannelType:  "email",
					ChannelValue: strings.TrimSpace(*req.Email),
					IsPrimary:    true,
				}
				if err := tx.Create(&emailChan).Error; err != nil {
					return fmt.Errorf("failed to save email channel: %w", err)
				}
			}
		}

		// 2. Ensure Tenant Membership
		var membership models.TenantMembership
		err := tx.Where("tenant_id = ? AND person_id = ?", tenantID, targetPersonID).First(&membership).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			membership = models.TenantMembership{
				TenantID: tenantID,
				PersonID: targetPersonID,
				Status:   "active",
				JoinedAt: time.Now(),
			}
			if err := tx.Create(&membership).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		// 3. Verify StaffProfile if linked
		if req.StaffID != nil && *req.StaffID != uuid.Nil {
			var staff models.StaffProfile
			if err := tx.First(&staff, "id = ? AND tenant_id = ?", *req.StaffID, tenantID).Error; err != nil {
				return errors.New("linked staff profile not found in this institution")
			}
		}

		// 4. Create Teacher Profile
		empType := req.EmploymentType
		if empType == "" {
			empType = "full_time"
		}

		teacher := models.TeacherProfile{
			TenantID:       tenantID,
			PersonID:       targetPersonID,
			StaffNumber:    staffNum,
			AccessCode:     GenerateRandomCode("TCH"),
			Specialization: req.Specialization,
			EmploymentType: empType,
			HourlyRate:     req.HourlyRate,
			MonthlySalary:  req.MonthlySalary,
			Status:         "active",
			StaffProfileID: req.StaffID,
		}

		if err := tx.Create(&teacher).Error; err != nil {
			if strings.Contains(err.Error(), "uq_teacher_tenant_person") {
				return errors.New("this person already has a teacher profile in this institution")
			}
			if strings.Contains(err.Error(), "uq_teacher_tenant_number") {
				return errors.New("teacher staff number already exists in this institution")
			}
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	var created models.TeacherProfile
	if err := s.db.WithContext(ctx).
		Preload("Person").
		Preload("Person.CommunicationChannels").
		Preload("StaffProfile").
		First(&created, "tenant_id = ? AND staff_number = ?", tenantID, staffNum).Error; err != nil {
		return nil, err
	}

	return &created, nil
}

// AssignTeacherRequest holds input payload to assign a teacher to a curriculum and cohort/section.
type AssignTeacherRequest struct {
	TeacherProfileID    uuid.UUID  `json:"teacher_profile_id"`
	AdoptedCurriculumID uuid.UUID  `json:"adopted_curriculum_id"`
	ClassSectionID      *uuid.UUID `json:"class_section_id,omitempty"`
	StudyCohortID       *uuid.UUID `json:"study_cohort_id,omitempty"`
	IsLeadTeacher       bool       `json:"is_lead_teacher"`
	StartDate           time.Time  `json:"start_date"`
	EndDate             *time.Time `json:"end_date,omitempty"`
}

func (s *TeachingService) AssignTeacher(ctx context.Context, tenantID uuid.UUID, req AssignTeacherRequest) (*models.TeacherAssignment, error) {
	// 1. Verify Teacher exists and is active in tenant
	var teacher models.TeacherProfile
	if err := s.db.WithContext(ctx).First(&teacher, "id = ? AND tenant_id = ? AND status = 'active'", req.TeacherProfileID, tenantID).Error; err != nil {
		return nil, ErrTeacherNotFound
	}

	// 2. Verify Adopted Curriculum exists in tenant
	var curr models.AdoptedCurriculum
	if err := s.db.WithContext(ctx).First(&curr, "id = ? AND tenant_id = ?", req.AdoptedCurriculumID, tenantID).Error; err != nil {
		return nil, ErrCurriculumNotFound
	}

	if req.StartDate.IsZero() {
		req.StartDate = time.Now()
	}

	assignment := models.TeacherAssignment{
		TenantID:            tenantID,
		TeacherProfileID:    req.TeacherProfileID,
		AdoptedCurriculumID: req.AdoptedCurriculumID,
		ClassSectionID:      req.ClassSectionID,
		StudyCohortID:       req.StudyCohortID,
		IsLeadTeacher:       req.IsLeadTeacher,
		StartDate:           req.StartDate,
		EndDate:             req.EndDate,
		Status:              "active",
	}

	if err := s.db.WithContext(ctx).Create(&assignment).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).
		Preload("TeacherProfile.Person").
		Preload("AdoptedCurriculum.CurriculumEdition.Definition.Subject").
		First(&assignment, "id = ?", assignment.ID).Error; err != nil {
		return nil, err
	}

	return &assignment, nil
}

// CreatePlannedSlotRequest holds parameters for recurring weekly timetable slot.
type CreatePlannedSlotRequest struct {
	DayOfWeek  int     `json:"day_of_week"` // 0=Sunday, 1=Monday...
	StartTime  string  `json:"start_time"`  // "08:30"
	EndTime    string  `json:"end_time"`    // "09:15"
	RoomNumber *string `json:"room_number,omitempty"`
}

// CreatePlannedSlot verifies schedule conflicts before scheduling.
func (s *TeachingService) CreatePlannedSlot(ctx context.Context, tenantID, assignmentID uuid.UUID, req CreatePlannedSlotRequest) (*models.PlannedScheduleSlot, error) {
	startTime := strings.TrimSpace(req.StartTime)
	endTime := strings.TrimSpace(req.EndTime)
	if startTime == "" || endTime == "" {
		return nil, errors.New("start_time and end_time are required (format HH:MM)")
	}
	if startTime >= endTime {
		return nil, errors.New("start_time must be strictly before end_time")
	}

	// 1. Verify Assignment belongs to Tenant
	var assignment models.TeacherAssignment
	if err := s.db.WithContext(ctx).First(&assignment, "id = ? AND tenant_id = ? AND status = 'active'", assignmentID, tenantID).Error; err != nil {
		return nil, ErrAssignmentNotFound
	}

	// 2. Conflict Detection Engine:
	// A. Check if the same teacher has an overlapping active slot on the same day_of_week in this tenant
	var teacherConflictCount int64
	err := s.db.WithContext(ctx).Table("planned_schedule_slots").
		Joins("JOIN teacher_assignments ON teacher_assignments.id = planned_schedule_slots.teacher_assignment_id").
		Where("planned_schedule_slots.tenant_id = ? AND teacher_assignments.teacher_profile_id = ? AND planned_schedule_slots.day_of_week = ? AND planned_schedule_slots.is_active = true",
			tenantID, assignment.TeacherProfileID, req.DayOfWeek).
		Where("planned_schedule_slots.start_time < ? AND planned_schedule_slots.end_time > ?", endTime, startTime).
		Count(&teacherConflictCount).Error
	if err != nil {
		return nil, err
	}
	if teacherConflictCount > 0 {
		return nil, ErrTeacherScheduleConflict
	}

	// B. Check if room is booked for another active slot on the same day during overlapping time
	if req.RoomNumber != nil && strings.TrimSpace(*req.RoomNumber) != "" {
		room := strings.TrimSpace(*req.RoomNumber)
		var roomConflictCount int64
		err := s.db.WithContext(ctx).Table("planned_schedule_slots").
			Where("tenant_id = ? AND room_number = ? AND day_of_week = ? AND is_active = true",
				tenantID, room, req.DayOfWeek).
			Where("start_time < ? AND end_time > ?", endTime, startTime).
			Count(&roomConflictCount).Error
		if err != nil {
			return nil, err
		}
		if roomConflictCount > 0 {
			return nil, ErrRoomScheduleConflict
		}
	}

	// 3. Create Slot
	slot := models.PlannedScheduleSlot{
		TenantID:            tenantID,
		TeacherAssignmentID: assignmentID,
		DayOfWeek:           req.DayOfWeek,
		StartTime:           startTime,
		EndTime:             endTime,
		RoomNumber:          req.RoomNumber,
		IsActive:            true,
	}

	if err := s.db.WithContext(ctx).Create(&slot).Error; err != nil {
		return nil, err
	}

	return &slot, nil
}

// RecordActualSessionRequest records class session execution and triggers teacher payout accrual.
type RecordActualSessionRequest struct {
	PlannedScheduleSlotID *uuid.UUID       `json:"planned_schedule_slot_id,omitempty"`
	TeacherAssignmentID   uuid.UUID        `json:"teacher_assignment_id"`
	SubstituteTeacherID   *uuid.UUID       `json:"substitute_teacher_id,omitempty"`
	SessionDate           time.Time        `json:"session_date"`
	ActualStartTime       time.Time        `json:"actual_start_time"`
	ActualEndTime         time.Time        `json:"actual_end_time"`
	Status                string           `json:"status"` // completed, cancelled, rescheduled_makeup
	LessonTopicDelivered  *string          `json:"lesson_topic_delivered,omitempty"`
	CancellationReason    *string          `json:"cancellation_reason,omitempty"`
	IsPayable             bool             `json:"is_payable"`
	OverridePayoutAmount  *decimal.Decimal `json:"override_payout_amount,omitempty"`
}

func (s *TeachingService) RecordActualSession(ctx context.Context, tenantID uuid.UUID, req RecordActualSessionRequest) (*models.ActualClassSession, *models.TeacherPayoutAccrual, error) {
	if req.SessionDate.IsZero() {
		req.SessionDate = time.Now()
	}
	if req.ActualStartTime.IsZero() {
		req.ActualStartTime = time.Now()
	}
	if req.ActualEndTime.IsZero() {
		req.ActualEndTime = req.ActualStartTime.Add(45 * time.Minute)
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "completed"
	}

	var session models.ActualClassSession
	var accrual *models.TeacherPayoutAccrual

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Verify Assignment belongs to Tenant
		var assignment models.TeacherAssignment
		if err := tx.Preload("TeacherProfile").
			First(&assignment, "id = ? AND tenant_id = ?", req.TeacherAssignmentID, tenantID).Error; err != nil {
			return ErrAssignmentNotFound
		}

		effectiveTeacherID := assignment.TeacherProfileID

		// 2. Handle Substitute Teacher
		if req.SubstituteTeacherID != nil && *req.SubstituteTeacherID != uuid.Nil {
			var substitute models.TeacherProfile
			if err := tx.First(&substitute, "id = ? AND tenant_id = ? AND status = 'active'", *req.SubstituteTeacherID, tenantID).Error; err != nil {
				return ErrSubstituteNotFound
			}
			effectiveTeacherID = substitute.ID
		}

		// 3. Insert Actual Class Session
		session = models.ActualClassSession{
			TenantID:              tenantID,
			PlannedScheduleSlotID: req.PlannedScheduleSlotID,
			TeacherAssignmentID:   req.TeacherAssignmentID,
			SubstituteTeacherID:   req.SubstituteTeacherID,
			SessionDate:           req.SessionDate,
			ActualStartTime:       req.ActualStartTime,
			ActualEndTime:         req.ActualEndTime,
			Status:                status,
			CancellationReason:    req.CancellationReason,
			LessonTopicDelivered:  req.LessonTopicDelivered,
		}

		if err := tx.Create(&session).Error; err != nil {
			return err
		}

		// 4. Financial Accrual Engine (if session is completed and payable)
		if status == "completed" && req.IsPayable {
			// Check if accrual already exists for this session to prevent double-counting
			var existingCount int64
			if err := tx.Model(&models.TeacherPayoutAccrual{}).
				Where("tenant_id = ? AND actual_class_session_id = ? AND status != 'void'", tenantID, session.ID).
				Count(&existingCount).Error; err != nil {
				return err
			}
			if existingCount > 0 {
				return ErrDuplicatePayoutAccrual
			}

			// Determine compensation rate
			var calculatedAmount decimal.Decimal
			calcModel := "per_session"

			if req.OverridePayoutAmount != nil && req.OverridePayoutAmount.IsPositive() {
				calculatedAmount = *req.OverridePayoutAmount
			} else {
				// Try to get default session rate from active contract
				var contract models.EmploymentContract
				err := tx.Where("tenant_id = ? AND staff_profile_id = (SELECT staff_profile_id FROM teacher_profiles WHERE id = ?) AND status = 'active'",
					tenantID, effectiveTeacherID).First(&contract).Error
				if err == nil && contract.DefaultSessionRate != nil && contract.DefaultSessionRate.IsPositive() {
					calculatedAmount = *contract.DefaultSessionRate
				} else {
					// Fallback to teacher profile hourly_rate or default
					var teacherProfile models.TeacherProfile
					if err := tx.First(&teacherProfile, "id = ?", effectiveTeacherID).Error; err == nil && teacherProfile.HourlyRate != nil {
						calculatedAmount = *teacherProfile.HourlyRate
					} else {
						calculatedAmount = decimal.NewFromInt(25000) // Fallback 25,000 IQD standard
					}
				}
			}

			newAccrual := models.TeacherPayoutAccrual{
				TenantID:             tenantID,
				TeacherProfileID:     effectiveTeacherID,
				ActualClassSessionID: &session.ID,
				PayoutCalcModel:      calcModel,
				CalculatedAmount:     calculatedAmount,
				Currency:             "IQD",
				AccrualDate:          req.SessionDate,
				Status:               "pending",
			}

			if err := tx.Create(&newAccrual).Error; err != nil {
				return fmt.Errorf("failed to create payout accrual: %w", err)
			}
			accrual = &newAccrual
		}

		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	return &session, accrual, nil
}
