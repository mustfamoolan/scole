package main

import (
	"fmt"
	"log"

	"institute/bootstrap"
	"institute/database/migrator"
)

func main() {
	// 1. Initialize Config
	bootstrap.InitializeConfig()

	// 2. Initialize Database
	db := bootstrap.InitializeDatabase()

	// 3. Run Migrations
	fmt.Println("Running database migrations from database/migrations...")
	count, err := migrator.Migrate(db, "database/migrations")
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	fmt.Printf("✅ Successfully applied %d new migration(s).\n", count)
}
