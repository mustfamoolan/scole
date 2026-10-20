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

func setupInstituteTestApp(t *testing.T) (*fiber.App, *gorm.DB, repositories.UserRepository, repositories.SessionRepository, repositories.TenantRepository, *services.TenantManagementService, *services.AuthService) {
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
		t.Fatalf("failed to apply migrations in institute test: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	tenantRepo := repositories.NewTenantRepository(db)
	authService := services.NewAuthService(userRepo, sessionRepo)
	tenantMgmtService := services.NewTenantManagementService(db, tenantRepo, userRepo)

	authCtrl := controllers.NewAuthController(authService)
	instituteCtrl := controllers.NewInstituteController(tenantMgmtService)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.Authenticate(authService))

	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Platform admin routes
	platform := v1.Group("/platform", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin))
	platform.Post("/institutes", instituteCtrl.CreateInstitute)
	platform.Get("/institutes", instituteCtrl.ListInstitutes)
	platform.Get("/institutes/:id", instituteCtrl.GetInstitute)
	platform.Put("/institutes/:id/status", instituteCtrl.UpdateInstituteStatus)

	// Tenant-scoped routes
	tenantGroup := v1.Group("/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		BaseDomain: "example.com",
	}))
	tenantGroup.Post("/auth/login", authCtrl.LoginTenant)

	// Protected tenant routes
	protectedTenant := tenantGroup.Group("", middleware.RequireAuth(), middleware.RequireTenantUser())
	protectedTenant.Get("/auth/me", authCtrl.Me)

	// Institute Admin routes
	adminTenant := protectedTenant.Group("/admin", middleware.RequireRole(models.RoleInstituteAdmin))
	adminTenant.Get("/profile", instituteCtrl.GetTenantProfile)
	adminTenant.Put("/profile", instituteCtrl.UpdateTenantProfile)

	return app, db, userRepo, sessionRepo, tenantRepo, tenantMgmtService, authService
}

