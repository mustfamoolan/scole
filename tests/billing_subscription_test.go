package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
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

func setupBillingTestApp(t *testing.T) (*fiber.App, *gorm.DB, repositories.UserRepository, repositories.SessionRepository, repositories.TenantRepository, *services.BillingService, repositories.PlanRepository, repositories.SubscriptionRepository, repositories.PaymentReceiptRepository) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean tables
	db.Exec("DROP TABLE IF EXISTS payment_receipts CASCADE;")
	db.Exec("DROP TABLE IF EXISTS subscriptions CASCADE;")
	db.Exec("DROP TABLE IF EXISTS plans CASCADE;")
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
		t.Fatalf("failed to apply migrations in billing test: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewSessionRepository(db)
	tenantRepo := repositories.NewTenantRepository(db)
	planRepo := repositories.NewPlanRepository(db)
	subRepo := repositories.NewSubscriptionRepository(db)
	receiptRepo := repositories.NewPaymentReceiptRepository(db)
	billingService := services.NewBillingService(db, planRepo, subRepo, receiptRepo, tenantRepo)
	authService := services.NewAuthService(userRepo, sessionRepo)

	billingCtrl := controllers.NewBillingController(billingService)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.Authenticate(authService))

	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Public routes
	v1.Get("/public/plans", billingCtrl.ListPublicPlans)
	tenantMgmtService := services.NewTenantManagementService(db, tenantRepo, userRepo)
	tenantMgmtService.SetBillingService(billingService)
	tenantMgmtService.SetAuthService(authService)
	instituteCtrl := controllers.NewInstituteController(tenantMgmtService)
	v1.Post("/public/register-institute", instituteCtrl.SelfRegisterInstitute)

	// Platform admin routes
	platform := v1.Group("/platform", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin))
	platform.Post("/plans", billingCtrl.CreatePlan)
	platform.Get("/plans", billingCtrl.ListAllPlans)
	platform.Post("/subscriptions", billingCtrl.CreateSubscription)
	platform.Post("/subscriptions/:id/renew", billingCtrl.RenewSubscription)
	platform.Post("/subscriptions/:id/change-plan", billingCtrl.ChangePlan)
	platform.Post("/subscriptions/:id/activate", billingCtrl.ActivateSubscription)
	platform.Post("/subscriptions/:id/cancel", billingCtrl.CancelSubscription)
	platform.Post("/receipts", billingCtrl.RecordPayment)
	platform.Get("/receipts", billingCtrl.ListAllReceipts)

	// Tenant-scoped routes
	tenantGroup := v1.Group("/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		BaseDomain: "example.com",
	}))

	// Institute Admin routes
	adminTenant := tenantGroup.Group("/admin", middleware.RequireAuth(), middleware.RequireTenantUser(), middleware.RequireRole(models.RoleInstituteAdmin))
	adminTenant.Get("/billing/subscription", billingCtrl.GetTenantSubscription)
	adminTenant.Get("/billing/receipts", billingCtrl.ListTenantReceipts)
	adminTenant.Get("/billing/plans", billingCtrl.ListPublicPlans)

	return app, db, userRepo, sessionRepo, tenantRepo, billingService, planRepo, subRepo, receiptRepo
}

