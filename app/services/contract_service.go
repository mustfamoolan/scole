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
	ErrContractNotFound      = errors.New("employment contract not found")
	ErrDuplicateContractNum  = errors.New("contract number already exists in this institution")
	ErrInvalidContractDates  = errors.New("end date must be after start date")
	ErrNegativeCompensation  = errors.New("compensation amount cannot be negative")
	ErrQualificationNotFound = errors.New("qualification record not found")
)

type ContractService struct {
	db *gorm.DB
}

func NewContractService(db *gorm.DB) *ContractService {
	return &ContractService{db: db}
}

// CreateContractRequest holds input payload to issue an employment contract.
type CreateContractRequest struct {
	ContractNumber     string           `json:"contract_number"`
	ContractType       string           `json:"contract_type"` // full_time, part_time, per_session, contractor
	BaseSalary         *decimal.Decimal `json:"base_salary,omitempty"`
	HourlyRate         *decimal.Decimal `json:"hourly_rate,omitempty"`
	DefaultSessionRate *decimal.Decimal `json:"default_session_rate,omitempty"`
	Currency           string           `json:"currency"`
	StartDate          time.Time        `json:"start_date"`
	EndDate            *time.Time       `json:"end_date,omitempty"`
	TermsSummary       *string          `json:"terms_summary,omitempty"`
	Status             string           `json:"status"` // active, draft
}

func (s *ContractService) createContractTx(tx *gorm.DB, tenantID, staffProfileID uuid.UUID, req CreateContractRequest) (*models.EmploymentContract, error) {
	contractNum := strings.TrimSpace(req.ContractNumber)
	if contractNum == "" {
		return nil, errors.New("contract_number is required")
	}
	if req.StartDate.IsZero() {
		req.StartDate = time.Now()
	}
	if req.EndDate != nil && req.EndDate.Before(req.StartDate) {
		return nil, ErrInvalidContractDates
	}
	if req.BaseSalary != nil && req.BaseSalary.IsNegative() {
		return nil, ErrNegativeCompensation
	}
	if req.HourlyRate != nil && req.HourlyRate.IsNegative() {
		return nil, ErrNegativeCompensation
	}
	if req.DefaultSessionRate != nil && req.DefaultSessionRate.IsNegative() {
		return nil, ErrNegativeCompensation
	}

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "IQD"
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "active"
	}

	// 1. Verify Staff exists in Tenant
	var staff models.StaffProfile
	if err := tx.First(&staff, "id = ? AND tenant_id = ?", staffProfileID, tenantID).Error; err != nil {
		return nil, ErrStaffNotFound
	}

	// 2. If new contract is active, supersede existing active contract without deleting it
	if status == "active" {
		if err := tx.Model(&models.EmploymentContract{}).
			Where("tenant_id = ? AND staff_profile_id = ? AND status = 'active'", tenantID, staffProfileID).
			Updates(map[string]interface{}{
				"status":     "superseded",
				"end_date":   req.StartDate,
				"updated_at": time.Now(),
			}).Error; err != nil {
			return nil, fmt.Errorf("failed to archive previous contract: %w", err)
		}
	}

	// 3. Create Contract
	contract := models.EmploymentContract{
		TenantID:           tenantID,
		StaffProfileID:     staffProfileID,
		ContractNumber:     contractNum,
		ContractType:       req.ContractType,
		BaseSalary:         req.BaseSalary,
		HourlyRate:         req.HourlyRate,
		DefaultSessionRate: req.DefaultSessionRate,
		Currency:           currency,
		StartDate:          req.StartDate,
		EndDate:            req.EndDate,
		Status:             status,
		TermsSummary:       req.TermsSummary,
	}

	if err := tx.Create(&contract).Error; err != nil {
		if strings.Contains(err.Error(), "uq_contract_tenant_number") {
			return nil, ErrDuplicateContractNum
		}
		return nil, fmt.Errorf("failed to create contract: %w", err)
	}

	return &contract, nil
}

// CreateContract creates a contract and supersedes existing active contracts to preserve complete history.
func (s *ContractService) CreateContract(ctx context.Context, tenantID, staffProfileID uuid.UUID, req CreateContractRequest) (*models.EmploymentContract, error) {
	var created *models.EmploymentContract
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		c, err := s.createContractTx(tx, tenantID, staffProfileID, req)
		if err != nil {
			return err
		}
		created = c
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// RenewContract transitions an existing contract to 'renewed' and issues a new active contract.
func (s *ContractService) RenewContract(ctx context.Context, tenantID, oldContractID uuid.UUID, req CreateContractRequest) (*models.EmploymentContract, error) {
	var oldContract models.EmploymentContract
	if err := s.db.WithContext(ctx).First(&oldContract, "id = ? AND tenant_id = ?", oldContractID, tenantID).Error; err != nil {
		return nil, ErrContractNotFound
	}

	var newContract *models.EmploymentContract

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Mark old contract as renewed
		if err := tx.Model(&oldContract).Updates(map[string]interface{}{
			"status":     "renewed",
			"end_date":   req.StartDate,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return err
		}

		// Create renewed contract within the same transaction tx
		created, err := s.createContractTx(tx, tenantID, oldContract.StaffProfileID, req)
		if err != nil {
			return err
		}
		newContract = created
		return nil
	})

	if err != nil {
		return nil, err
	}

	return newContract, nil
}

