package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"institute/app/controllers"
	"institute/app/middleware"
	"institute/app/models"
	"institute/app/repositories"
	"institute/app/services"
	"institute/database/migrator"
	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type mockDNSVerifier struct {
	records map[string][]string
}

func newMockDNSVerifier() *mockDNSVerifier {
	return &mockDNSVerifier{records: make(map[string][]string)}
}

func (m *mockDNSVerifier) LookupTXT(ctx context.Context, name string) ([]string, error) {
	norm := models.NormalizeDomain(name)
	if recs, ok := m.records[norm]; ok {
		return recs, nil
	}
	return nil, errors.New("nxdomain")
}

func setupDomainTestApp(t *testing.T, dnsMock *mockDNSVerifier) (*fiber.App, *gorm.DB, repositories.UserRepository, repositories.SessionRepository, repositories.TenantRepository, repositories.DomainRepository, *services.DomainService) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean tables
	db.Exec("DROP TABLE IF EXISTS domains CASCADE;")
	db.Exec("DROP TABLE IF EXISTS sessions CASCADE;")
	db.Exec("DROP TABLE IF EXISTS users CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenant_resources CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenants CASCADE;")
	db.Exec("DROP TABLE IF EXISTS migrations CASCADE;")

	// Run official migrations
	migrationsDir := filepath.Join("..", "database", "migrations")
	_, err = migrator.Migrate(db, migrationsDir)
	if err != nil {
		t.Fatalf("failed to apply migrations in domain test: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	tenantRepo := repositories.NewTenantRepository(db)
	domainRepo := repositories.NewDomainRepository(db)
	authService := services.NewAuthService(userRepo, sessionRepo)
	domainService := services.NewDomainService(domainRepo, tenantRepo, "example.com", dnsMock)

	authCtrl := controllers.NewAuthController(authService)
	domainCtrl := controllers.NewDomainController(domainService)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.Authenticate(authService))

	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Platform admin routes
	platform := v1.Group("/platform", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin))
	platform.Get("/domains", domainCtrl.ListAllDomains)

	// Tenant-scoped routes (Requires valid tenant resolved from domain or subdomain)
	tenantGroup := v1.Group("/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		DomainRepo: domainRepo,
		BaseDomain: "example.com",
	}))

	// Tenant public info
	tenantGroup.Get("/current", func(c *fiber.Ctx) error {
		tenant := middleware.GetTenant(c)
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"id":     tenant.ID,
				"name":   tenant.Name,
				"slug":   tenant.Slug,
				"status": tenant.Status,
			},
		})
	})

	// Protected tenant routes
	protectedTenant := tenantGroup.Group("", middleware.RequireAuth(), middleware.RequireTenantUser())
	protectedTenant.Get("/auth/me", authCtrl.Me)

	// Institute Admin domain management
	adminTenant := protectedTenant.Group("/admin", middleware.RequireRole(models.RoleInstituteAdmin))
	adminTenant.Post("/domains", domainCtrl.RequestDomain)
	adminTenant.Get("/domains", domainCtrl.ListTenantDomains)
	adminTenant.Post("/domains/:id/verify", domainCtrl.VerifyDomain)
	adminTenant.Post("/domains/:id/primary", domainCtrl.SetPrimaryDomain)
	adminTenant.Delete("/domains/:id", domainCtrl.DeleteDomain)

	return app, db, userRepo, sessionRepo, tenantRepo, domainRepo, domainService
}

