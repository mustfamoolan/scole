package tests

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"institute/app/middleware"
	"institute/bootstrap"
	"institute/config"
	"institute/routes"
	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupTestApp() *fiber.App {
	app := fiber.New()
	app.Use(middleware.RequestID())
	routes.RegisterAPIRoutes(app)
	return app
}

func TestLivenessProbes(t *testing.T) {
	app := setupTestApp()

	endpoints := []string{"/health/live", "/api/v1/health"}
	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("endpoint %s failed: %v", ep, err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("endpoint %s returned status %d, expected 200", ep, resp.StatusCode)
		}

		body, _ := io.ReadAll(resp.Body)
		var res map[string]interface{}
		if err := json.Unmarshal(body, &res); err != nil {
			t.Fatalf("failed to parse JSON: %v", err)
		}

		if res["status"] != "ok" {
			t.Errorf("expected status 'ok', got %v", res["status"])
		}
		if res["version"] != "v1" {
			t.Errorf("expected version 'v1', got %v", res["version"])
		}
	}
}

func TestReadinessProbe_UnreadyWhenDependenciesDown(t *testing.T) {
	// Ensure DB is nil to simulate unready dependency
	originalDB := bootstrap.DB
	bootstrap.DB = nil
	defer func() { bootstrap.DB = originalDB }()

	app := setupTestApp()

	endpoints := []string{"/health/ready", "/api/v1/ready"}
	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("endpoint %s failed: %v", ep, err)
		}

		if resp.StatusCode != http.StatusServiceUnavailable {
			t.Fatalf("expected readiness to fail with 503 when dependencies are uninitialized, got %d", resp.StatusCode)
		}

		body, _ := io.ReadAll(resp.Body)
		var res map[string]interface{}
		_ = json.Unmarshal(body, &res)

		if res["status"] != "unavailable" {
			t.Errorf("expected status 'unavailable', got %v", res["status"])
		}
	}
}

func TestReadinessProbe_ReadyWhenHealthy(t *testing.T) {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}
	bootstrap.DB = db

	app := setupTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ready", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	body, _ := io.ReadAll(resp.Body)
	var res map[string]interface{}
	_ = json.Unmarshal(body, &res)

	checks, ok := res["checks"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected checks object in response: %s", string(body))
	}
	if checks["database"] != "ok" {
		t.Errorf("expected database check to be 'ok', got: %v", checks["database"])
	}
}

func TestReadinessProbe_ProductionErrorMasking(t *testing.T) {
	originalDB := bootstrap.DB
	bootstrap.DB = nil
	defer func() { bootstrap.DB = originalDB }()

	originalEnv := config.Global.App.Env
	defer func() { config.Global.App.Env = originalEnv }()

	// 1. Verify Production masks error details
	config.Global.App.Env = "production"
	app := setupTestApp()

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var resProd map[string]interface{}
	if err := json.Unmarshal(body, &resProd); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	checksProd := resProd["checks"].(map[string]interface{})
	dbStatusProd := checksProd["database"].(string)

	if dbStatusProd != "failed: dependency unavailable" {
		t.Fatalf("expected masked error 'failed: dependency unavailable' in production, got: %s", dbStatusProd)
	}
	if resProd["request_id"] == nil || resProd["request_id"] == "" {
		t.Fatalf("expected request_id in readiness response for internal correlation")
	}

	// 2. Verify Local / Non-production exposes diagnostic details
	config.Global.App.Env = "local"
	reqLocal := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	respLocal, err := app.Test(reqLocal)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	bodyLocal, _ := io.ReadAll(respLocal.Body)
	var resLocal map[string]interface{}
	_ = json.Unmarshal(bodyLocal, &resLocal)
	checksLocal := resLocal["checks"].(map[string]interface{})
	dbStatusLocal := checksLocal["database"].(string)

	if dbStatusLocal == "failed: dependency unavailable" {
		t.Fatalf("expected detailed diagnostic message in local env, got masked: %s", dbStatusLocal)
	}
}