// TerminateContract terminates an active contract with a recorded effective date.
func (s *ContractService) TerminateContract(ctx context.Context, tenantID, contractID uuid.UUID, termDate time.Time, reason string) error {
	if termDate.IsZero() {
		termDate = time.Now()
	}

	result := s.db.WithContext(ctx).Model(&models.EmploymentContract{}).
		Where("id = ? AND tenant_id = ? AND status = 'active'", contractID, tenantID).
		Updates(map[string]interface{}{
			"status":        "terminated",
			"end_date":      termDate,
			"terms_summary": gorm.Expr("COALESCE(terms_summary || E'\n', '') || ?", "Terminated: "+reason),
			"updated_at":    time.Now(),
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrContractNotFound
	}

	return nil
}

// AddQualificationRequest holds payload for academic degrees and certificates.
type AddQualificationRequest struct {
	QualificationType string  `json:"qualification_type"`
	Title             string  `json:"title"`
	InstitutionName   string  `json:"institution_name"`
	GraduationYear    *int    `json:"graduation_year,omitempty"`
	DocumentURL       *string `json:"document_url,omitempty"`
}

func (s *ContractService) AddQualification(ctx context.Context, tenantID, staffProfileID uuid.UUID, req AddQualificationRequest) (*models.StaffQualification, error) {
	title := strings.TrimSpace(req.Title)
	instName := strings.TrimSpace(req.InstitutionName)
	if title == "" || instName == "" {
		return nil, errors.New("qualification title and institution name are required")
	}

	// Verify Staff exists
	var staff models.StaffProfile
	if err := s.db.WithContext(ctx).First(&staff, "id = ? AND tenant_id = ?", staffProfileID, tenantID).Error; err != nil {
		return nil, ErrStaffNotFound
	}

	qual := models.StaffQualification{
		TenantID:          tenantID,
		StaffProfileID:    staffProfileID,
		QualificationType: req.QualificationType,
		Title:             title,
		InstitutionName:   instName,
		GraduationYear:    req.GraduationYear,
		DocumentURL:       req.DocumentURL,
		IsVerified:        false,
	}

	if err := s.db.WithContext(ctx).Create(&qual).Error; err != nil {
		return nil, err
	}

	return &qual, nil
}

func (s *ContractService) VerifyQualification(ctx context.Context, tenantID, qualificationID, verifiedByUserID uuid.UUID) error {
	now := time.Now()
	result := s.db.WithContext(ctx).Model(&models.StaffQualification{}).
		Where("id = ? AND tenant_id = ?", qualificationID, tenantID).
		Updates(map[string]interface{}{
			"is_verified":         true,
			"verified_at":         now,
			"verified_by_user_id": verifiedByUserID,
			"updated_at":          now,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrQualificationNotFound
	}
	return nil
}

// AddStaffDocumentRequest holds payload for confidential document archives.
type AddStaffDocumentRequest struct {
	DocumentCategory string     `json:"document_category"`
	Title            string     `json:"title"`
	FileURL          string     `json:"file_url"`
	FileSizeBytes    *int64     `json:"file_size_bytes,omitempty"`
	MimeType         *string    `json:"mime_type,omitempty"`
	IsConfidential   bool       `json:"is_confidential"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
}

func (s *ContractService) AddStaffDocument(ctx context.Context, tenantID, staffProfileID uuid.UUID, req AddStaffDocumentRequest) (*models.StaffDocument, error) {
	title := strings.TrimSpace(req.Title)
	fileURL := strings.TrimSpace(req.FileURL)
	if title == "" || fileURL == "" {
		return nil, errors.New("document title and file_url are required")
	}

	var staff models.StaffProfile
	if err := s.db.WithContext(ctx).First(&staff, "id = ? AND tenant_id = ?", staffProfileID, tenantID).Error; err != nil {
		return nil, ErrStaffNotFound
	}

	doc := models.StaffDocument{
		TenantID:         tenantID,
		StaffProfileID:   staffProfileID,
		DocumentCategory: req.DocumentCategory,
		Title:            title,
		FileURL:          fileURL,
		FileSizeBytes:    req.FileSizeBytes,
		MimeType:         req.MimeType,
		IsConfidential:   req.IsConfidential,
		ExpiresAt:        req.ExpiresAt,
	}

	if err := s.db.WithContext(ctx).Create(&doc).Error; err != nil {
		return nil, err
	}

	return &doc, nil
}