func TestDomainRouting_SubdomainAndCustomDomainLifecycle(t *testing.T) {
	dnsMock := newMockDNSVerifier()
	app, _, userRepo, sessionRepo, tenantRepo, _, _ := setupDomainTestApp(t, dnsMock)
	ctx := context.Background()

	// 1. Create Tenant A with slug 'almanar'
	tenantA := &models.Tenant{Name: "معهد المنار", Slug: "almanar", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)

	// Create Admin for Tenant A
	aHash, _ := services.HashPassword("AdminSecret123!")
	adminA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير المنار",
		Email:        "admin@almanar.edu",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenA := "token-admin-almanar-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminA, tokenA)

	// 2. Test default subdomain resolution via slug: almanar.example.com
	reqSub := httptest.NewRequest("GET", "/api/v1/tenant/current", nil)
	reqSub.Host = "almanar.example.com"
	respSub, err := app.Test(reqSub)
	if err != nil || respSub.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for default subdomain almanar.example.com, got %d", respSub.StatusCode)
	}

	var curRes struct {
		Success bool `json:"success"`
		Data    struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}
	_ = json.NewDecoder(respSub.Body).Decode(&curRes)
	if curRes.Data.Slug != "almanar" {
		t.Fatalf("expected slug almanar, got %s", curRes.Data.Slug)
	}

	// 3. Request attaching custom domain 'portal.almanar.edu'
	reqCustomBody, _ := json.Marshal(map[string]string{"domain": "portal.almanar.edu"})
	reqAttach := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(reqCustomBody))
	reqAttach.Host = "almanar.example.com"
	reqAttach.Header.Set("Content-Type", "application/json")
	reqAttach.Header.Set("Authorization", "Bearer "+tokenA)
	respAttach, _ := app.Test(reqAttach)
	if respAttach.StatusCode != http.StatusCreated {
		respB, _ := io.ReadAll(respAttach.Body)
		t.Fatalf("expected 201 Created for domain request, got %d: %s", respAttach.StatusCode, string(respB))
	}

	var attachRes struct {
		Success bool          `json:"success"`
		Domain  models.Domain `json:"domain"`
	}
	_ = json.NewDecoder(respAttach.Body).Decode(&attachRes)

	if attachRes.Domain.Status != models.DomainStatusPending {
		t.Fatalf("expected pending_verification status, got %s", attachRes.Domain.Status)
	}
	if attachRes.Domain.VerificationToken == "" {
		t.Fatalf("expected non-empty verification token")
	}

	// 4. CRITICAL: Unverified custom domain MUST NOT route to the tenant
	reqUnverified := httptest.NewRequest("GET", "/api/v1/tenant/current", nil)
	reqUnverified.Host = "portal.almanar.edu"
	respUnverified, _ := app.Test(reqUnverified)
	if respUnverified.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 NOT FOUND for unverified domain, got %d", respUnverified.StatusCode)
	}

	// 5. Verification failure when DNS TXT record is missing
	reqVerifyFail := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains/"+attachRes.Domain.ID.String()+"/verify", nil)
	reqVerifyFail.Host = "almanar.example.com"
	reqVerifyFail.Header.Set("Authorization", "Bearer "+tokenA)
	respVerifyFail, _ := app.Test(reqVerifyFail)
	if respVerifyFail.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when DNS record missing, got %d", respVerifyFail.StatusCode)
	}

	// 6. Simulate correct DNS TXT record in mock DNS
	dnsMock.records["portal.almanar.edu"] = []string{attachRes.Domain.VerificationToken}

	// 7. Verification success
	reqVerifySuccess := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains/"+attachRes.Domain.ID.String()+"/verify", nil)
	reqVerifySuccess.Host = "almanar.example.com"
	reqVerifySuccess.Header.Set("Authorization", "Bearer "+tokenA)
	respVerifySuccess, _ := app.Test(reqVerifySuccess)
	if respVerifySuccess.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for successful verification, got %d", respVerifySuccess.StatusCode)
	}

	var verifyRes struct {
		Success bool          `json:"success"`
		Domain  models.Domain `json:"domain"`
	}
	_ = json.NewDecoder(respVerifySuccess.Body).Decode(&verifyRes)
	if verifyRes.Domain.Status != models.DomainStatusActive {
		t.Fatalf("expected active status after verification, got %s", verifyRes.Domain.Status)
	}

	// 8. CRITICAL: Now requests to 'portal.almanar.edu' MUST successfully route to Almanar!
	reqVerifiedRouting := httptest.NewRequest("GET", "/api/v1/tenant/current", nil)
	reqVerifiedRouting.Host = "portal.almanar.edu"
	respVerifiedRouting, _ := app.Test(reqVerifiedRouting)
	if respVerifiedRouting.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for verified custom domain routing, got %d", respVerifiedRouting.StatusCode)
	}
	var routedRes struct {
		Data struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}
	_ = json.NewDecoder(respVerifiedRouting.Body).Decode(&routedRes)
	if routedRes.Data.Slug != "almanar" {
		t.Fatalf("expected routed slug to be almanar, got %s", routedRes.Data.Slug)
	}
}

