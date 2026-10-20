package tests

import (
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
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupAuditTestApp(t *testing.T) (*fiber.App, *gorm.DB, repositories.AuditLogRepository, services.AuditService, repositories.TenantRepository, repositories.UserRepository, repositories.SessionRepository) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean tables
	db.Exec("DROP TABLE IF EXISTS audit_logs CASCADE;")
	db.Exec("DROP TABLE IF EXISTS payment_receipts CASCADE;")
	db.Exec("DROP TABLE IF EXISTS subscriptions CASCADE;")
	db.Exec("DROP TABLE IF EXISTS plans CASCADE;")
	db.Exec("DROP TABLE IF EXISTS domains CASCADE;")
	db.Exec("DROP TABLE IF EXISTS sessions CASCADE;")
	db.Exec("DROP TABLE IF EXISTS users CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenant_resources CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenants CASCADE;")
	db.Exec("DROP TABLE IF EXISTS migrations CASCADE;")

	// Run migrations
	migrationsDir := filepath.Join("..", "database", "migrations")
	_, err = migrator.Migrate(db, migrationsDir)
	if err != nil {
		t.Fatalf("failed to apply migrations in audit test: %v", err)
	}

	auditRepo := repositories.NewAuditLogRepository(db)
	auditService := services.NewAuditService(auditRepo, zap.NewNop())
	tenantRepo := repositories.NewTenantRepository(db)
	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	authService := services.NewAuthService(userRepo, sessionRepo)
	auditCtrl := controllers.NewAuditController(auditService)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.Authenticate(authService))

	// Platform audit route
	platform := app.Group("/api/v1/platform", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin))
	platform.Get("/audit-logs", auditCtrl.ListPlatformAuditLogs)

	// Tenant audit route
	tenantGroup := app.Group("/api/v1/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		BaseDomain: "http://example.com",
	}))
	protectedTenant := tenantGroup.Group("", middleware.RequireAuth(), middleware.RequireTenantUser())
	adminTenant := protectedTenant.Group("/admin", middleware.RequireRole(models.RoleInstituteAdmin))
	adminTenant.Get("/audit-logs", auditCtrl.ListTenantAuditLogs)

	return app, db, auditRepo, auditService, tenantRepo, userRepo, sessionRepo
}

func TestAudit_DirectLoggingAndQuerying(t *testing.T) {
	_, _, auditRepo, auditService, tenantRepo, _, _ := setupAuditTestApp(t)
	ctx := context.Background()

	// 1. Create a Tenant
	tenant := &models.Tenant{Name: "معهد البصرة النموذجي", Slug: "basra-inst", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenant)

	// 2. Log a platform event (tenant_id = nil)
	err := auditService.LogEvent(ctx, nil, nil, "platform_admin", models.ActionPlanCreated, "plan", "plan-1", map[string]interface{}{
		"plan_name": "باقة المعهد",
	}, "127.0.0.1", "Mozilla/5.0")
	if err != nil {
		t.Fatalf("failed to log platform event: %v", err)
	}

	// 3. Log a tenant-specific event
	err = auditService.LogEvent(ctx, &tenant.ID, nil, "platform_admin", models.ActionTenantCreated, "tenant", tenant.ID.String(), map[string]interface{}{
		"slug": tenant.Slug,
	}, "127.0.0.1", "Mozilla/5.0")
	if err != nil {
		t.Fatalf("failed to log tenant event: %v", err)
	}

	// 4. Query platform logs (should return both events)
	logs, total, err := auditRepo.ListPlatform(ctx, "", nil, 10, 0)
	if err != nil {
		t.Fatalf("failed to query platform logs: %v", err)
	}
	if total != 2 || len(logs) != 2 {
		t.Errorf("expected 2 platform audit logs, got %d (total: %d)", len(logs), total)
	}

	// 5. Query tenant logs (should only return the tenant event)
	tenantLogs, tenantTotal, err := auditRepo.ListTenant(ctx, tenant.ID, 10, 0)
	if err != nil {
		t.Fatalf("failed to query tenant logs: %v", err)
	}
	if tenantTotal != 1 || len(tenantLogs) != 1 {
		t.Errorf("expected 1 tenant audit log, got %d (total: %d)", len(tenantLogs), tenantTotal)
	}
	if tenantLogs[0].Action != models.ActionTenantCreated {
		t.Errorf("expected action %s, got %s", models.ActionTenantCreated, tenantLogs[0].Action)
	}
}

