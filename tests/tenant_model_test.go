package tests

import (
	"errors"
	"testing"

	"institute/app/models"
)

func TestTenantModel_SlugValidation(t *testing.T) {
	testCases := []struct {
		name        string
		slug        string
		expectedErr error
	}{
		{
			name:        "valid simple slug",
			slug:        "alnoor",
			expectedErr: nil,
		},
		{
			name:        "valid slug with numbers and hyphens",
			slug:        "al-noor-academy-2026",
			expectedErr: nil,
		},
		{
			name:        "valid slug with uppercase normalized",
			slug:        "Al-Noor",
			expectedErr: nil,
		},
		{
			name:        "too short slug (< 3 chars)",
			slug:        "al",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "starts with hyphen",
			slug:        "-alnoor",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "ends with hyphen",
			slug:        "alnoor-",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "contains double hyphens",
			slug:        "al--noor",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "contains special characters or spaces",
			slug:        "al noor!",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "contains non-ascii unicode characters",
			slug:        "معهد-النور",
			expectedErr: models.ErrInvalidSlugFormat,
		},
		{
			name:        "reserved slug 'api'",
			slug:        "api",
			expectedErr: models.ErrReservedSlug,
		},
		{
			name:        "reserved slug 'admin'",
			slug:        "admin",
			expectedErr: models.ErrReservedSlug,
		},
		{
			name:        "reserved slug 'platform'",
			slug:        "platform",
			expectedErr: models.ErrReservedSlug,
		},
		{
			name:        "reserved slug 'health'",
			slug:        "health",
			expectedErr: models.ErrReservedSlug,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := models.ValidateSlug(tc.slug)
			if tc.expectedErr == nil {
				if err != nil {
					t.Fatalf("expected slug %q to be valid, got: %v", tc.slug, err)
				}
			} else {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("expected error %v for slug %q, got: %v", tc.expectedErr, tc.slug, err)
				}
			}
		})
	}
}

func TestTenantModel_StatusesAndAccess(t *testing.T) {
	setupTenant := models.Tenant{Status: models.TenantStatusSetup}
	if setupTenant.IsActive() {
		t.Fatalf("setup tenant should not be active")
	}
	if !setupTenant.CanAccess() {
		t.Fatalf("setup tenant should be accessible during onboarding")
	}

	activeTenant := models.Tenant{Status: models.TenantStatusActive}
	if !activeTenant.IsActive() {
		t.Fatalf("active tenant should be active")
	}
	if !activeTenant.CanAccess() {
		t.Fatalf("active tenant should be accessible")
	}

	suspendedTenant := models.Tenant{Status: models.TenantStatusSuspended}
	if suspendedTenant.IsActive() {
		t.Fatalf("suspended tenant should not be active")
	}
	if suspendedTenant.CanAccess() {
		t.Fatalf("suspended tenant must not have access")
	}

	archivedTenant := models.Tenant{Status: models.TenantStatusArchived}
	if archivedTenant.IsActive() {
		t.Fatalf("archived tenant should not be active")
	}
	if archivedTenant.CanAccess() {
		t.Fatalf("archived tenant must not have access")
	}
}
