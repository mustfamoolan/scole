package tests

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"institute/app/middleware"
	"institute/app/models"
	"institute/app/repositories"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// mockTenantRepo implements repositories.TenantRepository in memory for unit testing middleware.
type mockTenantRepo struct {
	tenants map[string]*models.Tenant
}

func newMockTenantRepo() *mockTenantRepo {
	return &mockTenantRepo{
		tenants: make(map[string]*models.Tenant),
	}
}

func (m *mockTenantRepo) add(t *models.Tenant) {
	m.tenants[t.Slug] = t
	if t.Domain != nil {
		m.tenants[*t.Domain] = t
	}
}

func (m *mockTenantRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	for _, t := range m.tenants {
		if t.ID == id {
			return t, nil
		}
	}
	return nil, repositories.ErrTenantNotFound
}

func (m *mockTenantRepo) FindBySlug(ctx context.Context, slug string) (*models.Tenant, error) {
	if t, ok := m.tenants[models.NormalizeSlug(slug)]; ok {
		return t, nil
	}
	return nil, repositories.ErrTenantNotFound
}

func (m *mockTenantRepo) FindByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	if t, ok := m.tenants[models.NormalizeSlug(domain)]; ok {
		return t, nil
	}
	return nil, repositories.ErrTenantNotFound
}

func (m *mockTenantRepo) Create(ctx context.Context, tenant *models.Tenant) error {
	m.add(tenant)
	return nil
}

func (m *mockTenantRepo) Update(ctx context.Context, tenant *models.Tenant) error {
	m.add(tenant)
	return nil
}

func (m *mockTenantRepo) Delete(ctx context.Context, id uuid.UUID) error {
	for k, t := range m.tenants {
		if t.ID == id {
			delete(m.tenants, k)
		}
	}
	return nil
}

func (m *mockTenantRepo) List(ctx context.Context, page, limit int) ([]models.Tenant, int64, error) {
	var list []models.Tenant
	seen := make(map[uuid.UUID]bool)
	for _, t := range m.tenants {
		if !seen[t.ID] {
			seen[t.ID] = true
			list = append(list, *t)
		}
	}
	return list, int64(len(list)), nil
}


func TestTenantMiddleware_SubdomainExtractionAndSanitization(t *testing.T) {
	// 1. SanitizeHost
	if got := middleware.SanitizeHost("alnoor.example.com:8080"); got != "alnoor.example.com" {
		t.Fatalf("expected alnoor.example.com, got %s", got)
	}
	if got := middleware.SanitizeHost("ALNOOR.EXAMPLE.COM"); got != "alnoor.example.com" {
		t.Fatalf("expected alnoor.example.com, got %s", got)
	}
	if got := middleware.SanitizeHost("evil.com\r\nX-Injected: header"); got != "" {
		t.Fatalf("expected CRLF host to be rejected, got %s", got)
	}
	if got := middleware.SanitizeHost("invalid host with spaces"); got != "" {
		t.Fatalf("expected space in host to be rejected, got %s", got)
	}

	// 2. ExtractSubdomain
	if sub := middleware.ExtractSubdomain("alnoor.example.com", "example.com"); sub != "alnoor" {
		t.Fatalf("expected alnoor, got %s", sub)
	}
	if sub := middleware.ExtractSubdomain("example.com", "example.com"); sub != "" {
		t.Fatalf("expected root domain to return empty subdomain, got %s", sub)
	}
	if sub := middleware.ExtractSubdomain("alnoor.localhost:8080", "localhost"); sub != "alnoor" {
		t.Fatalf("expected alnoor from localhost, got %s", sub)
	}
	if sub := middleware.ExtractSubdomain("alnoor.localhost:8080", "http://localhost:8080"); sub != "alnoor" {
		t.Fatalf("expected alnoor from http://localhost:8080, got %s", sub)
	}
	if sub := middleware.ExtractSubdomain("localhost:8080", "http://localhost:8080"); sub != "" {
		t.Fatalf("expected empty subdomain from root localhost URL, got %s", sub)
	}
}