func TestAudit_HttpApiAndTenantIsolation(t *testing.T) {
	app, _, _, auditService, tenantRepo, userRepo, sessionRepo := setupAuditTestApp(t)
	ctx := context.Background()

	// 1. Create Tenant A and Tenant B
	tenantA := &models.Tenant{Name: "معهد النور", Slug: "alnoor", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	tenantB := &models.Tenant{Name: "معهد المستقبل", Slug: "future", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantB)

	// 2. Create Platform Admin user and session
	pHash, _ := services.HashPassword("AdminPass123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "admin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, platformUser)
	pToken := "platform-secret-token-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    platformUser.ID,
		TokenHash: services.HashToken(pToken),
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	})

	// 3. Create Institute Admin for Tenant A and session
	aHash, _ := services.HashPassword("AlnoorPass123!")
	adminA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير النور",
		Email:        "admin@alnoor.iq",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	_ = userRepo.Create(ctx, adminA)
	aToken := "alnoor-secret-token-12345678901234567890123456789012"
	_ = sessionRepo.Create(ctx, &models.Session{
		UserID:    adminA.ID,
		TokenHash: services.HashToken(aToken),
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	})

	// 4. Log events for Tenant A and Tenant B
	_ = auditService.LogEvent(ctx, &tenantA.ID, &adminA.ID, "institute_admin", models.ActionTenantProfileUpdated, "tenant", tenantA.ID.String(), map[string]interface{}{"name": "معهد النور"}, "127.0.0.1", "")
	_ = auditService.LogEvent(ctx, &tenantB.ID, nil, "platform_admin", models.ActionTenantStatusUpdated, "tenant", tenantB.ID.String(), map[string]interface{}{"status": "active"}, "127.0.0.1", "")

	// 5. Platform Admin queries all audit logs via API
	reqPlatform := httptest.NewRequest(http.MethodGet, "/api/v1/platform/audit-logs", nil)
	reqPlatform.Header.Set("Authorization", "Bearer "+pToken)
	respPlatform, err := app.Test(reqPlatform, 5000)
	if err != nil {
		t.Fatalf("platform audit request failed: %v", err)
	}
	if respPlatform.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for platform audit logs, got %d", respPlatform.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(respPlatform.Body)
	var platformRes struct {
		Success bool `json:"success"`
		Data    []models.AuditLog `json:"data"`
		Meta    struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	_ = json.Unmarshal(bodyBytes, &platformRes)
	if platformRes.Meta.Total != 2 {
		t.Errorf("expected 2 audit logs in platform API, got %d", platformRes.Meta.Total)
	}

	// 6. Institute Admin for Tenant A queries /api/v1/tenant/admin/audit-logs
	// Must only see Tenant A's events, strictly zero events from Tenant B
	reqTenantA := httptest.NewRequest(http.MethodGet, "/api/v1/tenant/admin/audit-logs", nil)
	reqTenantA.Host = "alnoor.example.com"
	reqTenantA.Header.Set("Authorization", "Bearer "+aToken)
	respTenantA, err := app.Test(reqTenantA, 5000)
	if err != nil {
		t.Fatalf("tenant audit request failed: %v", err)
	}
	if respTenantA.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for tenant audit logs, got %d", respTenantA.StatusCode)
	}

	bodyTenantBytes, _ := io.ReadAll(respTenantA.Body)
	var tenantRes struct {
		Success bool `json:"success"`
		Data    []models.AuditLog `json:"data"`
		Meta    struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	_ = json.Unmarshal(bodyTenantBytes, &tenantRes)
	if tenantRes.Meta.Total != 1 {
		t.Fatalf("expected exactly 1 audit log for Tenant A, got %d", tenantRes.Meta.Total)
	}
	if tenantRes.Data[0].Action != models.ActionTenantProfileUpdated {
		t.Errorf("expected Tenant A log action %s, got %s", models.ActionTenantProfileUpdated, tenantRes.Data[0].Action)
	}
}