func TestBilling_PlanCreationAndIQDCurrencyIntegrity(t *testing.T) {
	app, _, userRepo, sessionRepo, _, _, planRepo, _, _ := setupBillingTestApp(t)
	ctx := context.Background()

	// 1. Create Platform Admin
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

	// 2. Create Plan in whole Iraqi Dinars (e.g. 75,000 IQD, no fils)
	planPayload := map[string]interface{}{
		"name":          "الباقة المتقدمة",
		"slug":          "advanced",
		"description":   "باقة المعاهد المتوسطة والمتقدمة في العراق",
		"price_iqd":     75000, // 75,000 IQD integer
		"billing_cycle": "monthly",
		"max_students":  250,
		"max_teachers":  20,
		"max_branches":  2,
		"features":      `{"sms": true, "online_exams": true}`,
	}
	body, _ := json.Marshal(planPayload)

	req := httptest.NewRequest("POST", "/api/v1/platform/plans", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+pToken)

	resp, err := app.Test(req)
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for plan creation in IQD, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool        `json:"success"`
		Plan    models.Plan `json:"plan"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)

	if res.Plan.PriceIQD != 75000 {
		t.Fatalf("expected price 75000 IQD, got %d", res.Plan.PriceIQD)
	}
	if res.Plan.MaxStudents != 250 {
		t.Fatalf("expected max_students 250, got %d", res.Plan.MaxStudents)
	}

	// Verify persistence in DB
	persistedPlan, err := planRepo.FindBySlug(ctx, "advanced")
	if err != nil || persistedPlan.PriceIQD != 75000 {
		t.Fatalf("expected plan in DB with 75000 IQD: %v", err)
	}

	// 3. Negative price rejected
	badPayload := map[string]interface{}{
		"name":          "باقة غير صالحة",
		"slug":          "invalid-price",
		"price_iqd":     -5000,
		"billing_cycle": "monthly",
	}
	badBody, _ := json.Marshal(badPayload)
	badReq := httptest.NewRequest("POST", "/api/v1/platform/plans", bytes.NewReader(badBody))
	badReq.Header.Set("Content-Type", "application/json")
	badReq.Header.Set("Authorization", "Bearer "+pToken)
	badResp, _ := app.Test(badReq)
	if badResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for negative IQD price, got %d", badResp.StatusCode)
	}
}

func TestBilling_SubscriptionLifecycleAndQuotaEnforcement(t *testing.T) {
	app, db, userRepo, sessionRepo, tenantRepo, billingService, planRepo, _, _ := setupBillingTestApp(t)
	ctx := context.Background()

	// Platform Admin
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
	tenant := &models.Tenant{Name: "معهد الروافد", Slug: "alrawafed", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenant)

	// Create Plan with limit of 100 students
	plan := &models.Plan{
		Name:         "باقة البداية",
		Slug:         "starter",
		PriceIQD:     35000, // 35,000 IQD
		BillingCycle: models.BillingCycleMonthly,
		MaxStudents:  100,
		MaxTeachers:  10,
		MaxBranches:  1,
		IsActive:     true,
	}
	_ = planRepo.Create(ctx, plan)

	// 1. Provision subscription for 30 days
	subPayload, _ := json.Marshal(map[string]interface{}{
		"tenant_id":     tenant.ID,
		"plan_id":       plan.ID,
		"duration_days": 30,
	})
	reqSub := httptest.NewRequest("POST", "/api/v1/platform/subscriptions", bytes.NewReader(subPayload))
	reqSub.Header.Set("Content-Type", "application/json")
	reqSub.Header.Set("Authorization", "Bearer "+pToken)
	respSub, _ := app.Test(reqSub)
	if respSub.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for subscription provisioning, got %d", respSub.StatusCode)
	}

	var subRes struct {
		Subscription models.Subscription `json:"subscription"`
	}
	_ = json.NewDecoder(respSub.Body).Decode(&subRes)
	subID := subRes.Subscription.ID

	// 2. Server-side quota checking:
	// 50 students < 100 max -> Allowed
	if err := billingService.CheckLimit(ctx, tenant.ID, "students", 50); err != nil {
		t.Fatalf("expected 50 students to be allowed under 100 max: %v", err)
	}

	// 100 students >= 100 max -> Blocked!
	if err := billingService.CheckLimit(ctx, tenant.ID, "students", 100); err != models.ErrLimitExceeded {
		t.Fatalf("expected ErrLimitExceeded when at limit: %v", err)
	}

	// 105 students > 100 max -> Blocked!
	if err := billingService.CheckLimit(ctx, tenant.ID, "students", 105); err != models.ErrLimitExceeded {
		t.Fatalf("expected ErrLimitExceeded when exceeding limit: %v", err)
	}

	// 3. Renew Subscription: extend by 30 days
	renewPayload, _ := json.Marshal(map[string]interface{}{"extension_days": 30})
	reqRenew := httptest.NewRequest("POST", "/api/v1/platform/subscriptions/"+subID.String()+"/renew", bytes.NewReader(renewPayload))
	reqRenew.Header.Set("Content-Type", "application/json")
	reqRenew.Header.Set("Authorization", "Bearer "+pToken)
	respRenew, _ := app.Test(reqRenew)
	if respRenew.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for subscription renewal, got %d", respRenew.StatusCode)
	}

	// 4. Upgrade Plan: Create bigger plan with 500 students and change plan
	proPlan := &models.Plan{
		Name:         "باقة التوسع",
		Slug:         "pro",
		PriceIQD:     90000, // 90,000 IQD
		BillingCycle: models.BillingCycleMonthly,
		MaxStudents:  500,
		MaxTeachers:  50,
		MaxBranches:  3,
		IsActive:     true,
	}
	_ = planRepo.Create(ctx, proPlan)

	upgradedSub, err := billingService.ChangePlan(ctx, tenant.ID, proPlan.ID)
	if err != nil {
		t.Fatalf("expected successful plan upgrade: %v", err)
	}
	if upgradedSub.PlanID != proPlan.ID {
		t.Fatalf("expected plan ID to be upgraded to pro plan, got %v vs %v", upgradedSub.PlanID, proPlan.ID)
	}

	// Now 100 students is permitted under the 500 limit!
	if err := billingService.CheckLimit(ctx, tenant.ID, "students", 100); err != nil {
		t.Fatalf("expected 100 students to be allowed under new 500 limit: %v", err)
	}

	// 5. Expiration and Data Preservation:
	// Simulate subscription expiration by setting ends_at in the past
	db.Model(&models.Subscription{}).Where("id = ?", subID).Update("ends_at", time.Now().Add(-24*time.Hour))

	// Creating new resource should be blocked due to expiration
	if err := billingService.CheckLimit(ctx, tenant.ID, "students", 10); err != models.ErrSubscriptionExpired {
		t.Fatalf("expected ErrSubscriptionExpired when subscription ended: %v", err)
	}

	// Existing tenant data MUST STILL BE INTACT!
	persistedTenant, err := tenantRepo.FindByID(ctx, tenant.ID)
	if err != nil || persistedTenant == nil {
		t.Fatalf("tenant data must be preserved after subscription expiration")
	}
}

func TestBilling_PaymentReceiptLedgerAndAuditTrail(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, _, _, _, receiptRepo := setupBillingTestApp(t)
	ctx := context.Background()

	// Platform Admin (Recording Officer)
	pHash, _ := services.HashPassword("PlatformSecret123!")
	platformUser := &models.User{
		Name:         "أحمد المحاسب المركزي",
		Email:        "accountant@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// Tenant A
	tenantA := &models.Tenant{Name: "معهد النجاح", Slug: "alnajah", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenantA)
	aHash, _ := services.HashPassword("AdminSecret123!")
	adminA := &models.User{
		TenantID:     &tenantA.ID,
		Name:         "مدير النجاح",
		Email:        "admin@alnajah.edu",
		PasswordHash: aHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	tokenA := "token-admin-alnajah-12345678901234567890123456789012"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, adminA, tokenA)

	// 1. Platform Admin records manual payment in whole Iraqi Dinars (150,000 IQD)
	receiptPayload := map[string]interface{}{
		"tenant_id":      tenantA.ID,
		"amount_iqd":     150000, // 150,000 IQD integer
		"payment_method": "bank_transfer",
		"reference_note": "تحويل مصرفي عبر مصرف الرافدين - إشعار رقم 987654",
	}
	receiptBody, _ := json.Marshal(receiptPayload)

	req := httptest.NewRequest("POST", "/api/v1/platform/receipts", bytes.NewReader(receiptBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+pToken)

	resp, err := app.Test(req)
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for payment receipt creation, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool                  `json:"success"`
		Receipt models.PaymentReceipt `json:"receipt"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)

	if res.Receipt.AmountIQD != 150000 {
		t.Fatalf("expected amount 150000 IQD, got %d", res.Receipt.AmountIQD)
	}
	if res.Receipt.Currency != "IQD" {
		t.Fatalf("expected currency IQD, got %s", res.Receipt.Currency)
	}
	if res.Receipt.RecordedByUserID != platformUser.ID {
		t.Fatalf("expected recorded_by to be platform accountant ID %v, got %v", platformUser.ID, res.Receipt.RecordedByUserID)
	}
	if res.Receipt.ReceiptNumber == "" {
		t.Fatalf("expected receipt number to be generated")
	}

	// Verify persistence in DB
	persistedReceipt, err := receiptRepo.FindByReceiptNumber(ctx, res.Receipt.ReceiptNumber)
	if err != nil || persistedReceipt.AmountIQD != 150000 {
		t.Fatalf("expected receipt persisted in DB: %v", err)
	}

	// 2. Tenant Admin can view their own receipts history
	reqTenantReceipts := httptest.NewRequest("GET", "/api/v1/tenant/admin/billing/receipts", nil)
	reqTenantReceipts.Host = "alnajah.example.com"
	reqTenantReceipts.Header.Set("Authorization", "Bearer "+tokenA)

	respTenantReceipts, _ := app.Test(reqTenantReceipts)
	if respTenantReceipts.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for tenant viewing receipts, got %d", respTenantReceipts.StatusCode)
	}

	var tenantReceiptsRes struct {
		Data []models.PaymentReceipt `json:"data"`
	}
	_ = json.NewDecoder(respTenantReceipts.Body).Decode(&tenantReceiptsRes)
	if len(tenantReceiptsRes.Data) != 1 || tenantReceiptsRes.Data[0].AmountIQD != 150000 {
		t.Fatalf("expected 1 receipt with 150000 IQD for tenant, got %d", len(tenantReceiptsRes.Data))
	}

	// 3. Institute Admin CANNOT record payments into platform ledger (403 Forbidden)
	reqHackedReceipt := httptest.NewRequest("POST", "/api/v1/platform/receipts", bytes.NewReader(receiptBody))
	reqHackedReceipt.Header.Set("Content-Type", "application/json")
	reqHackedReceipt.Header.Set("Authorization", "Bearer "+tokenA)
	respHackedReceipt, _ := app.Test(reqHackedReceipt)
	if respHackedReceipt.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for institute admin recording payments, got %d", respHackedReceipt.StatusCode)
	}

	// 4. Invalid zero or negative amount rejected
	zeroPayload, _ := json.Marshal(map[string]interface{}{
		"tenant_id":      tenantA.ID,
		"amount_iqd":     0,
		"payment_method": "cash",
	})
	reqZero := httptest.NewRequest("POST", "/api/v1/platform/receipts", bytes.NewReader(zeroPayload))
	reqZero.Header.Set("Content-Type", "application/json")
	reqZero.Header.Set("Authorization", "Bearer "+pToken)
	respZero, _ := app.Test(reqZero)
	if respZero.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for zero payment amount, got %d", respZero.StatusCode)
	}
}

