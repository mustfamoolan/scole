package tests

import (
	"os"
	"path/filepath"
	"sync"
	"testing"

	"institute/database/migrator"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	dsn := "host=127.0.0.1 user=postgres password=secret dbname=institute_test port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("skipping test: postgres test database on port 5433 is not reachable: %v", err)
	}

	// Clean up tables before each test
	db.Exec("DROP TABLE IF EXISTS widgets CASCADE;")
	db.Exec("DROP TABLE IF EXISTS migrations CASCADE;")

	return db
}

func TestMigrator_ExecutionAndIdempotency(t *testing.T) {
	db := setupTestDB(t)

	// Create temporary migrations directory
	tempDir, err := os.MkdirTemp("", "migrations_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	upFile := filepath.Join(tempDir, "20261010000001_create_widgets_table.up.sql")
	downFile := filepath.Join(tempDir, "20261010000001_create_widgets_table.down.sql")

	upSQL := `CREATE TABLE widgets (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
	downSQL := `DROP TABLE widgets;`

	if err := os.WriteFile(upFile, []byte(upSQL), 0644); err != nil {
		t.Fatalf("failed to write up file: %v", err)
	}
	if err := os.WriteFile(downFile, []byte(downSQL), 0644); err != nil {
		t.Fatalf("failed to write down file: %v", err)
	}

	// 1. Initial Migrate
	executed, err := migrator.Migrate(db, tempDir)
	if err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}
	if executed != 1 {
		t.Fatalf("expected 1 migration executed, got %d", executed)
	}

	// Verify table was created
	if !db.Migrator().HasTable("widgets") {
		t.Fatalf("expected table 'widgets' to exist in database")
	}

	// Verify record in migrations table
	var count int64
	db.Model(&migrator.MigrationRecord{}).Where("migration = ?", "20261010000001_create_widgets_table.up.sql").Count(&count)
	if count != 1 {
		t.Fatalf("expected 1 record in migrations table, got %d", count)
	}

	// 2. Idempotency - running Migrate again should execute 0 migrations
	executedSecond, err := migrator.Migrate(db, tempDir)
	if err != nil {
		t.Fatalf("second Migrate failed: %v", err)
	}
	if executedSecond != 0 {
		t.Fatalf("expected 0 migrations on second run, got %d", executedSecond)
	}

	// 3. Status Check
	statuses, err := migrator.Status(db, tempDir)
	if err != nil {
		t.Fatalf("Status failed: %v", err)
	}
	if len(statuses) != 1 || !statuses[0].Applied {
		t.Fatalf("expected status to show applied=true, got %+v", statuses)
	}

	// 4. Rollback
	rolledBack, err := migrator.Rollback(db, tempDir)
	if err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}
	if rolledBack != 1 {
		t.Fatalf("expected 1 rollback, got %d", rolledBack)
	}

	// Verify table was dropped
	if db.Migrator().HasTable("widgets") {
		t.Fatalf("expected table 'widgets' to be dropped after rollback")
	}

	// Verify record removed from migrations table
	db.Model(&migrator.MigrationRecord{}).Where("migration = ?", "20261010000001_create_widgets_table.up.sql").Count(&count)
	if count != 0 {
		t.Fatalf("expected 0 records in migrations table after rollback, got %d", count)
	}
}

func TestMigrator_AtomicTransactionRollbackOnError(t *testing.T) {
	db := setupTestDB(t)

	tempDir, err := os.MkdirTemp("", "migrations_fail_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	brokenFile := filepath.Join(tempDir, "20261010000002_broken_syntax.up.sql")
	brokenSQL := `INVALID SQL SYNTAX HERE THAT SHOULD CAUSE AN ERROR;`

	if err := os.WriteFile(brokenFile, []byte(brokenSQL), 0644); err != nil {
		t.Fatalf("failed to write broken migration: %v", err)
	}

	// Attempt migration
	_, err = migrator.Migrate(db, tempDir)
	if err == nil {
		t.Fatalf("expected migration with invalid SQL to fail, but it succeeded")
	}

	// Verify that broken migration was NOT registered in migrations table
	var count int64
	db.Model(&migrator.MigrationRecord{}).Where("migration = ?", "20261010000002_broken_syntax.up.sql").Count(&count)
	if count != 0 {
		t.Fatalf("expected broken migration NOT to be recorded in migrations table, but found count=%d", count)
	}
}

func TestMigrator_ConcurrentExecutionAndAdvisoryLock(t *testing.T) {
	db := setupTestDB(t)
	db.Exec("DROP TABLE IF EXISTS concurrency_items CASCADE;")
	defer db.Exec("DROP TABLE IF EXISTS concurrency_items CASCADE;")

	tempDir, err := os.MkdirTemp("", "migrations_concurrent_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	upFile := filepath.Join(tempDir, "20261010000003_create_concurrency_items.up.sql")
	upSQL := `CREATE TABLE concurrency_items (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL);`
	if err := os.WriteFile(upFile, []byte(upSQL), 0644); err != nil {
		t.Fatalf("failed to write up file: %v", err)
	}

	// 1. Test concurrent execution across multiple goroutines
	const workers = 3
	var wg sync.WaitGroup
	errs := make([]error, workers)
	executedCounts := make([]int, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			cnt, runErr := migrator.Migrate(db, tempDir)
			executedCounts[idx] = cnt
			errs[idx] = runErr
		}(i)
	}
	wg.Wait()

	// Assert no goroutine crashed or failed
	totalExecuted := 0
	for i := 0; i < workers; i++ {
		if errs[i] != nil {
			t.Fatalf("worker %d failed during concurrent migration: %v", i, errs[i])
		}
		totalExecuted += executedCounts[i]
	}

	// Exactly 1 worker should have executed the migration, others executed 0
	if totalExecuted != 1 {
		t.Fatalf("expected exactly 1 execution across all workers, got total=%d, counts=%v", totalExecuted, executedCounts)
	}

	// Verify table and migrations record exist and are unique
	if !db.Migrator().HasTable("concurrency_items") {
		t.Fatalf("expected table 'concurrency_items' to exist")
	}

	var count int64
	db.Model(&migrator.MigrationRecord{}).Where("migration = ?", "20261010000003_create_concurrency_items.up.sql").Count(&count)
	if count != 1 {
		t.Fatalf("expected exactly 1 migration record, found %d", count)
	}
}
