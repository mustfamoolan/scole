package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"institute/app/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSelfManagerCycle         = errors.New("a staff member cannot be their own manager or create a reporting cycle")
	ErrManagerNotInTenant       = errors.New("direct manager must belong to the same institution")
	ErrStaffNotFound            = errors.New("staff profile not found")
	ErrPositionNotFound         = errors.New("position not found or inactive")
	ErrDepartmentNotFound       = errors.New("department not found or inactive")
	ErrDuplicateStaffNumber     = errors.New("staff number already exists in this institution")
	ErrDuplicatePersonInStaff   = errors.New("this person already has an active staff profile in this institution")
)

type WorkforceService struct {
	db *gorm.DB
}

func NewWorkforceService(db *gorm.DB) *WorkforceService {
	return &WorkforceService{db: db}
}

// CreateDepartmentRequest holds input payload for departmental creation.
type CreateDepartmentRequest struct {
	Code           string     `json:"code"`
	Name           string     `json:"name"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
	ManagerStaffID *uuid.UUID `json:"manager_staff_id,omitempty"`
}

func (s *WorkforceService) CreateDepartment(ctx context.Context, tenantID uuid.UUID, req CreateDepartmentRequest) (*models.Department, error) {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return nil, errors.New("department code and name are required")
	}

	dept := models.Department{
		TenantID:       tenantID,
		Code:           code,
		Name:           name,
		BranchID:       req.BranchID,
		ManagerStaffID: req.ManagerStaffID,
		IsActive:       true,
	}

	if err := s.db.WithContext(ctx).Create(&dept).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "uq_dept_tenant_code") {
			return nil, fmt.Errorf("department with code '%s' already exists in this institution", code)
		}
		return nil, err
	}

	return &dept, nil
}

// CreatePositionRequest holds input payload for position creation.
type CreatePositionRequest struct {
	Code         string `json:"code"`
	Title        string `json:"title"`
	IsManagerial bool   `json:"is_managerial"`
}

func (s *WorkforceService) CreatePosition(ctx context.Context, tenantID uuid.UUID, req CreatePositionRequest) (*models.Position, error) {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	title := strings.TrimSpace(req.Title)
	if code == "" || title == "" {
		return nil, errors.New("position code and title are required")
	}

	pos := models.Position{
		TenantID:     tenantID,
		Code:         code,
		Title:        title,
		IsManagerial: req.IsManagerial,
		IsActive:     true,
	}

	if err := s.db.WithContext(ctx).Create(&pos).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "uq_position_tenant_code") {
			return nil, fmt.Errorf("position with code '%s' already exists in this institution", code)
		}
		return nil, err
	}

	return &pos, nil
}

// CreateStaffRequest holds payload to hire a staff member.
type CreateStaffRequest struct {
	PersonID             *uuid.UUID `json:"person_id,omitempty"`
	NationalID           *string    `json:"national_id,omitempty"`
	FirstName            string     `json:"first_name"`
	FatherName           *string    `json:"father_name,omitempty"`
	GrandfatherName      *string    `json:"grandfather_name,omitempty"`
	LastName             string     `json:"last_name"`
	Gender               string     `json:"gender"`
	StaffNumber          string     `json:"staff_number"`
	HireDate             time.Time  `json:"hire_date"`
	PrimaryBranchID      *uuid.UUID `json:"primary_branch_id,omitempty"`
	DirectManagerStaffID *uuid.UUID `json:"direct_manager_staff_id,omitempty"`
}

func (s *WorkforceService) CreateStaffProfile(ctx context.Context, tenantID uuid.UUID, req CreateStaffRequest) (*models.StaffProfile, error) {
	staffNum := strings.TrimSpace(req.StaffNumber)
	if staffNum == "" {
		return nil, errors.New("staff number is required")
	}
	if req.HireDate.IsZero() {
		req.HireDate = time.Now()
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
				NationalIDNumber: req.NationalID,
				FirstName:        strings.TrimSpace(req.FirstName),
				FatherName:       req.FatherName,
				GrandfatherName:  req.GrandfatherName,
				LastName:         strings.TrimSpace(req.LastName),
				Gender:           gender,
			}
			if err := tx.Create(&newPerson).Error; err != nil {
				return fmt.Errorf("failed to create central person: %w", err)
			}
			targetPersonID = newPerson.ID
		}

		// 2. Validate Manager if provided
		if req.DirectManagerStaffID != nil && *req.DirectManagerStaffID != uuid.Nil {
			var manager models.StaffProfile
			if err := tx.First(&manager, "id = ? AND tenant_id = ?", *req.DirectManagerStaffID, tenantID).Error; err != nil {
				return ErrManagerNotInTenant
			}
		}

		// 3. Ensure Tenant Membership
		var membership models.TenantMembership
		err := tx.Where("tenant_id = ? AND person_id = ?", tenantID, targetPersonID).First(&membership).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			membership = models.TenantMembership{
				TenantID: tenantID,
				PersonID: targetPersonID,
				Status:   "active",
				JoinedAt: req.HireDate,
			}
			if err := tx.Create(&membership).Error; err != nil {
				return fmt.Errorf("failed to create tenant membership: %w", err)
			}
		} else if err != nil {
			return err
		}

		// 4. Create Staff Profile
		staff := models.StaffProfile{
			TenantID:             tenantID,
			PersonID:             targetPersonID,
			StaffNumber:          staffNum,
			EmploymentStatus:     "active",
			HireDate:             req.HireDate,
			PrimaryBranchID:      req.PrimaryBranchID,
			DirectManagerStaffID: req.DirectManagerStaffID,
		}

		if err := tx.Create(&staff).Error; err != nil {
			if strings.Contains(err.Error(), "uq_staff_tenant_person") {
				return ErrDuplicatePersonInStaff
			}
			if strings.Contains(err.Error(), "uq_staff_tenant_number") {
				return ErrDuplicateStaffNumber
			}
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	var created models.StaffProfile
	if err := s.db.WithContext(ctx).
		Preload("Person").
		Preload("DirectManager").
		First(&created, "tenant_id = ? AND staff_number = ?", tenantID, staffNum).Error; err != nil {
		return nil, err
	}

	return &created, nil
}

// AssignPositionRequest holds input payload to assign or promote a staff member into a position.
type AssignPositionRequest struct {
	PositionID     uuid.UUID  `json:"position_id"`
	DepartmentID   *uuid.UUID `json:"department_id,omitempty"`
	AssignmentType string     `json:"assignment_type"` // primary, acting, concurrent
	IsPrimary      bool       `json:"is_primary"`
	StartDate      time.Time  `json:"start_date"`
	EndDate        *time.Time `json:"end_date,omitempty"`
	Notes          *string    `json:"notes,omitempty"`
}

// AssignPosition assigns a staff member to a position, preserving historical continuity.
func (s *WorkforceService) AssignPosition(ctx context.Context, tenantID, staffProfileID uuid.UUID, req AssignPositionRequest) (*models.PositionAssignment, error) {
	if req.PositionID == uuid.Nil {
		return nil, errors.New("position_id is required")
	}
	if req.StartDate.IsZero() {
		req.StartDate = time.Now()
	}
	assignmentType := req.AssignmentType
	if assignmentType == "" {
		if req.IsPrimary {
			assignmentType = "primary"
		} else {
			assignmentType = "concurrent"
		}
	}

	var createdAssignment models.PositionAssignment

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Verify Staff exists in Tenant
		var staff models.StaffProfile
		if err := tx.First(&staff, "id = ? AND tenant_id = ?", staffProfileID, tenantID).Error; err != nil {
			return ErrStaffNotFound
		}

		// 2. Verify Position exists in Tenant
		var pos models.Position
		if err := tx.First(&pos, "id = ? AND tenant_id = ? AND is_active = true", req.PositionID, tenantID).Error; err != nil {
			return ErrPositionNotFound
		}

		// 3. Verify Department if provided
		if req.DepartmentID != nil && *req.DepartmentID != uuid.Nil {
			var dept models.Department
			if err := tx.First(&dept, "id = ? AND tenant_id = ? AND is_active = true", *req.DepartmentID, tenantID).Error; err != nil {
				return ErrDepartmentNotFound
			}
		}

		// 4. If this is a primary assignment, supersede existing active primary assignment without deleting it
		if req.IsPrimary {
			now := req.StartDate
			if err := tx.Model(&models.PositionAssignment{}).
				Where("tenant_id = ? AND staff_profile_id = ? AND is_primary = true AND status = 'active'", tenantID, staffProfileID).
				Updates(map[string]interface{}{
					"status":     "superseded",
					"end_date":   now,
					"updated_at": time.Now(),
				}).Error; err != nil {
				return fmt.Errorf("failed to archive previous primary position: %w", err)
			}
		}

		// 5. Create new PositionAssignment
		assignment := models.PositionAssignment{
			TenantID:       tenantID,
			StaffProfileID: staffProfileID,
			PositionID:     req.PositionID,
			DepartmentID:   req.DepartmentID,
			AssignmentType: assignmentType,
			IsPrimary:      req.IsPrimary,
			StartDate:      req.StartDate,
			EndDate:        req.EndDate,
			Status:         "active",
			Notes:          req.Notes,
		}

		if err := tx.Create(&assignment).Error; err != nil {
			return fmt.Errorf("failed to create position assignment: %w", err)
		}

		createdAssignment = assignment
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Preload associations
	if err := s.db.WithContext(ctx).
		Preload("Position").
		Preload("Department").
		First(&createdAssignment, "id = ?", createdAssignment.ID).Error; err != nil {
		return nil, err
	}

	return &createdAssignment, nil
}

// SetDirectManager updates the manager of a staff member while strictly validating against reporting loops.
func (s *WorkforceService) SetDirectManager(ctx context.Context, tenantID, staffProfileID uuid.UUID, managerStaffID *uuid.UUID) error {
	if managerStaffID != nil && *managerStaffID != uuid.Nil {
		if *managerStaffID == staffProfileID {
			return ErrSelfManagerCycle
		}

		// Cycle prevention: walk up the chain from managerStaffID to ensure staffProfileID is not an ancestor
		visited := make(map[uuid.UUID]bool)
		curr := *managerStaffID

		for curr != uuid.Nil {
			if curr == staffProfileID {
				return ErrSelfManagerCycle
			}
			if visited[curr] {
				break
			}
			visited[curr] = true

			var ancestor models.StaffProfile
			err := s.db.WithContext(ctx).Select("id, direct_manager_staff_id, tenant_id").
				First(&ancestor, "id = ? AND tenant_id = ?", curr, tenantID).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrManagerNotInTenant
				}
				return err
			}
			if ancestor.DirectManagerStaffID == nil {
				break
			}
			curr = *ancestor.DirectManagerStaffID
		}
	}

	return s.db.WithContext(ctx).Model(&models.StaffProfile{}).
		Where("id = ? AND tenant_id = ?", staffProfileID, tenantID).
		Update("direct_manager_staff_id", managerStaffID).Error
}

// LinkTeacherToStaff connects an existing TeacherProfile to a StaffProfile.
func (s *WorkforceService) LinkTeacherToStaff(ctx context.Context, tenantID, teacherProfileID, staffProfileID uuid.UUID) error {
	// Verify both exist and belong to the same tenant and same Person
	var teacher models.TeacherProfile
	if err := s.db.WithContext(ctx).First(&teacher, "id = ? AND tenant_id = ?", teacherProfileID, tenantID).Error; err != nil {
		return errors.New("teacher profile not found")
	}

	var staff models.StaffProfile
	if err := s.db.WithContext(ctx).First(&staff, "id = ? AND tenant_id = ?", staffProfileID, tenantID).Error; err != nil {
		return errors.New("staff profile not found")
	}

	if teacher.PersonID != staff.PersonID {
		return errors.New("cannot link teacher to a staff profile belonging to a different person")
	}

	return s.db.WithContext(ctx).Model(&models.TeacherProfile{}).
		Where("id = ? AND tenant_id = ?", teacherProfileID, tenantID).
		Update("staff_profile_id", staffProfileID).Error
}
