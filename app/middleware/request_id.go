package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const HeaderXRequestID = "X-Request-ID"
const LocalRequestID = "requestid"

// IsValidRequestID validates that a client-provided Request ID is safe and non-empty.
// It enforces a maximum length of 64 characters and permits only English alphanumeric characters,
// hyphens, underscores, and dots (^[a-zA-Z0-9_.-]+$). Any control characters, spaces, or injection attempts are rejected.
func IsValidRequestID(id string) bool {
	if len(id) == 0 || len(id) > 64 {
		return false
	}
	for i := 0; i < len(id); i++ {
		b := id[i]
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '-' || b == '_' || b == '.' {
			continue
		}
		return false
	}
	return true
}

// RequestID returns a middleware that ensures every incoming request has a unique and sanitized Request ID.
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		reqID := c.Get(HeaderXRequestID)
		if !IsValidRequestID(reqID) {
			reqID = uuid.New().String()
		}

		c.Locals(LocalRequestID, reqID)
		c.Set(HeaderXRequestID, reqID)

		return c.Next()
	}
}

// GetRequestID retrieves the Request ID for the current context.
func GetRequestID(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalRequestID).(string); ok && val != "" {
		return val
	}
	return c.Get(HeaderXRequestID)
}