func TestBilling_ChangePlanUpgrade(t *testing.T) {
	app, _, userRepo, sessionRepo, tenantRepo, billingService, planRepo, _, _ := setupBillingTestApp(t)
	ctx := context.Background()

	// 1. Setup Platform Admin
	pHash, _ := services.HashPassword("AdminPass123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "admin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-test-change-plan-123456"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// 2. Setup Plans
	planA := &models.Plan{
		Name:         "خطة البداية",
		Slug:         "starter-plan",
		PriceIQD:     35000,
		BillingCycle: models.BillingCycleMonthly,
		MaxStudents:  50,
		MaxTeachers:  5,
		MaxBranches:  1,
		Features:     "{}",
		IsActive:     true,
	}
	_ = planRepo.Create(ctx, planA)

	planB := &models.Plan{
		Name:         "خطة النمو المتقدمة",
		Slug:         "growth-plan",
		PriceIQD:     95000,
		BillingCycle: models.BillingCycleMonthly,
		MaxStudents:  250,
		MaxTeachers:  20,
		MaxBranches:  3,
		Features:     "{}",
		IsActive:     true,
	}
	_ = planRepo.Create(ctx, planB)

	// 3. Setup Tenant
	tenant := &models.Tenant{
		Name:   "معهد الإبداع",
		Slug:   "ebdaa",
		Status: models.TenantStatusActive,
	}
	_ = tenantRepo.Create(ctx, tenant)

	// 4. Initial Subscription with Plan A
	sub, err := billingService.CreateSubscription(ctx, tenant.ID, planA.ID, 30)
	if err != nil {
		t.Fatalf("failed to create initial subscription: %v", err)
	}

	// 5. Change Plan to Plan B via API
	changeBody, _ := json.Marshal(map[string]interface{}{
		"plan_id": planB.ID,
	})
	reqChange := httptest.NewRequest("POST", "/api/v1/platform/subscriptions/"+sub.ID.String()+"/change-plan", bytes.NewReader(changeBody))
	reqChange.Header.Set("Content-Type", "application/json")
	reqChange.Header.Set("Authorization", "Bearer "+pToken)

	respChange, _ := app.Test(reqChange)
	if respChange.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for changing plan, got %d", respChange.StatusCode)
	}

	var changeRes struct {
		Success      bool                `json:"success"`
		Subscription models.Subscription `json:"subscription"`
	}
	_ = json.NewDecoder(respChange.Body).Decode(&changeRes)
	if !changeRes.Success || changeRes.Subscription.PlanID != planB.ID {
		t.Fatalf("expected subscription to be upgraded to planB %v, got %v", planB.ID, changeRes.Subscription.PlanID)
	}
}

