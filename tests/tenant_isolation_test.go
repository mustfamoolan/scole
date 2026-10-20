package tests

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"testing"

	"institute/app/models"
	"institute/app/repositories"
	"institute/database/migrator"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupPostgresIsolationDB(t *testing.T) *gorm.DB {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean tables
	db.Exec("DROP TABLE IF EXISTS tenant_resources CASCADE;")
	db.Exec("DROP TABLE IF EXISTS tenants CASCADE;")
	db.Exec("DROP TABLE IF EXISTS migrations CASCADE;")

	// Run official migrations
	migrationsDir := filepath.Join("..", "database", "migrations")
	_, err = migrator.Migrate(db, migrationsDir)
	if err != nil {
		t.Fatalf("failed to apply migrations in test: %v", err)
	}

	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
	}

	return db
}

func TestTenantIsolation_CrossTenantDataBoundary(t *testing.T) {
	db := setupPostgresIsolationDB(t)
	tenantRepo := repositories.NewTenantRepository(db)
	resourceRepo := repositories.NewTenantResourceRepository(db)
	ctx := context.Background()

	// 1. Create Tenant A
	tenantA := &models.Tenant{
		Name:   "معهد البيان للعلوم",
		Slug:   "al-bayan",
		Status: models.TenantStatusActive,
	}
	if err := tenantRepo.Create(ctx, tenantA); err != nil {
		t.Fatalf("failed to create tenant A: %v", err)
	}

	// 2. Create Tenant B
	tenantB := &models.Tenant{
		Name:   "معهد الفرقان التقني",
		Slug:   "al-furqan",
		Status: models.TenantStatusActive,
	}
	if err := tenantRepo.Create(ctx, tenantB); err != nil {
		t.Fatalf("failed to create tenant B: %v", err)
	}

	if tenantA.ID == tenantB.ID {
		t.Fatalf("tenants must have distinct IDs")
	}

	// 3. Seed resources for Tenant A
	resA1 := &models.TenantResource{
		Title:   "سجل رواتب معهد البيان",
		Content: "بيانات مالية سرية خاصة بمعهد البيان (Tenant A)",
	}
	resA2 := &models.TenantResource{
		Title:   "خطة تدريب معهد البيان",
		Content: "خطة التدريب الفصلي 2026",
	}
	if err := resourceRepo.Create(ctx, tenantA.ID, resA1); err != nil {
		t.Fatalf("failed to create resA1: %v", err)
	}
	if err := resourceRepo.Create(ctx, tenantA.ID, resA2); err != nil {
		t.Fatalf("failed to create resA2: %v", err)
	}

	// 4. Seed resources for Tenant B
	resB1 := &models.TenantResource{
		Title:   "عقود موظفي معهد الفرقان",
		Content: "عقود سرية خاصة بمعهد الفرقان (Tenant B)",
	}
	resB2 := &models.TenantResource{
		Title:   "ميزانية معهد الفرقان",
		Content: "الميزانية السنوية لمعهد الفرقان",
	}
	if err := resourceRepo.Create(ctx, tenantB.ID, resB1); err != nil {
		t.Fatalf("failed to create resB1: %v", err)
	}
	if err := resourceRepo.Create(ctx, tenantB.ID, resB2); err != nil {
		t.Fatalf("failed to create resB2: %v", err)
	}

	// --- VERIFICATION 1: READ ISOLATION (List) ---
	listA, err := resourceRepo.List(ctx, tenantA.ID)
	if err != nil {
		t.Fatalf("failed to list tenant A resources: %v", err)
	}
	if len(listA) != 2 {
		t.Fatalf("expected tenant A to see exactly 2 resources, got %d", len(listA))
	}
	for _, item := range listA {
		if item.TenantID != tenantA.ID {
			t.Fatalf("LEAK: tenant A list contains resource from foreign tenant: %s", item.TenantID)
		}
	}

	listB, err := resourceRepo.List(ctx, tenantB.ID)
	if err != nil {
		t.Fatalf("failed to list tenant B resources: %v", err)
	}
	if len(listB) != 2 {
		t.Fatalf("expected tenant B to see exactly 2 resources, got %d", len(listB))
	}
	for _, item := range listB {
		if item.TenantID != tenantB.ID {
			t.Fatalf("LEAK: tenant B list contains resource from foreign tenant: %s", item.TenantID)
		}
	}

	// --- VERIFICATION 2: DIRECT LOOKUP ISOLATION (FindByID) ---
	// Tenant A knows Tenant B's resource ID: attempts to access it
	_, err = resourceRepo.FindByID(ctx, tenantA.ID, resB1.ID)
	if !errors.Is(err, repositories.ErrResourceNotFound) {
		t.Fatalf("SECURITY VIOLATION: tenant A accessed tenant B resource by ID! err: %v", err)
	}

	// Tenant B knows Tenant A's resource ID: attempts to access it
	_, err = resourceRepo.FindByID(ctx, tenantB.ID, resA1.ID)
	if !errors.Is(err, repositories.ErrResourceNotFound) {
		t.Fatalf("SECURITY VIOLATION: tenant B accessed tenant A resource by ID! err: %v", err)
	}

	// --- VERIFICATION 3: UPDATE TAMPERING ISOLATION ---
	// Tenant A attempts to overwrite Tenant B's resource
	err = resourceRepo.Update(ctx, tenantA.ID, &models.TenantResource{
		ID:      resB1.ID,
		Title:   "HACKED BY TENANT A",
		Content: "OVERWRITTEN DATA",
	})
	if !errors.Is(err, repositories.ErrResourceNotFound) {
		t.Fatalf("SECURITY VIOLATION: tenant A updated tenant B resource! err: %v", err)
	}

	// Verify Tenant B's resource is completely untampered
	intactB1, err := resourceRepo.FindByID(ctx, tenantB.ID, resB1.ID)
	if err != nil {
		t.Fatalf("failed to fetch intact resB1: %v", err)
	}
	if intactB1.Title != "عقود موظفي معهد الفرقان" {
		t.Fatalf("DATA INTEGRITY LOSS: resB1 was modified: %s", intactB1.Title)
	}

	// --- VERIFICATION 4: DELETE TAMPERING ISOLATION ---
	// Tenant A attempts to delete Tenant B's resource
	err = resourceRepo.Delete(ctx, tenantA.ID, resB2.ID)
	if !errors.Is(err, repositories.ErrResourceNotFound) {
		t.Fatalf("SECURITY VIOLATION: tenant A deleted tenant B resource! err: %v", err)
	}

	// Verify Tenant B's resource still exists
	intactB2, err := resourceRepo.FindByID(ctx, tenantB.ID, resB2.ID)
	if err != nil {
		t.Fatalf("failed to fetch intact resB2 after failed delete: %v", err)
	}
	if intactB2 == nil {
		t.Fatalf("DATA LOSS: resB2 was unexpectedly deleted")
	}

	// --- VERIFICATION 5: EMPTY / NIL TENANT ID FAILS CLOSED ---
	nilList, _ := resourceRepo.List(ctx, uuid.Nil)
	if len(nilList) != 0 {
		t.Fatalf("SECURITY VIOLATION: querying with nil UUID leaked %d rows!", len(nilList))
	}
}

