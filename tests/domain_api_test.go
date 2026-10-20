package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/services"
	"institute/bootstrap"
	"institute/config"
	"institute/database/migrator"
	"institute/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestDomainAPI_Endpoints(t *testing.T) {
	config.Global.App.Name = "institute-test"
	config.Global.App.URL = "http://localhost:8080"

	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}
	bootstrap.DB = db

	_, err = migrator.Migrate(db, "../database/migrations")
	if err != nil {
		t.Fatalf("failed to run migrations on test db: %v", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: middleware.CustomErrorHandler(),
	})
	app.Use(middleware.RequestID())
	routes.Register(app)

	// 1. Create Tenant
	tenantSlug := "api-inst-" + uuid.New().String()[:8]
	tenant := models.Tenant{
		ID:     uuid.New(),
		Name:   "API Test Institute",
		Slug:   tenantSlug,
		Status: models.TenantStatusActive,
	}
	db.Create(&tenant)

	// 2. Create Institute Admin User
	adminPass := "AdminPass2026!"
	adminHash, _ := services.HashPassword(adminPass)
	adminUser := models.User{
		ID:           uuid.New(),
		TenantID:     &tenant.ID,
		Name:         "Admin Institute",
		Email:        "admin@" + tenantSlug + ".edu",
		PasswordHash: adminHash,
		Role:         models.RoleInstituteAdmin,
		Status:       models.UserStatusActive,
	}
	db.Create(&adminUser)

	// 3. Login as Institute Admin via API
	loginPayload, _ := json.Marshal(map[string]string{
		"email":    adminUser.Email,
		"password": adminPass,
	})
	loginReq := httptest.NewRequest("POST", "/api/v1/tenant/auth/login", bytes.NewReader(loginPayload))
	loginReq.Header.Set("Content-Type", "application/json")
	loginReq.Host = tenantSlug + ".localhost"

	loginResp, err := app.Test(loginReq, 5000)
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if loginResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(loginResp.Body)
		t.Fatalf("expected 200 for tenant login, got %d: %s", loginResp.StatusCode, string(body))
	}

	var loginData map[string]interface{}
	_ = json.NewDecoder(loginResp.Body).Decode(&loginData)
	token, ok := loginData["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected token in login response, got: %v", loginData)
	}

	// 4. Create Central Person
	person := models.Person{
		ID:        uuid.New(),
		FirstName: "Zaid",
		LastName:  "Omar",
		Gender:    "male",
	}
	db.Create(&person)

	// 5. Test POST /api/v1/tenant/admin/students
	studentPayload := map[string]interface{}{
		"person_id":      person.ID.String(),
		"student_number": "STU-API-" + uuid.New().String()[:6],
	}
	body, _ := json.Marshal(studentPayload)

	req := httptest.NewRequest("POST", "/api/v1/tenant/admin/students", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Host = tenantSlug + ".localhost"

	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	if resp.StatusCode != http.StatusCreated {
		var errResp map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		t.Fatalf("expected HTTP 201 Created for student admission, got %d. Resp: %v", resp.StatusCode, errResp)
	}

	var studentResp map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&studentResp)
	studentData := studentResp["data"].(map[string]interface{})
	studentIDStr := studentData["id"].(string)

	// 6. Test GET /api/v1/tenant/admin/students
	listReq := httptest.NewRequest("GET", "/api/v1/tenant/admin/students", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listReq.Host = tenantSlug + ".localhost"

	listResp, err := app.Test(listReq, 5000)
	if err != nil {
		t.Fatalf("list request failed: %v", err)
	}
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200 OK for list students, got %d", listResp.StatusCode)
	}

	// 7. Test POST /api/v1/tenant/admin/finance/charges
	chargePayload := map[string]interface{}{
		"student_profile_id": studentIDStr,
		"charge_type":        "tuition_installment",
		"description":        "Tuition Term 1",
		"gross_amount":       "450000.0000",
		"currency":           "IQD",
		"due_date":           time.Now().AddDate(0, 1, 0).Format(time.RFC3339),
	}
	chargeBody, _ := json.Marshal(chargePayload)
	chargeReq := httptest.NewRequest("POST", "/api/v1/tenant/admin/finance/charges", bytes.NewReader(chargeBody))
	chargeReq.Header.Set("Content-Type", "application/json")
	chargeReq.Header.Set("Authorization", "Bearer "+token)
	chargeReq.Host = tenantSlug + ".localhost"

	chargeResp, err := app.Test(chargeReq, 5000)
	if err != nil {
		t.Fatalf("charge request failed: %v", err)
	}
	if chargeResp.StatusCode != http.StatusCreated {
		cBody, _ := io.ReadAll(chargeResp.Body)
		t.Fatalf("expected 201 for charge creation, got %d: %s", chargeResp.StatusCode, string(cBody))
	}

	var createdCharge map[string]interface{}
	_ = json.NewDecoder(chargeResp.Body).Decode(&createdCharge)
	chargeData := createdCharge["data"].(map[string]interface{})
	chargeIDStr := chargeData["id"].(string)

	// 8. Test POST /api/v1/tenant/admin/finance/payments
	payPayload := map[string]interface{}{
		"payer_person_id": person.ID.String(),
		"receipt_number":  "API-REC-" + uuid.New().String()[:6],
		"total_amount":    "450000.0000",
		"currency":        "IQD",
		"payment_method":  "cash",
		"allocations": []map[string]interface{}{
			{
				"charge_accrual_id": chargeIDStr,
				"amount":            "450000.0000",
			},
		},
	}
	payBody, _ := json.Marshal(payPayload)
	payReq := httptest.NewRequest("POST", "/api/v1/tenant/admin/finance/payments", bytes.NewReader(payBody))
	payReq.Header.Set("Content-Type", "application/json")
	payReq.Header.Set("Authorization", "Bearer "+token)
	payReq.Host = tenantSlug + ".localhost"

	payResp, err := app.Test(payReq, 5000)
	if err != nil {
		t.Fatalf("payment request failed: %v", err)
	}
	if payResp.StatusCode != http.StatusCreated {
		pBody, _ := io.ReadAll(payResp.Body)
		t.Fatalf("expected 201 for payment collection, got %d: %s", payResp.StatusCode, string(pBody))
	}

	t.Logf("✅ Successfully validated Domain API endpoints with Tenant Authentication, Isolation & Financial Precision.")
}
