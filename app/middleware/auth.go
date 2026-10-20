package middleware

import (
	"strings"

	"institute/app/models"
	"institute/app/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	LocalUser    = "user"
	LocalSession = "session"
)

// Authenticate extracts Bearer tokens and authenticates active user sessions.
func Authenticate(authService *services.AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var rawToken string
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				rawToken = strings.TrimSpace(parts[1])
			}
		}
		if rawToken == "" {
			rawToken = c.Cookies("auth_token")
		}
		if rawToken == "" {
			rawToken = c.Cookies("session_token")
		}
		if rawToken == "" {
			return c.Next()
		}
		ctx := c.UserContext()

		user, session, err := authService.ValidateToken(ctx, rawToken)
		if err == nil && user != nil {
			c.Locals(LocalUser, user)
			c.Locals(LocalSession, session)
		}

		return c.Next()
	}
}

// GetUser retrieves the authenticated *models.User from context.
func GetUser(c *fiber.Ctx) *models.User {
	if val, ok := c.Locals(LocalUser).(*models.User); ok {
		return val
	}
	return nil
}

// GetUserID retrieves the authenticated user's UUID.
func GetUserID(c *fiber.Ctx) (uuid.UUID, bool) {
	if u := GetUser(c); u != nil {
		return u.ID, true
	}
	return uuid.Nil, false
}

// RequireAuth ensures that a valid authenticated user exists on the request.
func RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := GetUser(c)
		if user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "UNAUTHORIZED",
					Message: "Authentication required to access this endpoint",
				},
				RequestID: GetRequestID(c),
			})
		}
		return c.Next()
	}
}

// RequireTenantUser enforces that the authenticated user belongs strictly to the currently resolved tenant.
// Platform administrators cannot bypass this check on tenant-specific operational routes unless explicitly elevated.
func RequireTenantUser() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := GetUser(c)
		if user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "UNAUTHORIZED",
					Message: "Authentication required",
				},
				RequestID: GetRequestID(c),
			})
		}

		currentTenantID, ok := GetTenantID(c)
		if !ok || currentTenantID == uuid.Nil {
			return c.Status(fiber.StatusBadRequest).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_CONTEXT_MISSING",
					Message: "Tenant context is required",
				},
				RequestID: GetRequestID(c),
			})
		}

		if !user.BelongsToTenant(currentTenantID) {
			return c.Status(fiber.StatusForbidden).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "TENANT_ACCESS_DENIED",
					Message: "You do not have access to this institute",
				},
				RequestID: GetRequestID(c),
			})
		}

		return c.Next()
	}
}

// RequireRole ensures that the authenticated user possesses one of the allowed roles.
func RequireRole(allowedRoles ...string) fiber.Handler {
	roleMap := make(map[string]struct{}, len(allowedRoles))
	for _, r := range allowedRoles {
		roleMap[r] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		user := GetUser(c)
		if user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "UNAUTHORIZED",
					Message: "Authentication required",
				},
				RequestID: GetRequestID(c),
			})
		}

		if _, ok := roleMap[user.Role]; !ok {
			return c.Status(fiber.StatusForbidden).JSON(APIError{
				Success: false,
				Error: ErrorDetail{
					Code:    "INSUFFICIENT_PERMISSIONS",
					Message: "You do not have permission to perform this action",
				},
				RequestID: GetRequestID(c),
			})
		}

		return c.Next()
	}
}
