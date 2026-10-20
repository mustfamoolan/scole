package scopes

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ForTenant returns a GORM scope that strictly isolates all operations to a specific tenant_id.
// If tenantID is empty/nil, it fails closed with "1 = 0" to prevent any data exposure.
func ForTenant(tenantID uuid.UUID) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if tenantID == uuid.Nil {
			return db.Where("1 = 0")
		}
		return db.Where("tenant_id = ?", tenantID)
	}
}
