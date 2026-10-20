package bootstrap

import (
	"context"
	"fmt"
	"log"
	"time"

	"institute/config"
	"github.com/fatih/color"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitializeDatabase connects to the database based on config.Global.Database with retries and pool limits.
func InitializeDatabase() *gorm.DB {
	var err error
	var dialector gorm.Dialector

	dbConfig := config.Global.Database

	switch dbConfig.Driver {
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			dbConfig.Username, dbConfig.Password, dbConfig.Host, dbConfig.Port, dbConfig.Database)
		dialector = mysql.Open(dsn)
	case "postgres":
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Shanghai",
			dbConfig.Host, dbConfig.Username, dbConfig.Password, dbConfig.Database, dbConfig.Port)
		dialector = postgres.Open(dsn)
	case "sqlite":
		dialector = sqlite.Open(dbConfig.Database + ".db")
	default:
		log.Fatalf("%s Unsupported database driver: %s", color.RedString("FATAL:"), dbConfig.Driver)
	}

	for attempts := 1; attempts <= 10; attempts++ {
		DB, err = gorm.Open(dialector, &gorm.Config{})
		if err == nil {
			break
		}
		if attempts < 10 {
			time.Sleep(1 * time.Second)
		}
	}
	if err != nil {
		log.Fatalf("%s Failed to connect to database: %v", color.RedString("FATAL:"), err)
	}

	// Configure connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("%s Failed to configure database connection pool: %v", color.RedString("FATAL:"), err)
	}

	maxOpen := dbConfig.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 25
	}
	maxIdle := dbConfig.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 5
	}
	lifetimeMin := dbConfig.ConnMaxLifetimeMin
	if lifetimeMin <= 0 {
		lifetimeMin = 15
	}

	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetConnMaxLifetime(time.Duration(lifetimeMin) * time.Minute)

	fmt.Printf("%s Database connected successfully (%s, pool: open=%d, idle=%d)\n",
		color.CyanString("⚙️"), dbConfig.Driver, maxOpen, maxIdle)
	return DB
}

// CheckDatabaseHealth verifies database connectivity for readiness checks.
func CheckDatabaseHealth(ctx context.Context) error {
	if DB == nil {
		return fmt.Errorf("database client is not initialized")
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying database connection: %w", err)
	}
	return sqlDB.PingContext(ctx)
}
