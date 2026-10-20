package tests

import (
	"bytes"
	"strings"
	"testing"

	"institute/bootstrap"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestIsSensitiveKey(t *testing.T) {
	sensitive := []string{
		"password",
		"User_Password",
		"PASSWORD_HASH",
		"access_token",
		"SECRET_KEY",
		"app_key",
		"auth_header",
		"authorization",
		"bearer_token",
		"session_cookie",
		"api_key",
		"private_key",
		"credit_card",
		"cvv",
	}

	for _, key := range sensitive {
		if !bootstrap.IsSensitiveKey(key) {
			t.Errorf("expected key '%s' to be identified as sensitive", key)
		}
	}

	nonSensitive := []string{
		"request_id",
		"path",
		"method",
		"status",
		"duration_ms",
		"user_id",
		"institute_id",
		"tenant_slug",
		"email_verified",
	}

	for _, key := range nonSensitive {
		if bootstrap.IsSensitiveKey(key) {
			t.Errorf("expected key '%s' NOT to be identified as sensitive", key)
		}
	}
}

func TestLogger_AutomaticRedaction(t *testing.T) {
	var buf bytes.Buffer
	encoderConfig := zap.NewProductionEncoderConfig()
	baseCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(&buf),
		zap.DebugLevel,
	)

	securedCore := bootstrap.NewRedactingCore(baseCore)
	testLogger := zap.New(securedCore)

	testLogger.Info("User auth event",
		zap.String("username", "admin"),
		zap.String("password", "PlainPassword123!"),
		zap.String("token", "secret.jwt.token"),
		zap.String("app_key", "0bc7f2fffaecc57d4852caa9e4511f27"),
		zap.String("request_id", "req-test-999"),
	)

	output := buf.String()

	// Assert sensitive values were redacted
	if strings.Contains(output, "PlainPassword123!") {
		t.Errorf("log output leaked raw password: %s", output)
	}
	if strings.Contains(output, "secret.jwt.token") {
		t.Errorf("log output leaked raw token: %s", output)
	}
	if strings.Contains(output, "0bc7f2fffaecc57d4852caa9e4511f27") {
		t.Errorf("log output leaked raw app_key: %s", output)
	}

	// Assert [REDACTED] was inserted
	if !strings.Contains(output, `"[REDACTED]"`) {
		t.Errorf("expected output to contain [REDACTED], got: %s", output)
	}

	// Assert non-sensitive fields were preserved
	if !strings.Contains(output, "req-test-999") {
		t.Errorf("expected output to preserve non-sensitive request_id: %s", output)
	}
	if !strings.Contains(output, "admin") {
		t.Errorf("expected output to preserve non-sensitive username: %s", output)
	}
}

func TestLogger_NestedObjectRedaction(t *testing.T) {
	var buf bytes.Buffer
	encoderConfig := zap.NewProductionEncoderConfig()
	baseCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(&buf),
		zap.DebugLevel,
	)

	securedCore := bootstrap.NewRedactingCore(baseCore)
	testLogger := zap.New(securedCore)

	// Original data with nested structures
	originalMap := map[string]any{
		"username": "academy_admin",
		"password": "nested-secret-pass-999",
		"metadata": map[string]any{
			"auth_token": "bearer.nested.token.abc",
			"client_ip":  "192.168.1.10",
		},
		"tags": []any{"login", "web"},
		"history": []any{
			map[string]any{
				"session_cookie": "cookie-val-secret",
				"status":         "active",
			},
		},
	}

	testLogger.Info("Complex payload event",
		zap.Any("payload", originalMap),
	)

	output := buf.String()

	// Assert sensitive values were redacted inside nested maps and slices
	if strings.Contains(output, "nested-secret-pass-999") {
		t.Errorf("log output leaked nested password: %s", output)
	}
	if strings.Contains(output, "bearer.nested.token.abc") {
		t.Errorf("log output leaked nested auth_token: %s", output)
	}
	if strings.Contains(output, "cookie-val-secret") {
		t.Errorf("log output leaked cookie inside slice of maps: %s", output)
	}

	// Assert non-sensitive values are preserved
	if !strings.Contains(output, "academy_admin") {
		t.Errorf("expected output to preserve username: %s", output)
	}
	if !strings.Contains(output, "192.168.1.10") {
		t.Errorf("expected output to preserve client_ip: %s", output)
	}
	if !strings.Contains(output, "active") {
		t.Errorf("expected output to preserve status in slice: %s", output)
	}

	// Assert that original input map was NOT mutated (data immutability)
	if originalMap["password"] != "nested-secret-pass-999" {
		t.Fatalf("redactingCore mutated original input map: %v", originalMap)
	}
	metaMap := originalMap["metadata"].(map[string]any)
	if metaMap["auth_token"] != "bearer.nested.token.abc" {
		t.Fatalf("redactingCore mutated original nested map: %v", metaMap)
	}
}