// Helper to create a user and active bearer token session
func createTestUserWithToken(ctx context.Context, userRepo repositories.UserRepository, sessionRepo repositories.SessionRepository, user *models.User, token string) error {
	if err := userRepo.Create(ctx, user); err != nil {
		return err
	}
	session := &models.Session{
		UserID:    user.ID,
		TokenHash: services.HashToken(token),
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	return sessionRepo.Create(ctx, session)
}

func TestInstituteManagement_AtomicCreation(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _, _ := setupInstituteTestApp(t)
	ctx := context.Background()

	// 1. Create Platform Admin session
	pHash, _ := services.HashPassword("PlatformSecret123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "superadmin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// 2. Request body to create a new institute
	email := "contact@almanar.edu"
	phone := "+966500000000"
	address := "Riyadh, Saudi Arabia"
	payload := map[string]interface{}{
		"name":           "معهد المنار للتدريب",
		"slug":           "almanar",
		"email":          email,
		"phone":          phone,
		"address":        address,
		"admin_name":     "المهندس أحمد المنار",
		"admin_email":    "admin@almanar.edu",
		"admin_password": "SecurePassword123!",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+pToken)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("failed to execute request: %v", err)
	}

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status 201 Created, got %d: %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		Success bool          `json:"success"`
		Tenant  models.Tenant `json:"tenant"`
		Admin   models.User   `json:"admin"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)

	if !res.Success {
		t.Fatalf("expected success true")
	}
	if res.Tenant.Slug != "almanar" {
		t.Fatalf("expected slug almanar, got %s", res.Tenant.Slug)
	}
	if res.Tenant.Status != models.TenantStatusActive {
		t.Fatalf("expected status active, got %s", res.Tenant.Status)
	}
	if res.Admin.Email != "admin@almanar.edu" {
		t.Fatalf("expected admin email admin@almanar.edu, got %s", res.Admin.Email)
	}
	if res.Admin.TenantID == nil || *res.Admin.TenantID != res.Tenant.ID {
		t.Fatalf("expected admin tenant_id to match tenant ID %v, got %v", res.Tenant.ID, res.Admin.TenantID)
	}
	if res.Admin.Role != models.RoleInstituteAdmin {
		t.Fatalf("expected role institute_admin, got %s", res.Admin.Role)
	}

	// Verify persistence in DB
	persistedTenant, err := tenantRepo.FindBySlug(ctx, "almanar")
	if err != nil {
		t.Fatalf("expected tenant to be found in database: %v", err)
	}
	if persistedTenant.Name != "معهد المنار للتدريب" {
		t.Fatalf("unexpected name in DB: %s", persistedTenant.Name)
	}
	if persistedTenant.Email == nil || *persistedTenant.Email != email {
		t.Fatalf("unexpected email in DB: %v", persistedTenant.Email)
	}

	// Verify Admin User persistence and password hash
	persistedAdmin, err := userRepo.FindByEmailTenant(ctx, res.Tenant.ID, "admin@almanar.edu")
	if err != nil {
		t.Fatalf("expected admin to be found in database: %v", err)
	}
	if !services.CheckPassword("SecurePassword123!", persistedAdmin.PasswordHash) {
		t.Fatalf("admin password verification failed against persisted hash")
	}
}

func TestInstituteManagement_SlugValidationAndConflict(t *testing.T) {
	app, _, userRepo, sessionRepo, _, _, _ := setupInstituteTestApp(t)
	ctx := context.Background()

	pHash, _ := services.HashPassword("PlatformSecret123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "superadmin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// 1. Create first institute
	firstPayload := map[string]interface{}{
		"name":           "معهد الأفق",
		"slug":           "alofoq",
		"admin_name":     "المدير الأول",
		"admin_email":    "admin@alofoq.edu",
		"admin_password": "SecurePassword123!",
	}
	b1, _ := json.Marshal(firstPayload)
	req1 := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(b1))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", "Bearer "+pToken)
	resp1, err := app.Test(req1)
	if err != nil || resp1.StatusCode != http.StatusCreated {
		t.Fatalf("failed to create first institute: status %d", resp1.StatusCode)
	}

	// 2. Attempt duplicate slug
	b2, _ := json.Marshal(firstPayload)
	req2 := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(b2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+pToken)
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for duplicate slug, got %d", resp2.StatusCode)
	}

	// 3. Attempt reserved slug "admin"
	resvPayload := map[string]interface{}{
		"name":           "معهد تجريبي",
		"slug":           "admin",
		"admin_name":     "المدير",
		"admin_email":    "admin@test.edu",
		"admin_password": "SecurePassword123!",
	}
	b3, _ := json.Marshal(resvPayload)
	req3 := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(b3))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Authorization", "Bearer "+pToken)
	resp3, _ := app.Test(req3)
	if resp3.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for reserved slug 'admin', got %d", resp3.StatusCode)
	}

	// 4. Attempt invalid characters in slug
	invPayload := map[string]interface{}{
		"name":           "معهد غير صالح",
		"slug":           "invalid_slug!",
		"admin_name":     "المدير",
		"admin_email":    "admin@test.edu",
		"admin_password": "SecurePassword123!",
	}
	b4, _ := json.Marshal(invPayload)
	req4 := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(b4))
	req4.Header.Set("Content-Type", "application/json")
	req4.Header.Set("Authorization", "Bearer "+pToken)
	resp4, _ := app.Test(req4)
	if resp4.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid characters in slug, got %d", resp4.StatusCode)
	}

	// 5. Slug normalization (UPPERCASE -> lowercase)
	normPayload := map[string]interface{}{
		"name":           "معهد النصر",
		"slug":           "ALNASR-ACADEMY",
		"admin_name":     "مدير النصر",
		"admin_email":    "admin@alnasr.edu",
		"admin_password": "SecurePassword123!",
	}
	b5, _ := json.Marshal(normPayload)
	req5 := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(b5))
	req5.Header.Set("Content-Type", "application/json")
	req5.Header.Set("Authorization", "Bearer "+pToken)
	resp5, _ := app.Test(req5)
	if resp5.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for normalized uppercase slug, got %d", resp5.StatusCode)
	}
	var res5 struct {
		Tenant models.Tenant `json:"tenant"`
	}
	_ = json.NewDecoder(resp5.Body).Decode(&res5)
	if res5.Tenant.Slug != "alnasr-academy" {
		t.Fatalf("expected slug to be normalized to alnasr-academy, got %s", res5.Tenant.Slug)
	}
}

func TestInstituteManagement_StatusLifecycleAndDataPreservation(t *testing.T) {
	app, db, userRepo, sessionRepo, tenantRepo, _, _ := setupInstituteTestApp(t)
	ctx := context.Background()

	// Platform admin
	pHash, _ := services.HashPassword("PlatformSecret123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "superadmin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// Create Tenant
	tenant := &models.Tenant{
		Name:   "معهد المجد",
		Slug:   "almajd",
		Status: models.TenantStatusActive,
	}
	_ = tenantRepo.Create(ctx, tenant)

	// Create Institute Admin for Almajd
	aHash, _ := services.HashPassword("AdminSecret123!")
	adminUser := &models.User{
		TenantID:     &tenant.ID,
		Name:         "مدير المجد",
		Email:        "admin@almajd.edu",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	aToken := "almajd-admin-token-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminUser, aToken)

	// Seed some resource data to test data preservation
	res := &models.TenantResource{
		TenantID: tenant.ID,
		Title:    "مكتبة المعهد الرئيسية",
		Content:  "محتوى كتب ومراجع المعهد",
	}
	_ = db.Create(res).Error

	// 1. Verify tenant admin can access /api/v1/tenant/auth/me when active
	req1 := httptest.NewRequest("GET", "/api/v1/tenant/auth/me", nil)
	req1.Host = "almajd.example.com"
	req1.Header.Set("Authorization", "Bearer "+aToken)
	resp1, _ := app.Test(req1)
	if resp1.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for active tenant, got %d", resp1.StatusCode)
	}

	// 2. Platform Admin updates status to 'suspended'
	statusBody, _ := json.Marshal(map[string]string{"status": "suspended"})
	reqUpdate := httptest.NewRequest("PUT", "/api/v1/platform/institutes/"+tenant.ID.String()+"/status", bytes.NewReader(statusBody))
	reqUpdate.Header.Set("Content-Type", "application/json")
	reqUpdate.Header.Set("Authorization", "Bearer "+pToken)
	respUpdate, _ := app.Test(reqUpdate)
	if respUpdate.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for status update to suspended, got %d", respUpdate.StatusCode)
	}

	// 3. Verify tenant middleware now blocks requests to suspended institute
	req2 := httptest.NewRequest("GET", "/api/v1/tenant/auth/me", nil)
	req2.Host = "almajd.example.com"
	req2.Header.Set("Authorization", "Bearer "+aToken)
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for suspended institute, got %d", resp2.StatusCode)
	}

	// 4. Verify DATA PRESERVATION: institute, users, and resources are NOT deleted
	persistedTenant, err := tenantRepo.FindByID(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("tenant must still exist in DB after suspension: %v", err)
	}
	if persistedTenant.Status != models.TenantStatusSuspended {
		t.Fatalf("expected tenant status to be suspended, got %s", persistedTenant.Status)
	}

	var resourceCount int64
	db.Model(&models.TenantResource{}).Where("tenant_id = ?", tenant.ID).Count(&resourceCount)
	if resourceCount != 1 {
		t.Fatalf("expected resource count 1 preserved, got %d", resourceCount)
	}

	var userCount int64
	db.Model(&models.User{}).Where("tenant_id = ?", tenant.ID).Count(&userCount)
	if userCount != 1 {
		t.Fatalf("expected user count 1 preserved, got %d", userCount)
	}

	// 5. Reactivate institute and verify access restored
	reactivateBody, _ := json.Marshal(map[string]string{"status": "active"})
	reqReactivate := httptest.NewRequest("PUT", "/api/v1/platform/institutes/"+tenant.ID.String()+"/status", bytes.NewReader(reactivateBody))
	reqReactivate.Header.Set("Content-Type", "application/json")
	reqReactivate.Header.Set("Authorization", "Bearer "+pToken)
	respReactivate, _ := app.Test(reqReactivate)
	if respReactivate.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for reactivation, got %d", respReactivate.StatusCode)
	}

	req3 := httptest.NewRequest("GET", "/api/v1/tenant/auth/me", nil)
	req3.Host = "almajd.example.com"
	req3.Header.Set("Authorization", "Bearer "+aToken)
	resp3, _ := app.Test(req3)
	if resp3.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK after reactivation, got %d", resp3.StatusCode)
	}

	// 6. Test invalid status value rejected
	invStatusBody, _ := json.Marshal(map[string]string{"status": "destroyed_invalid"})
	reqInvStatus := httptest.NewRequest("PUT", "/api/v1/platform/institutes/"+tenant.ID.String()+"/status", bytes.NewReader(invStatusBody))
	reqInvStatus.Header.Set("Content-Type", "application/json")
	reqInvStatus.Header.Set("Authorization", "Bearer "+pToken)
	respInvStatus, _ := app.Test(reqInvStatus)
	if respInvStatus.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid status, got %d", respInvStatus.StatusCode)
	}
}

func TestInstituteManagement_RBACAndCrossTenantIsolation(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _, _ := setupInstituteTestApp(t)
	ctx := context.Background()

	// Tenant A
	tenantA := &models.Tenant{Name: "معهد الأوائل", Slug: "alawael", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	aHash, _ := services.HashPassword("Pass123!")
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

	// 1. Institute Admin attempts to access platform central institute creation -> 403 Forbidden
	createPayload, _ := json.Marshal(map[string]interface{}{
		"name":           "معهد مخترق",
		"slug":           "hacked",
		"admin_name":     "هاكر",
		"admin_email":    "hacker@test.edu",
		"admin_password": "password123",
	})
	reqPlatform := httptest.NewRequest("POST", "/api/v1/platform/institutes", bytes.NewReader(createPayload))
	reqPlatform.Header.Set("Content-Type", "application/json")
	reqPlatform.Header.Set("Authorization", "Bearer "+tokenA)
	respPlatform, _ := app.Test(reqPlatform)
	if respPlatform.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for institute admin accessing platform endpoints, got %d", respPlatform.StatusCode)
	}

	// 2. Institute Admin attempts to list platform institutes -> 403 Forbidden
	reqList := httptest.NewRequest("GET", "/api/v1/platform/institutes", nil)
	reqList.Header.Set("Authorization", "Bearer "+tokenA)
	respList, _ := app.Test(reqList)
	if respList.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for institute admin listing platform institutes, got %d", respList.StatusCode)
	}

	// 3. Institute Admin manages their OWN institute profile -> 200 OK
	getProfileReq := httptest.NewRequest("GET", "/api/v1/tenant/admin/profile", nil)
	getProfileReq.Host = "alawael.example.com"
	getProfileReq.Header.Set("Authorization", "Bearer "+tokenA)
	getProfileResp, _ := app.Test(getProfileReq)
	if getProfileResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for institute admin viewing own profile, got %d", getProfileResp.StatusCode)
	}

	// Update profile
	newEmail := "info@alawael.edu"
	newPhone := "+966555555555"
	updateProfileBody, _ := json.Marshal(map[string]interface{}{
		"name":  "معهد الأوائل الدولي المطور",
		"email": newEmail,
		"phone": newPhone,
	})
	putProfileReq := httptest.NewRequest("PUT", "/api/v1/tenant/admin/profile", bytes.NewReader(updateProfileBody))
	putProfileReq.Host = "alawael.example.com"
	putProfileReq.Header.Set("Content-Type", "application/json")
	putProfileReq.Header.Set("Authorization", "Bearer "+tokenA)
	putProfileResp, _ := app.Test(putProfileReq)
	if putProfileResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for updating own profile, got %d", putProfileResp.StatusCode)
	}

	// Verify update in DB
	updatedTenant, _ := tenantRepo.FindByID(ctx, tenantA.ID)
	if updatedTenant.Name != "معهد الأوائل الدولي المطور" || updatedTenant.Email == nil || *updatedTenant.Email != newEmail {
		t.Fatalf("profile update was not correctly persisted to DB")
	}

	// 4. Institute Admin A attempts to access Tenant B's domain -> 403 Forbidden (cross-tenant user rejected)
	crossTenantReq := httptest.NewRequest("GET", "/api/v1/tenant/admin/profile", nil)
	crossTenantReq.Host = "alqemma.example.com"
	crossTenantReq.Header.Set("Authorization", "Bearer "+tokenA)
	crossTenantResp, _ := app.Test(crossTenantReq)
	if crossTenantResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for cross-tenant access, got %d", crossTenantResp.StatusCode)
	}

	// 5. Unauthenticated requests to platform or tenant admin routes -> 401 Unauthorized
	unauthReq := httptest.NewRequest("GET", "/api/v1/platform/institutes", nil)
	unauthResp, _ := app.Test(unauthReq)
	if unauthResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for unauthenticated platform route, got %d", unauthResp.StatusCode)
	}

	unauthTenantReq := httptest.NewRequest("GET", "/api/v1/tenant/admin/profile", nil)
	unauthTenantReq.Host = "alawael.example.com"
	unauthTenantResp, _ := app.Test(unauthTenantReq)
	if unauthTenantResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for unauthenticated tenant admin route, got %d", unauthTenantResp.StatusCode)
	}
}
