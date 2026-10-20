package tests

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"institute/app/middleware"
	"institute/config"
	"github.com/gofiber/fiber/v2"
)

func TestRequestIDMiddleware_Generated(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequestID())

	var capturedReqID string
	app.Get("/test", func(c *fiber.Ctx) error {
		capturedReqID = middleware.GetRequestID(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	headerID := resp.Header.Get(middleware.HeaderXRequestID)
	if headerID == "" {
		t.Fatalf("expected X-Request-ID response header to be set")
	}
	if capturedReqID != headerID {
		t.Fatalf("context RequestID '%s' did not match header '%s'", capturedReqID, headerID)
	}
}

func TestRequestIDMiddleware_Preserved(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequestID())

	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	customID := "client-trace-12345"
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set(middleware.HeaderXRequestID, customID)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	headerID := resp.Header.Get(middleware.HeaderXRequestID)
	if headerID != customID {
		t.Fatalf("expected X-Request-ID to be preserved as '%s', got '%s'", customID, headerID)
	}
}

func TestRequestIDMiddleware_ValidationAndSanitization(t *testing.T) {
	testCases := []struct {
		name          string
		incomingID    string
		expectSame    bool
	}{
		{
			name:       "valid standard format",
			incomingID: "trace-abc-123_req.v1",
			expectSame: true,
		},
		{
			name:       "valid maximum length 64 chars",
			incomingID: "1234567890123456789012345678901234567890123456789012345678901234",
			expectSame: true,
		},
		{
			name:       "rejected over 64 chars",
			incomingID: "12345678901234567890123456789012345678901234567890123456789012345", // 65 chars
			expectSame: false,
		},
		{
			name:       "rejected with newline CRLF injection attempt",
			incomingID: "valid-prefix\r\nSet-Cookie: evil=true",
			expectSame: false,
		},
		{
			name:       "rejected with spaces",
			incomingID: "req id with spaces",
			expectSame: false,
		},
		{
			name:       "rejected with angle brackets / HTML",
			incomingID: "req<script>alert(1)</script>",
			expectSame: false,
		},
		{
			name:       "rejected with SQL special characters",
			incomingID: "req-1'; DROP TABLE migrations;--",
			expectSame: false,
		},
		{
			name:       "rejected with non-ascii unicode",
			incomingID: "طلب-رقم-123",
			expectSame: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			app := fiber.New()
			app.Use(middleware.RequestID())

			var capturedReqID string
			app.Get("/test", func(c *fiber.Ctx) error {
				capturedReqID = middleware.GetRequestID(c)
				return c.SendString("ok")
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set(middleware.HeaderXRequestID, tc.incomingID)

			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("app.Test failed: %v", err)
			}

			headerID := resp.Header.Get(middleware.HeaderXRequestID)

			if tc.expectSame {
				if headerID != tc.incomingID {
					t.Fatalf("expected valid header ID %s to be kept, got %s", tc.incomingID, headerID)
				}
				if capturedReqID != tc.incomingID {
					t.Fatalf("expected valid captured ID %s to be kept, got %s", tc.incomingID, capturedReqID)
				}
			} else {
				if headerID == tc.incomingID {
					t.Fatalf("rejected ID %s must not appear in response header", tc.incomingID)
				}
				if capturedReqID == tc.incomingID {
					t.Fatalf("rejected ID %s must not be captured in context", tc.incomingID)
				}
				// Verify generated replacement is valid and safe
				if !middleware.IsValidRequestID(headerID) {
					t.Fatalf("replacement header ID %s is not valid", headerID)
				}
				if capturedReqID != headerID {
					t.Fatalf("captured ID %s does not match replacement header %s", capturedReqID, headerID)
				}
			}
		})
	}
}

func TestCustomErrorHandler_NotFound(t *testing.T) {
	app := fiber.New(fiber.Config{
		ErrorHandler: middleware.CustomErrorHandler(),
	})
	app.Use(middleware.RequestID())

	// No route registered for /missing
	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var apiErr middleware.APIError
	if err := json.Unmarshal(body, &apiErr); err != nil {
		t.Fatalf("failed to parse JSON error: %v, raw: %s", err, string(body))
	}

	if apiErr.Success {
		t.Fatalf("expected success to be false")
	}
	if apiErr.Error.Code != "NOT_FOUND" {
		t.Fatalf("expected error code NOT_FOUND, got %s", apiErr.Error.Code)
	}
	if apiErr.RequestID == "" {
		t.Fatalf("expected request_id to be populated in error response")
	}
}

func TestCustomErrorHandler_InternalErrorMasking(t *testing.T) {
	// 1. Test Production masking
	config.Global.App.Env = "production"

	appProd := fiber.New(fiber.Config{
		ErrorHandler: middleware.CustomErrorHandler(),
	})
	appProd.Use(middleware.RequestID())
	appProd.Get("/fail", func(c *fiber.Ctx) error {
		return errors.New("sensitive postgres query syntax error at line 42")
	})

	req := httptest.NewRequest(http.MethodGet, "/fail", nil)
	respProd, err := appProd.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if respProd.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", respProd.StatusCode)
	}

	bodyProd, _ := io.ReadAll(respProd.Body)
	var apiErrProd middleware.APIError
	_ = json.Unmarshal(bodyProd, &apiErrProd)

	if apiErrProd.Error.Message == "sensitive postgres query syntax error at line 42" {
		t.Fatalf("production error response leaked sensitive internal error message: %s", apiErrProd.Error.Message)
	}

	// 2. Test Local environment unmasked
	config.Global.App.Env = "local"
	appLocal := fiber.New(fiber.Config{
		ErrorHandler: middleware.CustomErrorHandler(),
	})
	appLocal.Use(middleware.RequestID())
	appLocal.Get("/fail", func(c *fiber.Ctx) error {
		return errors.New("debug internal error")
	})

	respLocal, _ := appLocal.Test(req)
	bodyLocal, _ := io.ReadAll(respLocal.Body)
	var apiErrLocal middleware.APIError
	_ = json.Unmarshal(bodyLocal, &apiErrLocal)

	if apiErrLocal.Error.Message != "debug internal error" {
		t.Fatalf("expected local error message to be preserved for debugging, got: %s", apiErrLocal.Error.Message)
	}
}