func TestDomainRouting_UniquenessAndDomainTakeoverPrevention(t *testing.T) {
	dnsMock := newMockDNSVerifier()
	app, _, userRepo, sessionRepo, tenantRepo, _, _ := setupDomainTestApp(t, dnsMock)
	ctx := context.Background()

	// Tenant A
	tenantA := &models.Tenant{Name: "معهد النور", Slug: "alnoor", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	aHash, _ := services.HashPassword("AdminSecret123!")
	adminA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير النور",
		Email:        "admin@alnoor.edu",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenA := "token-admin-alnoor-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminA, tokenA)

	// Tenant B
	tenantB := &models.Tenant{Name: "معهد الفتح", Slug: "alfath", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantB)
	bHash, _ := services.HashPassword("AdminSecret123!")
	adminB := &models.User{
		TenantID:     &tenantB.ID,
		Name:         "مدير الفتح",
		Email:        "admin@alfath.edu",
		PasswordHash: bHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenB := "token-admin-alfath-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminB, tokenB)

	// 1. Tenant A attaches 'portal.alnoor.edu'
	bodyA, _ := json.Marshal(map[string]string{"domain": "portal.alnoor.edu"})
	reqA := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(bodyA))
	reqA.Host = "alnoor.example.com"
	reqA.Header.Set("Content-Type", "application/json")
	reqA.Header.Set("Authorization", "Bearer "+tokenA)
	respA, _ := app.Test(reqA)
	if respA.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for Tenant A, got %d", respA.StatusCode)
	}

	// 2. Tenant B attempts to attach the SAME domain 'portal.alnoor.edu' -> MUST BE REJECTED (409 Conflict)
	bodyB, _ := json.Marshal(map[string]string{"domain": "portal.alnoor.edu"})
	reqB := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(bodyB))
	reqB.Host = "alfath.example.com"
	reqB.Header.Set("Content-Type", "application/json")
	reqB.Header.Set("Authorization", "Bearer "+tokenB)
	respB, _ := app.Test(reqB)
	if respB.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for duplicate domain request, got %d", respB.StatusCode)
	}

	// 3. Base Domain Takeover Prevention: Attempting to register platform base domain
	bodyBase, _ := json.Marshal(map[string]string{"domain": "example.com"})
	reqBase := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(bodyBase))
	reqBase.Host = "alnoor.example.com"
	reqBase.Header.Set("Content-Type", "application/json")
	reqBase.Header.Set("Authorization", "Bearer "+tokenA)
	respBase, _ := app.Test(reqBase)
	if respBase.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when attempting to claim base domain, got %d", respBase.StatusCode)
	}

	// 4. Base Subdomain Takeover Prevention: Attempting to register sub.example.com as custom domain
	bodySub, _ := json.Marshal(map[string]string{"domain": "admin.example.com"})
	reqSub := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(bodySub))
	reqSub.Host = "alnoor.example.com"
	reqSub.Header.Set("Content-Type", "application/json")
	reqSub.Header.Set("Authorization", "Bearer "+tokenA)
	respSub, _ := app.Test(reqSub)
	if respSub.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when claiming platform subdomains, got %d", respSub.StatusCode)
	}

	// 5. Host Header Injection Prevention: Malformed host header with dangerous characters
	reqMalHost := httptest.NewRequest("GET", "/api/v1/tenant/current", nil)
	reqMalHost.Host = "bad-host<script>.com:8080"
	respMalHost, _ := app.Test(reqMalHost)
	if respMalHost.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for malformed host header, got %d", respMalHost.StatusCode)
	}

	// 6. Unknown domain returns 404 cleanly
	reqUnknown := httptest.NewRequest("GET", "/api/v1/tenant/current", nil)
	reqUnknown.Host = "totallyunknown-domain-not-in-db.com"
	respUnknown, _ := app.Test(reqUnknown)
	if respUnknown.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found for unknown host, got %d", respUnknown.StatusCode)
	}
}

