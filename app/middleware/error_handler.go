package middleware

import (
	"errors"
	"net/http"

	"institute/config"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// APIError represents the structured JSON error body.
type APIError struct {
	Success   bool        `json:"success"`
	Error     ErrorDetail `json:"error"`
	RequestID string      `json:"request_id,omitempty"`
}

// ErrorDetail describes the error code and human-readable message.
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// CustomErrorHandler returns a centralized Fiber ErrorHandler.
func CustomErrorHandler() fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		statusCode := fiber.StatusInternalServerError
		code := "INTERNAL_SERVER_ERROR"
		message := "An internal server error occurred"

		reqID := GetRequestID(c)

		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			statusCode = fiberErr.Code
			message = fiberErr.Message
			switch statusCode {
			case fiber.StatusNotFound:
				code = "NOT_FOUND"
			case fiber.StatusBadRequest:
				code = "BAD_REQUEST"
			case fiber.StatusUnauthorized:
				code = "UNAUTHORIZED"
			case fiber.StatusForbidden:
				code = "FORBIDDEN"
			case fiber.StatusMethodNotAllowed:
				code = "METHOD_NOT_ALLOWED"
			case fiber.StatusServiceUnavailable:
				code = "SERVICE_UNAVAILABLE"
			default:
				code = http.StatusText(statusCode)
			}
		}

		// Log server errors (5xx)
		if statusCode >= 500 {
			zap.L().Error("Unhandled server error",
				zap.String("request_id", reqID),
				zap.String("method", c.Method()),
				zap.String("path", c.Path()),
				zap.Int("status", statusCode),
				zap.Error(err),
			)

			// In production, mask raw internal error messages to prevent leakage
			if config.Global.App.Env == "production" {
				message = "An unexpected error occurred. Please contact support with your Request ID."
			} else {
				message = err.Error()
			}
		}

		return c.Status(statusCode).JSON(APIError{
			Success: false,
			Error: ErrorDetail{
				Code:    code,
				Message: message,
			},
			RequestID: reqID,
		})
	}
}
