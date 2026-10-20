package middleware

import (
	"context"
	"net"
	"net/http"
	"regexp"
	"strings"

	"institute/app/models"
	"institute/app/repositories"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	LocalTenant   = "tenant"
	LocalTenantID = "tenant_id"
)

var (
	hostSafeRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`)
)

// TenantConfig holds configuration options for the Tenant middleware.
type TenantConfig struct {
	Repo       repositories.TenantRepository
	DomainRepo repositories.DomainRepository
	BaseDomain string // e.g. "example.com" or "localhost"
}

// ExtractSubdomain extracts the leading subdomain from a sanitized hostname given a base domain.
// e.g. "alnoor.example.com" with baseDomain "example.com" -> "alnoor"
// "alnoor.localhost" with baseDomain "localhost" -> "alnoor"
func ExtractSubdomain(host, baseDomain string) string {
	cleanHost := SanitizeHost(host)
	cleanBase := strings.ToLower(strings.TrimSpace(baseDomain))

	// Strip URL scheme, path, and port from baseDomain if present
	if strings.Contains(cleanBase, "://") {
		parts := strings.Split(cleanBase, "://")
		cleanBase = parts[len(parts)-1]
	}
	if slashIdx := strings.Index(cleanBase, "/"); slashIdx != -1 {
		cleanBase = cleanBase[:slashIdx]
	}
	if colonIdx := strings.Index(cleanBase, ":"); colonIdx != -1 {
		cleanBase = cleanBase[:colonIdx]
	}

	if cleanHost == "" || cleanBase == "" {
		return ""
	}

	// Host is an IP address or loopback — not a subdomain
	if net.ParseIP(cleanHost) != nil || cleanHost == "localhost" || cleanHost == "127.0.0.1" {
		return ""
	}

	// Exact match on base domain means root platform domain, not a tenant subdomain
	if cleanHost == cleanBase {
		return ""
	}

	// If host ends with "." + baseDomain
	suffix := "." + cleanBase
	if strings.HasSuffix(cleanHost, suffix) {
		sub := strings.TrimSuffix(cleanHost, suffix)
		// Return only the direct subdomain segment
		parts := strings.Split(sub, ".")
		return parts[len(parts)-1]
	}

	// If baseDomain is not specified or host does not match baseDomain,
	// inspect if it's formatted as "sub.domain.tld"
	parts := strings.Split(cleanHost, ".")
	if len(parts) >= 2 {
		// e.g. alnoor.localhost -> parts = ["alnoor", "localhost"]
		return parts[0]
	}

	return ""
}

// SanitizeHost strips port numbers and verifies hostname characters to prevent Host Header Injection.
func SanitizeHost(rawHost string) string {
	host := strings.ToLower(strings.TrimSpace(rawHost))
	if host == "" {
		return ""
	}

	// Strip port if present
	if colonIdx := strings.Index(host, ":"); colonIdx != -1 {
		host = host[:colonIdx]
	}

	if !hostSafeRegex.MatchString(host) {
		return ""
	}

	return host
}

// TenantResolver returns a middleware that extracts, resolves, and binds the tenant context.
// In compliance with security rules, client-supplied tenant_id query/body parameters are strictly ignored.
func TenantResolver(cfg TenantConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		reqHost := c.Hostname()
		if reqHost == "" {
			reqHost = c.Get("Host")
		}

		cleanHost := SanitizeHost(reqHost)
		if cleanHost == "" {
			return c.Status(fiber.StatusBadRequest).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "INVALID_HOST",
					Message: "Invalid or malformed Host header",
				},
				RequestID: GetRequestID(c),
			})
		}

		ctx := c.UserContext()
		if ctx == nil {
			ctx = context.Background()
		}

		var resolvedTenant *models.Tenant
		var err error

		// 1. Check if the entire hostname matches an active verified custom domain
		if cfg.DomainRepo != nil {
			activeDomain, dErr := cfg.DomainRepo.FindActiveByDomain(ctx, cleanHost)
			if dErr == nil && activeDomain != nil {
				resolvedTenant, err = cfg.Repo.FindByID(ctx, activeDomain.TenantID)
			}
		}

		if resolvedTenant == nil {
			resolvedTenant, err = cfg.Repo.FindByDomain(ctx, cleanHost)
			if err != nil && !strings.Contains(err.Error(), "not found") {
				// Database or server error
				return c.Status(fiber.StatusInternalServerError).JSON(APIError{
					Success: false,
					Error: ErrorDetail{
						Code:    "INTERNAL_ERROR",
						Message: "Failed to resolve tenant",
					},
					RequestID: GetRequestID(c),
				})
			}
		}

		// 2. If not matched by custom domain, extract subdomain and lookup by slug
		if resolvedTenant == nil {
			subdomain := ExtractSubdomain(cleanHost, cfg.BaseDomain)
			if subdomain != "" {
				resolvedTenant, err = cfg.Repo.FindBySlug(ctx, subdomain)
			}
		}

		// 3. Development / Query fallback for direct testing on localhost / IP
		if resolvedTenant == nil {
			headerSlug := c.Get("X-Tenant-Slug")
			if headerSlug == "" {
				headerSlug = c.Query("slug")
			}
			if headerSlug != "" {
				resolvedTenant, _ = cfg.Repo.FindBySlug(ctx, models.NormalizeSlug(headerSlug))
			}
		}

		// 4. If no tenant could be resolved for the domain/subdomain
		if resolvedTenant == nil {
			return c.Status(fiber.StatusNotFound).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_NOT_FOUND",
					Message: "No institute is associated with the requested domain or subdomain",
				},
				RequestID: GetRequestID(c),
			})
		}

		// 4. Verify tenant operational state
		switch resolvedTenant.Status {
		case models.TenantStatusSuspended:
			return c.Status(fiber.StatusForbidden).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_SUSPENDED",
					Message: "This institute account is currently suspended. Please contact administration.",
				},
				RequestID: GetRequestID(c),
			})
		case models.TenantStatusArchived:
			return c.Status(fiber.StatusForbidden).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_ARCHIVED",
					Message: "This institute account has been archived.",
				},
				RequestID: GetRequestID(c),
			})
		}

		if !resolvedTenant.CanAccess() {
			return c.Status(fiber.StatusForbidden).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_INACTIVE",
					Message: "This institute account is not currently active.",
				},
				RequestID: GetRequestID(c),
			})
		}

		// 5. Securely bind resolved tenant and ID to context
		c.Locals(LocalTenant, resolvedTenant)
		c.Locals(LocalTenantID, resolvedTenant.ID)

		return c.Next()
	}
}

// GetTenant retrieves the resolved *models.Tenant from the request context.
func GetTenant(c *fiber.Ctx) *models.Tenant {
	if val, ok := c.Locals(LocalTenant).(*models.Tenant); ok {
		return val
	}
	return nil
}

// GetTenantID retrieves the resolved tenant UUID from the request context.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, bool) {
	if val, ok := c.Locals(LocalTenantID).(uuid.UUID); ok && val != uuid.Nil {
		return val, true
	}
	if tenant := GetTenant(c); tenant != nil && tenant.ID != uuid.Nil {
		return tenant.ID, true
	}
	return uuid.Nil, false
}

// RequireTenant enforces that a valid tenant has been resolved on the current route.
func RequireTenant() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if tenant := GetTenant(c); tenant == nil {
			return c.Status(http.StatusNotFound).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_CONTEXT_REQUIRED",
					Message: "A valid tenant context is required for this operation",
				},
				RequestID: GetRequestID(c),
			})
		}
		return c.Next()
	}
}