func TestTenantMiddleware_ResolutionFlows(t *testing.T) {
	repo := newMockTenantRepo()

	tenantActive := &models.Tenant{
		ID:     uuid.New(),
		Name:   "معهد النور للغات",
		Slug:   "alnoor",
		Status: models.TenantStatusActive,
	}
	repo.add(tenantActive)

	customDomainStr := "academy.alrowaad.edu"
	tenantCustom := &models.Tenant{
		ID:     uuid.New(),
		Name:   "أكاديمية الرواد الدولية",
		Slug:   "alrowaad",
		Domain: &customDomainStr,
		Status: models.TenantStatusActive,
	}
	repo.add(tenantCustom)

	tenantSuspended := &models.Tenant{
		ID:     uuid.New(),
		Name:   "معهد معلق",
		Slug:   "suspended-inst",
		Status: models.TenantStatusSuspended,
	}
	repo.add(tenantSuspended)

	tenantArchived := &models.Tenant{
		ID:     uuid.New(),
		Name:   "معهد مؤرشف",
		Slug:   "archived-inst",
		Status: models.TenantStatusArchived,
	}
	repo.add(tenantArchived)

	app := fiber.New()
	app.Use(middleware.RequestID())
	app.Use(middleware.TenantResolver(middleware.TenantConfig{
		Repo:       repo,
		BaseDomain: "example.com",
	}))

	var capturedTenant *models.Tenant
	var capturedTenantID uuid.UUID
	app.Get("/info", func(c *fiber.Ctx) error {
		capturedTenant = middleware.GetTenant(c)
		capturedTenantID, _ = middleware.GetTenantID(c)
		return c.JSON(fiber.Map{"status": "ok", "institute": capturedTenant.Name})
	})

	// Case 1: Resolve by subdomain
	req1 := httptest.NewRequest(http.MethodGet, "/info", nil)
	req1.Host = "alnoor.example.com"
	resp1, err := app.Test(req1)
	if err != nil {
		t.Fatalf("req1 failed: %v", err)
	}
	if resp1.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for active tenant, got %d", resp1.StatusCode)
	}
	if capturedTenant == nil || capturedTenant.Slug != "alnoor" {
		t.Fatalf("expected resolved tenant alnoor, got %+v", capturedTenant)
	}
	if capturedTenantID != tenantActive.ID {
		t.Fatalf("expected tenant ID %s, got %s", tenantActive.ID, capturedTenantID)
	}

	// Case 2: Resolve by verified custom domain
	req2 := httptest.NewRequest(http.MethodGet, "/info", nil)
	req2.Host = "academy.alrowaad.edu"
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for custom domain, got %d", resp2.StatusCode)
	}
	if capturedTenant == nil || capturedTenant.Slug != "alrowaad" {
		t.Fatalf("expected resolved tenant alrowaad, got %+v", capturedTenant)
	}

	// Case 3: Unknown domain / subdomain -> 404
	req3 := httptest.NewRequest(http.MethodGet, "/info", nil)
	req3.Host = "unknown.example.com"
	resp3, _ := app.Test(req3)
	if resp3.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown tenant, got %d", resp3.StatusCode)
	}

	// Case 4: Suspended tenant -> 403 Forbidden
	req4 := httptest.NewRequest(http.MethodGet, "/info", nil)
	req4.Host = "suspended-inst.example.com"
	resp4, _ := app.Test(req4)
	if resp4.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for suspended tenant, got %d", resp4.StatusCode)
	}

	// Case 5: Archived tenant -> 403 Forbidden
	req5 := httptest.NewRequest(http.MethodGet, "/info", nil)
	req5.Host = "archived-inst.example.com"
	resp5, _ := app.Test(req5)
	if resp5.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for archived tenant, got %d", resp5.StatusCode)
	}

	// Case 6: Attempting to spoof tenant via query param or headers is strictly IGNORED
	spoofedID := uuid.New().String()
	reqSpoof := httptest.NewRequest(http.MethodGet, "/info?tenant_id="+spoofedID, nil)
	reqSpoof.Host = "alnoor.example.com"
	reqSpoof.Header.Set("X-Tenant-ID", spoofedID)
	respSpoof, _ := app.Test(reqSpoof)
	if respSpoof.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respSpoof.StatusCode)
	}
	if capturedTenantID.String() == spoofedID {
		t.Fatalf("security violation: client spoofed tenant_id via query/header!")
	}
	if capturedTenantID != tenantActive.ID {
		t.Fatalf("context did not resolve to genuine domain tenant")
	}

	// Case 7: Malformed Host header -> 400 Bad Request
	reqBadHost := httptest.NewRequest(http.MethodGet, "/info", nil)
	reqBadHost.Host = "bad host with spaces.com"
	respBadHost, _ := app.Test(reqBadHost)
	if respBadHost.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed host header, got %d", respBadHost.StatusCode)
	}
	body, _ := io.ReadAll(respBadHost.Body)
	var apiErr middleware.APIError
	_ = json.Unmarshal(body, &apiErr)
	if apiErr.Error.Code != "INVALID_HOST" {
		t.Fatalf("expected error code INVALID_HOST, got %s", apiErr.Error.Code)
	}
}
