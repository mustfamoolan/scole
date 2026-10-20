package bootstrap

import (
	"os"
	"path/filepath"
	"strings"

	"institute/config"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log *zap.Logger

var sensitiveKeyPatterns = []string{
	"password",
	"passwd",
	"secret",
	"token",
	"authorization",
	"auth",
	"bearer",
	"cookie",
	"app_key",
	"api_key",
	"private_key",
	"credit_card",
	"cvv",
}

// IsSensitiveKey reports whether a field key is considered sensitive.
func IsSensitiveKey(key string) bool {
	lowerKey := strings.ToLower(key)
	for _, pattern := range sensitiveKeyPatterns {
		if strings.Contains(lowerKey, pattern) {
			return true
		}
	}
	return false
}

// redactValue recursively inspects supported structured containers (map[string]any, map[string]string,
// and []any slices) and returns a cloned copy with values for sensitive keys redacted.
// For unsupported or primitive types, it returns the original value unchanged.
func redactValue(val any) any {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case map[string]any:
		return redactMap(v)
	case map[string]string:
		return redactStringMap(v)
	case []any:
		return redactSlice(v)
	default:
		return val
	}
}

func redactMap(m map[string]any) map[string]any {
	cloned := make(map[string]any, len(m))
	for k, v := range m {
		if IsSensitiveKey(k) {
			cloned[k] = "[REDACTED]"
		} else {
			cloned[k] = redactValue(v)
		}
	}
	return cloned
}

func redactStringMap(m map[string]string) map[string]string {
	cloned := make(map[string]string, len(m))
	for k, v := range m {
		if IsSensitiveKey(k) {
			cloned[k] = "[REDACTED]"
		} else {
			cloned[k] = v
		}
	}
	return cloned
}

func redactSlice(s []any) []any {
	cloned := make([]any, len(s))
	for i, item := range s {
		cloned[i] = redactValue(item)
	}
	return cloned
}

// redactFields returns a copy of fields where any sensitive field value is replaced with "[REDACTED]",
// including recursive redaction inside supported nested maps and slices passed via zap.Any.
func redactFields(fields []zapcore.Field) []zapcore.Field {
	redacted := make([]zapcore.Field, len(fields))
	for i, f := range fields {
		if IsSensitiveKey(f.Key) {
			redacted[i] = zap.String(f.Key, "[REDACTED]")
		} else if f.Interface != nil {
			redacted[i] = zap.Any(f.Key, redactValue(f.Interface))
		} else {
			redacted[i] = f
		}
	}
	return redacted
}

type redactingCore struct {
	zapcore.Core
}

// NewRedactingCore wraps an existing zapcore.Core with sensitive field redaction.
func NewRedactingCore(inner zapcore.Core) zapcore.Core {
	return &redactingCore{Core: inner}
}

func (c *redactingCore) With(fields []zapcore.Field) zapcore.Core {
	return &redactingCore{Core: c.Core.With(redactFields(fields))}
}

func (c *redactingCore) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	return c.Core.Write(entry, redactFields(fields))
}

func (c *redactingCore) Check(entry zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if c.Enabled(entry.Level) {
		return ce.AddCore(entry, c)
	}
	return ce
}

// InitializeLogger sets up Uber Zap with Lumberjack log rotation and automatic redaction.
func InitializeLogger() {
	logConfig := config.Global.App

	// Ensure storage/logs directory exists
	logDir := "storage/logs"
	_ = os.MkdirAll(logDir, 0755)

	logFile := filepath.Join(logDir, "app.log")

	// Lumberjack configuration for log rotation
	w := zapcore.AddSync(&lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    10,   // megabytes
		MaxBackups: 5,    // number of rotated backups
		MaxAge:     28,   // days to retain
		Compress:   true, // compress rotated log files
	})

	var level zapcore.Level
	if logConfig.Debug {
		level = zap.DebugLevel
	} else {
		level = zap.InfoLevel
	}

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	baseCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.NewMultiWriteSyncer(zapcore.AddSync(os.Stdout), w),
		level,
	)

	// Wrap in redactingCore
	securedCore := &redactingCore{Core: baseCore}

	Log = zap.New(securedCore, zap.AddCaller())
	zap.ReplaceGlobals(Log)

	Log.Info("Logger initialized successfully with sensitive data redaction", zap.String("level", level.String()))
}