func TestDomainRouting_CrossTenantManagementIsolation(t *testing.T) {
	dnsMock := newMockDNSVerifier()
	app, _, userRepo, sessionRepo, tenantRepo, _, _ := setupDomainTestApp(t, dnsMock)
	ctx := context.Background()

	// Tenant A
	tenantA := &models.Tenant{Name: "معهد الأوائل", Slug: "alawael", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	aHash, _ := services.HashPassword("AdminSecret123!")
	adminA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير الأوائل",
		Email:        "admin@alawael.edu",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenA := "token-admin-alawael-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminA, tokenA)

	// Tenant B
	tenantB := &models.Tenant{Name: "معهد القمة", Slug: "alqemma", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantB)
	bHash, _ := services.HashPassword("AdminSecret123!")
	adminB := &models.User{
		TenantID:     &tenantB.ID,
		Name:         "مدير القمة",
		Email:        "admin@alqemma.edu",
		PasswordHash: bHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenB := "token-admin-alqemma-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminB, tokenB)

	// 1. Tenant A attaches a domain
	bodyA, _ := json.Marshal(map[string]string{"domain": "portal.alawael.edu"})
	reqA := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains", bytes.NewReader(bodyA))
	reqA.Host = "alawael.example.com"
	reqA.Header.Set("Content-Type", "application/json")
	reqA.Header.Set("Authorization", "Bearer "+tokenA)
	respA, _ := app.Test(reqA)
	var resA struct {
		Domain models.Domain `json:"domain"`
	}
	_ = json.NewDecoder(respA.Body).Decode(&resA)
	domainIDA := resA.Domain.ID

	// 2. Tenant B attempts to verify Tenant A's domain -> MUST BE FORBIDDEN (403)
	reqCrossVerify := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains/"+domainIDA.String()+"/verify", nil)
	reqCrossVerify.Host = "alqemma.example.com"
	reqCrossVerify.Header.Set("Authorization", "Bearer "+tokenB)
	respCrossVerify, _ := app.Test(reqCrossVerify)
	if respCrossVerify.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for cross-tenant verify, got %d", respCrossVerify.StatusCode)
	}

	// 3. Tenant B attempts to delete Tenant A's domain -> MUST BE FORBIDDEN (403)
	reqCrossDelete := httptest.NewRequest("DELETE", "/api/v1/tenant/admin/domains/"+domainIDA.String(), nil)
	reqCrossDelete.Host = "alqemma.example.com"
	reqCrossDelete.Header.Set("Authorization", "Bearer "+tokenB)
	respCrossDelete, _ := app.Test(reqCrossDelete)
	if respCrossDelete.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for cross-tenant delete, got %d", respCrossDelete.StatusCode)
	}

	// 4. Tenant A attempts to set an unverified domain as primary -> 400 Bad Request
	reqPrimaryUnverified := httptest.NewRequest("POST", "/api/v1/tenant/admin/domains/"+domainIDA.String()+"/primary", nil)
	reqPrimaryUnverified.Host = "alawael.example.com"
	reqPrimaryUnverified.Header.Set("Authorization", "Bearer "+tokenA)
	respPrimaryUnverified, _ := app.Test(reqPrimaryUnverified)
	if respPrimaryUnverified.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when setting unverified domain as primary, got %d", respPrimaryUnverified.StatusCode)
	}

	// 5. Tenant A deletes their own domain -> 200 OK
	reqDeleteA := httptest.NewRequest("DELETE", "/api/v1/tenant/admin/domains/"+domainIDA.String(), nil)
	reqDeleteA.Host = "alawael.example.com"
	reqDeleteA.Header.Set("Authorization", "Bearer "+tokenA)
	respDeleteA, _ := app.Test(reqDeleteA)
	if respDeleteA.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK when owner deletes their domain, got %d", respDeleteA.StatusCode)
	}
}