func TestBilling_SelfRegistrationAndPlatformActivation(t *testing.T) {
	app, _, userRepo, sessionRepo, _, _, planRepo, subRepo, _ := setupBillingTestApp(t)
	ctx := context.Background()

	// 1. Setup Platform Admin
	pHash, _ := services.HashPassword("AdminPass123!")
	platformUser := &models.User{
		Name:         "Super Admin",
		Email:        "admin@platform.com",
		PasswordHash: pHash,
		Role:         models.RolePlatformAdmin,
		Status:       models.UserStatusActive,
	}
	pToken := "platform-admin-token-test-self-register-123456"
	_ = createTestUserWithToken(ctx, userRepo, sessionRepo, platformUser, pToken)

	// 2. Setup Plan
	plan := &models.Plan{
		Name:         "الباقة الذهبية",
		Slug:         "golden-plan",
		PriceIQD:     85000,
		BillingCycle: models.BillingCycleMonthly,
		MaxStudents:  200,
		MaxTeachers:  15,
		MaxBranches:  2,
		Features:     "{}",
		IsActive:     true,
	}
	_ = planRepo.Create(ctx, plan)

	// 3. User self-registers from landing page with selected plan
	selfRegPayload := map[string]interface{}{
		"name":           "معهد الأوائل النموذجي",
		"slug":           "al-awaael",
		"phone":          "07700000000",
		"address":        "بغداد - الكرخ",
		"admin_name":     "أ. أحمد المهندس",
		"admin_email":    "ahmed@alawaael.iq",
		"admin_password": "Password@123",
		"plan_id":        plan.ID,
	}
	body, _ := json.Marshal(selfRegPayload)
	req := httptest.NewRequest("POST", "/api/v1/public/register-institute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, _ := app.Test(req)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for self-registration, got %d", resp.StatusCode)
	}

	var regRes struct {
		Success      bool                 `json:"success"`
		Tenant       models.Tenant        `json:"tenant"`
		Admin        models.User          `json:"admin"`
		Subscription *models.Subscription `json:"subscription"`
		Token        string               `json:"token"`
		RedirectURL  string               `json:"redirect_url"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&regRes)
	if !regRes.Success || regRes.Tenant.Slug != "al-awaael" || regRes.Token == "" {
		t.Fatalf("expected successful registration with token and slug: %+v", regRes)
	}

	// 4. Verify subscription status is 'trialing'
	if regRes.Subscription == nil || regRes.Subscription.Status != models.SubscriptionStatusTrialing {
		t.Fatalf("expected subscription to be 'trialing', got %+v", regRes.Subscription)
	}

	// 5. Platform Admin approves and activates subscription via API
	actReq := httptest.NewRequest("POST", "/api/v1/platform/subscriptions/"+regRes.Subscription.ID.String()+"/activate", bytes.NewReader([]byte(`{"extension_days": 30}`)))
	actReq.Header.Set("Content-Type", "application/json")
	actReq.Header.Set("Authorization", "Bearer "+pToken)

	actResp, _ := app.Test(actReq)
	if actResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for subscription activation, got %d", actResp.StatusCode)
	}

	persistedSub, err := subRepo.FindByID(ctx, regRes.Subscription.ID)
	if err != nil || persistedSub.Status != models.SubscriptionStatusActive {
		t.Fatalf("expected subscription status to be 'active' after platform activation, got %v (err: %v)", persistedSub.Status, err)
	}
}

func TestBilling_SlugResilienceAndSanitization(t *testing.T) {
	app, _, _, _, _, _, _, _, _ := setupBillingTestApp(t)

	// Test registration with uncleaned slug containing spaces and double hyphens
	payload := map[string]interface{}{
		"name":           "معهد النور والضياء",
		"slug":           "al--noor  test-",
		"phone":          "07711111111",
		"address":        "البصرة",
		"admin_name":     "المدير العام",
		"admin_email":    "manager@alnoor.iq",
		"admin_password": "Password@123",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/public/register-institute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, _ := app.Test(req)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for resilient slug registration, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool          `json:"success"`
		Tenant  models.Tenant `json:"tenant"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)
	if !res.Success {
		t.Fatalf("expected success")
	}
	// Verify slug was properly cleaned: no consecutive hyphens, no trailing hyphens
	if strings.Contains(res.Tenant.Slug, "--") || strings.HasSuffix(res.Tenant.Slug, "-") {
		t.Fatalf("expected slug to be sanitized without -- or trailing hyphen, got: %s", res.Tenant.Slug)
	}
	if err := models.ValidateSlug(res.Tenant.Slug); err != nil {
		t.Fatalf("expected sanitized slug to pass validation: %v", err)
	}
}


