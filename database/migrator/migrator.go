package migrator

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// MigrationAdvisoryLockID is a stable 64-bit application key used for PostgreSQL advisory locking
// to prevent concurrent migration or rollback executions across multiple app instances.
const MigrationAdvisoryLockID = int64(847291048291039482)

// acquireAdvisoryLock establishes a dedicated session connection and acquires a PostgreSQL
// advisory lock if the underlying database driver is postgres. It returns an unlock function
// that safely releases the lock and closes the connection.
func acquireAdvisoryLock(ctx context.Context, db *gorm.DB) (func(), error) {
	if db.Dialector == nil || db.Dialector.Name() != "postgres" {
		return func() {}, nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB for advisory lock: %w", err)
	}

	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire connection for advisory lock: %w", err)
	}

	if _, err := conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", MigrationAdvisoryLockID); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("failed to acquire pg_advisory_lock: %w", err)
	}

	unlock := func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.ExecContext(unlockCtx, "SELECT pg_advisory_unlock($1)", MigrationAdvisoryLockID)
		_ = conn.Close()
	}

	return unlock, nil
}

// MigrationRecord represents an entry in the migrations tracking table.
type MigrationRecord struct {
	ID        uint      `gorm:"primaryKey"`
	Migration string    `gorm:"unique;not null"`
	Batch     int       `gorm:"not null"`
	CreatedAt time.Time
}

func (MigrationRecord) TableName() string {
	return "migrations"
}

// MigrationStatus reports whether a given migration file has been applied.
type MigrationStatus struct {
	FileName string
	Applied  bool
	Batch    int
}

// EnsureTable ensures the migrations tracking table exists.
func EnsureTable(db *gorm.DB) error {
	return db.AutoMigrate(&MigrationRecord{})
}

// Migrate reads all *.up.sql files in migrationsDir, checks which ones are pending,
// and executes each in an atomic transaction, recording it in the migrations table.
// Concurrency is serialized via PostgreSQL advisory locking.
func Migrate(db *gorm.DB, migrationsDir string) (int, error) {
	unlock, err := acquireAdvisoryLock(context.Background(), db)
	if err != nil {
		return 0, err
	}
	defer unlock()

	if err := EnsureTable(db); err != nil {
		return 0, fmt.Errorf("failed to ensure migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return 0, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var pendingFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			var count int64
			db.Model(&MigrationRecord{}).Where("migration = ?", entry.Name()).Count(&count)
			if count == 0 {
				pendingFiles = append(pendingFiles, entry.Name())
			}
		}
	}

	if len(pendingFiles) == 0 {
		return 0, nil
	}

	sort.Strings(pendingFiles)

	var lastBatch int
	db.Model(&MigrationRecord{}).Select("COALESCE(MAX(batch), 0)").Scan(&lastBatch)
	currentBatch := lastBatch + 1

	executedCount := 0
	for _, fileName := range pendingFiles {
		filePath := filepath.Join(migrationsDir, fileName)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return executedCount, fmt.Errorf("failed to read migration file %s: %w", fileName, err)
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			if strings.TrimSpace(string(content)) != "" {
				if err := tx.Exec(string(content)).Error; err != nil {
					return fmt.Errorf("SQL execution failed in %s: %w", fileName, err)
				}
			}
			return tx.Create(&MigrationRecord{
				Migration: fileName,
				Batch:     currentBatch,
				CreatedAt: time.Now(),
			}).Error
		})

		if err != nil {
			return executedCount, fmt.Errorf("migration %s failed: %w", fileName, err)
		}
		executedCount++
	}

	return executedCount, nil
}

// Rollback rolls back the most recent batch of migrations using corresponding *.down.sql files.
// Concurrency is serialized via PostgreSQL advisory locking.
func Rollback(db *gorm.DB, migrationsDir string) (int, error) {
	unlock, err := acquireAdvisoryLock(context.Background(), db)
	if err != nil {
		return 0, err
	}
	defer unlock()

	if err := EnsureTable(db); err != nil {
		return 0, fmt.Errorf("failed to ensure migrations table: %w", err)
	}

	var lastBatch int
	db.Model(&MigrationRecord{}).Select("COALESCE(MAX(batch), 0)").Scan(&lastBatch)
	if lastBatch == 0 {
		return 0, nil
	}

	var records []MigrationRecord
	if err := db.Where("batch = ?", lastBatch).Order("id desc").Find(&records).Error; err != nil {
		return 0, fmt.Errorf("failed to find migrations for rollback: %w", err)
	}

	rolledBackCount := 0
	for _, record := range records {
		downFileName := strings.Replace(record.Migration, ".up.sql", ".down.sql", 1)
		downFilePath := filepath.Join(migrationsDir, downFileName)

		content, err := os.ReadFile(downFilePath)
		if err != nil {
			return rolledBackCount, fmt.Errorf("failed to read rollback file %s: %w", downFileName, err)
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			if strings.TrimSpace(string(content)) != "" {
				if err := tx.Exec(string(content)).Error; err != nil {
					return fmt.Errorf("rollback SQL failed in %s: %w", downFileName, err)
				}
			}
			return tx.Delete(&record).Error
		})

		if err != nil {
			return rolledBackCount, fmt.Errorf("rollback %s failed: %w", downFileName, err)
		}
		rolledBackCount++
	}

	return rolledBackCount, nil
}

// Status returns the applied/pending status of all migrations in migrationsDir.
func Status(db *gorm.DB, migrationsDir string) ([]MigrationStatus, error) {
	if err := EnsureTable(db); err != nil {
		return nil, fmt.Errorf("failed to ensure migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var appliedMap = make(map[string]int)
	var records []MigrationRecord
	db.Find(&records)
	for _, r := range records {
		appliedMap[r.Migration] = r.Batch
	}

	var statuses []MigrationStatus
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			batch, applied := appliedMap[entry.Name()]
			statuses = append(statuses, MigrationStatus{
				FileName: entry.Name(),
				Applied:  applied,
				Batch:    batch,
			})
		}
	}

	sort.Slice(statuses, func(i, j int) bool {
		return statuses[i].FileName < statuses[j].FileName
	})

	return statuses, nil
}