func TestTenantIsolation_ConnectionPoolHygiene(t *testing.T) {
	db := setupPostgresIsolationDB(t)
	tenantRepo := repositories.NewTenantRepository(db)
	resourceRepo := repositories.NewTenantResourceRepository(db)
	ctx := context.Background()

	// Seed two distinct tenants
	tenant1 := &models.Tenant{Name: "المعهد الأول", Slug: "inst-1", Status: models.TenantStatusActive}
	tenant2 := &models.Tenant{Name: "المعهد الثاني", Slug: "inst-2", Status: models.TenantStatusActive}
	_ = tenantRepo.Create(ctx, tenant1)
	_ = tenantRepo.Create(ctx, tenant2)

	_ = resourceRepo.Create(ctx, tenant1.ID, &models.TenantResource{Title: "Data 1"})
	_ = resourceRepo.Create(ctx, tenant2.ID, &models.TenantResource{Title: "Data 2"})

	// Simulate 100 interleaved operations across multiple goroutines to test connection pool hygiene
	const iterations = 100
	var wg sync.WaitGroup
	errChan := make(chan error, iterations)

	for i := 0; i < iterations; i++ {
		wg.Add(1)
		go func(iteration int) {
			defer wg.Done()
			var targetTenant uuid.UUID
			var expectedTitle string

			if iteration%2 == 0 {
				targetTenant = tenant1.ID
				expectedTitle = "Data 1"
			} else {
				targetTenant = tenant2.ID
				expectedTitle = "Data 2"
			}

			items, err := resourceRepo.List(ctx, targetTenant)
			if err != nil {
				errChan <- err
				return
			}
			if len(items) != 1 {
				errChan <- errors.New("expected exactly 1 item per tenant")
				return
			}
			if items[0].Title != expectedTitle {
				errChan <- errors.New("CROSS-TENANT LEAK: connection reuse returned data from another tenant")
				return
			}
		}(i)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		t.Fatalf("Connection pool hygiene failed: %v", err)
	}
}
