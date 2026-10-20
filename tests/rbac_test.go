package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"institute/app/models"
	"institute/app/services"
)

func TestRBAC_PlatformVsInstituteAdminIsolation(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _ := setupAuthTestApp(t)
	ctx := context.Background()

	// 1. Create Tenant A
	tenantA := &models.Tenant{Name: "معهد النور", Slug: "alnoor", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)

	// 2. Create Platform Admin
	pHash, _ := services.HashPassword("PlatformSecret123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "admin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, platformUser)
	pRawToken := "platform-secret-token-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    platformUser.ID,
		TokenHash: services.HashToken(pRawToken),
		ExpiresAt: timeNowPlusDay(),
	})

	// 3. Create Institute Admin for Tenant A
	iHash, _ := services.HashPassword("InstituteSecret123!")
	instUser := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير معهد النور",
		Email:        "admin@alnoor.edu",
		PasswordHash: iHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, instUser)
	iRawToken := "institute-secret-token-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    instUser.ID,
		TokenHash: services.HashToken(iRawToken),
		ExpiresAt: timeNowPlusDay(),
	})

	// 4. Create Staff for Tenant A
	sHash, _ := services.HashPassword("StaffSecret123!")
	staffUser := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "موظف معهد النور",
		Email:        "staff@alnoor.edu",
		PasswordHash: sHash,
		Role:         models.RoleStaff,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, staffUser)
	sRawToken := "staff-secret-token-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    staffUser.ID,
		TokenHash: services.HashToken(sRawToken),
		ExpiresAt: timeNowPlusDay(),
	})

	// --- CHECK 1: Platform Admin can access Platform Dashboard ---
	reqP := httptest.NewRequest(http.MethodGet, "/api/v1/platform/dashboard", nil)
	reqP.Header.Set("Authorization", "Bearer "+pRawToken)
	respP, _ := app.Test(reqP)
	if respP.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for platform admin on platform dashboard, got %d", respP.StatusCode)
	}

	// --- CHECK 2: Institute Admin CANNOT access Platform Dashboard (403 Forbidden) ---
	reqI := httptest.NewRequest(http.MethodGet, "/api/v1/platform/dashboard", nil)
	reqI.Header.Set("Authorization", "Bearer "+iRawToken)
	respI, _ := app.Test(reqI)
	if respI.StatusCode != http.StatusForbidden {
		t.Fatalf("SECURITY VIOLATION: institute admin accessed platform dashboard! Status: %d", respI.StatusCode)
	}

	// --- CHECK 3: Staff CANNOT access Platform Dashboard (403 Forbidden) ---
	reqS := httptest.NewRequest(http.MethodGet, "/api/v1/platform/dashboard", nil)
	reqS.Header.Set("Authorization", "Bearer "+sRawToken)
	respS, _ := app.Test(reqS)
	if respS.StatusCode != http.StatusForbidden {
		t.Fatalf("SECURITY VIOLATION: staff accessed platform dashboard! Status: %d", respS.StatusCode)
	}

	// --- CHECK 4: Unauthenticated request to Platform Dashboard -> 401 Unauthorized ---
	reqNoAuth := httptest.NewRequest(http.MethodGet, "/api/v1/platform/dashboard", nil)
	respNoAuth, _ := app.Test(reqNoAuth)
	if respNoAuth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated request, got %d", respNoAuth.StatusCode)
	}

	// --- CHECK 5: Institute Admin can access Tenant Admin Settings on its own tenant domain ---
	reqSettings := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/admin/settings", nil)
	reqSettings.Host = "alnoor.example.com"
	reqSettings.Header.Set("Authorization", "Bearer "+iRawToken)
	respSettings, _ := app.Test(reqSettings)
	if respSettings.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for institute admin on institute settings, got %d", respSettings.StatusCode)
	}

	// --- CHECK 6: Staff CANNOT access Tenant Admin Settings (403 Forbidden) ---
	reqStaffSettings := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/admin/settings", nil)
	reqStaffSettings.Host = "alnoor.example.com"
	reqStaffSettings.Header.Set("Authorization", "Bearer "+sRawToken)
	respStaffSettings, _ := app.Test(reqStaffSettings)
	if respStaffSettings.StatusCode != http.StatusForbidden {
		t.Fatalf("SECURITY VIOLATION: staff accessed institute admin settings! Status: %d", respStaffSettings.StatusCode)
	}
}

func TestRBAC_CrossTenantUserAccessPrevention(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _ := setupAuthTestApp(t)
	ctx := context.Background()

	// 1. Create Tenant A and Tenant B
	tenantA := &models.Tenant{Name: "معهد أ", Slug: "tenant-a", Status: models.TenantStatusActive}
	tenantB := &models.Tenant{Name: "معهد ب", Slug: "tenant-b", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	_ = tenantRepo.Create(ctx, tenantB)

	// 2. Create Institute Admin for Tenant A
	hashA, _ := services.HashPassword("SecretA123!")
	userA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "Admin A",
		Email:        "admin@tenant-a.com",
		PasswordHash: hashA,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, userA)
	tokenA := "token-for-tenant-a-user-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    userA.ID,
		TokenHash: services.HashToken(tokenA),
		ExpiresAt: timeNowPlusDay(),
	})

	// 3. User A attempts to access Tenant B's protected domain
	reqCross := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/admin/settings", nil)
	reqCross.Host = "tenant-b.example.com" // Request aimed at Tenant B
	reqCross.Header.Set("Authorization", "Bearer "+tokenA) // Using Tenant A's token
	respCross, _ := app.Test(reqCross)

	if respCross.StatusCode != http.StatusForbidden {
		t.Fatalf("SECURITY VIOLATION: User from Tenant A was allowed to access Tenant B! Got HTTP status: %d", respCross.StatusCode)
	}
}

func timeNowPlusDay() time.Time {
	return time.Now().Add(24 * time.Hour)
}
