package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

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

func setupAuthTestApp(t *testing.T) (*fiber.App, *gorm.DB, repositories.UserRepository, repositories.SessionRepository, repositories.TenantRepository, *services.AuthService) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean tables
	db.Exec("DROP TABLE IF EXISTS sessions CASCADE;")
	db.Exec("DROP TABLE IF EXISTS users CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenant_resources CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenants CASCADE;")
	db.Exec("DROP TABLE IF EXISTS migrations CASCADE;")

	// Run official migrations
	migrationsDir := filepath.Join("..", "database", "migrations")
	_, err = migrator.Migrate(db, migrationsDir)
	if err != nil {
		t.Fatalf("failed to apply migrations in auth test: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	tenantRepo := repositories.NewTenantRepository(db)
	authService := services.NewAuthService(userRepo, sessionRepo)
	authCtrl := controllers.NewAuthController(authService)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.Authenticate(authService))

	// Platform auth and protected routes
	app.Post("/api/v1/platform/auth/login", authCtrl.LoginPlatform)
	app.Get("/api/v1/platform/dashboard", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "view": "platform_dashboard"})
	})

	// Tenant routes
	tenantGroup := app.Group("/api/v1/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		BaseDomain: "example.com",
	}))
	tenantGroup.Post("/auth/login", authCtrl.LoginTenant)
	tenantGroup.Get("/auth/me", middleware.RequireAuth(), middleware.RequireTenantUser(), authCtrl.Me)
	tenantGroup.Post("/auth/logout", middleware.RequireAuth(), authCtrl.Logout)
	tenantGroup.Get("/admin/settings", middleware.RequireAuth(), middleware.RequireTenantUser(), middleware.RequireRole(models.RoleInstituteAdmin), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "view": "tenant_admin_settings"})
	})

	return app, db, userRepo, sessionRepo, tenantRepo, authService
}

func TestAuth_PlatformAndTenantLoginLifecycle(t *testing.T) {
	app, _, userRepo, _, tenantRepo, _ := setupAuthTestApp(t)
	ctx := context.Background()

	// 1. Seed Tenant
	tenant := &models.Tenant{
		Name:   "معهد الإتقان العالي",
		Slug:   "alitqan",
		Status: models.TenantStatusActive,
	}
	if err := tenantRepo.Create(ctx, tenant); err != nil {
		t.Fatalf("failed to seed tenant: %v", err)
	}

	// 2. Seed Platform Admin
	platformHash, _ := services.HashPassword("SuperAdminPass2026!")
	platformUser := &models.User{
		Name:         "Platform Superadmin",
		Email:        "superadmin@platform.com",
		PasswordHash: platformHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	if err := userRepo.Create(ctx, platformUser); err != nil {
		t.Fatalf("failed to seed platform user: %v", err)
	}

	// 3. Seed Institute Admin
	itqanHash, _ := services.HashPassword("ItqanSecretPass2026!")
	itqanUser := &models.User{
		TenantID:     &tenant.ID,
		Name:         "مدير معهد الإتقان",
		Email:        "admin@alitqan.edu",
		PasswordHash: itqanHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	if err := userRepo.Create(ctx, itqanUser); err != nil {
		t.Fatalf("failed to seed itqan user: %v", err)
	}

	// 4. Seed Suspended User
	suspendedHash, _ := services.HashPassword("SuspendedPass2026!")
	suspendedUser := &models.User{
		TenantID:     &tenant.ID,
		Name:         "حساب معلق",
		Email:        "suspended@alitqan.edu",
		PasswordHash: suspendedHash,
		Role:         models.RoleStaff,
		Status:       models.UserStatusSuspended,
	}
	_ = userRepo.Create(ctx, suspendedUser)

	// --- TEST 1: Platform Admin Login (Success) ---
	payload, _ := json.Marshal(map[string]string{
		"email":    "superadmin@platform.com",
		"password": "SuperAdminPass2026!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/platform/auth/login", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("platform login failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for platform login, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var loginRes map[string]interface{}
	_ = json.Unmarshal(body, &loginRes)
	if loginRes["token"] == nil || loginRes["token"] == "" {
		t.Fatalf("expected token in login response, got: %s", string(body))
	}

	// --- TEST 2: Platform Admin Login (Wrong Password) -> 401 ---
	badPayload, _ := json.Marshal(map[string]string{
		"email":    "superadmin@platform.com",
		"password": "WrongPassword!",
	})
	reqBad := httptest.NewRequest(http.MethodPost, "/api/v1/platform/auth/login", bytes.NewReader(badPayload))
	reqBad.Header.Set("Content-Type", "application/json")
	respBad, _ := app.Test(reqBad)
	if respBad.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong password, got %d", respBad.StatusCode)
	}

	// --- TEST 3: Institute Admin Login via Subdomain (Success) ---
	tenantPayload, _ := json.Marshal(map[string]string{
		"email":    "admin@alitqan.edu",
		"password": "ItqanSecretPass2026!",
	})
	reqTenant := httptest.NewRequest(http.MethodPost, "/api/v1/tenant/auth/login", bytes.NewReader(tenantPayload))
	reqTenant.Host = "alitqan.example.com"
	reqTenant.Header.Set("Content-Type", "application/json")
	respTenant, err := app.Test(reqTenant)
	if err != nil {
		t.Fatalf("tenant login failed: %v", err)
	}
	if respTenant.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for tenant login, got %d", respTenant.StatusCode)
	}
	bodyTenant, _ := io.ReadAll(respTenant.Body)
	var tenantLoginRes map[string]interface{}
	_ = json.Unmarshal(bodyTenant, &tenantLoginRes)
	tenantToken := tenantLoginRes["token"].(string)

	// --- TEST 4: Access Protected Profile via Bearer Token ---
	reqMe := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/auth/me", nil)
	reqMe.Host = "alitqan.example.com"
	reqMe.Header.Set("Authorization", "Bearer "+tenantToken)
	respMe, _ := app.Test(reqMe)
	if respMe.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for /auth/me, got %d", respMe.StatusCode)
	}
	bodyMe, _ := io.ReadAll(respMe.Body)
	var meRes map[string]interface{}
	_ = json.Unmarshal(bodyMe, &meRes)
	userData := meRes["user"].(map[string]interface{})
	if userData["email"] != "admin@alitqan.edu" {
		t.Fatalf("expected email admin@alitqan.edu in /me response, got: %v", userData["email"])
	}

	// --- TEST 5: Logout and Session Revocation ---
	reqLogout := httptest.NewRequest(http.MethodPost, "/api/v1/tenant/auth/logout", nil)
	reqLogout.Host = "alitqan.example.com"
	reqLogout.Header.Set("Authorization", "Bearer "+tenantToken)
	respLogout, _ := app.Test(reqLogout)
	if respLogout.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for logout, got %d", respLogout.StatusCode)
	}

	// Attempting to re-use revoked token -> 401 Unauthorized
	reqMeAfterLogout := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/auth/me", nil)
	reqMeAfterLogout.Host = "alitqan.example.com"
	reqMeAfterLogout.Header.Set("Authorization", "Bearer "+tenantToken)
	respMeAfterLogout, _ := app.Test(reqMeAfterLogout)
	if respMeAfterLogout.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for revoked session after logout, got %d", respMeAfterLogout.StatusCode)
	}

	// --- TEST 6: Suspended User Login -> 403 Forbidden ---
	suspPayload, _ := json.Marshal(map[string]string{
		"email":    "suspended@alitqan.edu",
		"password": "SuspendedPass2026!",
	})
	reqSusp := httptest.NewRequest(http.MethodPost, "/api/v1/tenant/auth/login", bytes.NewReader(suspPayload))
	reqSusp.Host = "alitqan.example.com"
	reqSusp.Header.Set("Content-Type", "application/json")
	respSusp, _ := app.Test(reqSusp)
	if respSusp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for suspended user login, got %d", respSusp.StatusCode)
	}
}

func TestAuth_SessionExpiration(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _ := setupAuthTestApp(t)
	ctx := context.Background()

	tenant := &models.Tenant{Name: "معهد النخبة", Slug: "alnokhba", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenant)

	userHash, _ := services.HashPassword("ActivePass123!")
	user := &models.User{
		TenantID:     &tenant.ID,
		Name:         "User",
		Email:        "user@alnokhba.edu",
		PasswordHash: userHash,
		Role:         models.RoleStaff,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, user)

	// Create an already-expired session
	rawToken, tokenHash, _ := services.GenerateToken()
	expiredSession := &models.Session{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(-1 * time.Hour), // Expired 1 hour ago
	}
	_ = sessionRepo.Create(ctx, expiredSession)

	// Access protected route with expired token
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/auth/me", nil)
	req.Host = "alnokhba.example.com"
	req.Header.Set("Authorization", "Bearer "+rawToken)
	resp, _ := app.Test(req)

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for expired token session, got %d", resp.StatusCode)
	}
}
