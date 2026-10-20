package bootstrap

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"institute/config"
	"github.com/fatih/color"
	"github.com/spf13/viper"
)

var (
	ErrMissingAppKey       = errors.New("APP_KEY is required and must not be empty")
	ErrAppKeyTooShort      = errors.New("APP_KEY must provide at least 32 bytes of cryptographic material (256-bit AES/HMAC key)")
	ErrAppKeyLowEntropy    = errors.New("APP_KEY has insufficient entropy or character diversity")
	ErrInvalidPort         = errors.New("APP_PORT must be a valid port number between 1 and 65535")
	ErrMissingDBDriver     = errors.New("DB_DRIVER is required in configuration")
	ErrUnsupportedDBDriver = errors.New("DB_DRIVER must be one of: postgres, mysql, sqlite")
	ErrMissingDBHost       = errors.New("DB_HOST is required for network-based database drivers")
	ErrMissingDBPort       = errors.New("DB_PORT is required for network-based database drivers")
	ErrMissingDBName       = errors.New("DB_DATABASE is required")
	ErrMissingDBUser       = errors.New("DB_USERNAME is required for network-based database drivers")
	ErrMissingCacheHost    = errors.New("CACHE_HOST is required when CACHE_DRIVER is redis")
	ErrMissingCachePort    = errors.New("CACHE_PORT is required when CACHE_DRIVER is redis")
)

// InitializeConfig initializes Viper configuration and populates config.Global.
func InitializeConfig() {
	viper.SetConfigName(".env")
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AutomaticEnv()

	// Set sane operational defaults
	viper.SetDefault("APP_NAME", "institute")
	viper.SetDefault("APP_ENV", "local")
	viper.SetDefault("APP_PORT", "8080")
	viper.SetDefault("APP_DEBUG", true)
	viper.SetDefault("DB_MAX_OPEN_CONNS", 25)
	viper.SetDefault("DB_MAX_IDLE_CONNS", 5)
	viper.SetDefault("DB_CONN_MAX_LIFETIME_MIN", 15)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// In containers or CI environments, .env may not exist; rely on system environment variables
			if os.Getenv("APP_KEY") == "" && os.Getenv("DB_DRIVER") == "" {
				log.Printf("%s .env file not found, reading from system environment variables\n", color.YellowString("⚠️"))
			}
		} else {
			log.Fatalf("%s Error reading .env file: %v", color.RedString("FATAL:"), err)
		}
	}

	PopulateConfig(&config.Global)

	if err := ValidateConfig(&config.Global); err != nil {
		log.Fatalf("%s Configuration validation failed: %v", color.RedString("FATAL:"), err)
	}

	fmt.Printf("%s Configuration loaded and validated successfully (env: %s)\n", color.CyanString("⚙️"), config.Global.App.Env)
}

// PopulateConfig extracts values from Viper into the target Config struct.
func PopulateConfig(cfg *config.Config) {
	cfg.App.Name = viper.GetString("APP_NAME")
	cfg.App.Env = strings.ToLower(viper.GetString("APP_ENV"))
	if cfg.App.Env == "" {
		cfg.App.Env = "local"
	}
	cfg.App.Port = viper.GetString("APP_PORT")
	if cfg.App.Port == "" {
		cfg.App.Port = "8080"
	}
	cfg.App.Debug = viper.GetBool("APP_DEBUG")
	cfg.App.URL = viper.GetString("APP_URL")
	cfg.App.Key = viper.GetString("APP_KEY")

	cfg.Database.Driver = strings.ToLower(viper.GetString("DB_DRIVER"))
	cfg.Database.Host = viper.GetString("DB_HOST")
	cfg.Database.Port = viper.GetString("DB_PORT")
	cfg.Database.Database = viper.GetString("DB_DATABASE")
	cfg.Database.Username = viper.GetString("DB_USERNAME")
	cfg.Database.Password = viper.GetString("DB_PASSWORD")
	cfg.Database.MaxOpenConns = viper.GetInt("DB_MAX_OPEN_CONNS")
	if cfg.Database.MaxOpenConns <= 0 {
		cfg.Database.MaxOpenConns = 25
	}
	cfg.Database.MaxIdleConns = viper.GetInt("DB_MAX_IDLE_CONNS")
	if cfg.Database.MaxIdleConns <= 0 {
		cfg.Database.MaxIdleConns = 5
	}
	cfg.Database.ConnMaxLifetimeMin = viper.GetInt("DB_CONN_MAX_LIFETIME_MIN")
	if cfg.Database.ConnMaxLifetimeMin <= 0 {
		cfg.Database.ConnMaxLifetimeMin = 15
	}

	cfg.Cache.Driver = strings.ToLower(viper.GetString("CACHE_DRIVER"))
	cfg.Cache.Host = viper.GetString("CACHE_HOST")
	cfg.Cache.Port = viper.GetString("CACHE_PORT")
	cfg.Cache.Password = viper.GetString("CACHE_PASSWORD")
}

// ValidateAppKey verifies that APP_KEY provides adequate cryptographic strength (256-bit / 32 bytes)
// for AES-256-GCM encryption and HMAC-SHA256 signing, and rejects trivial or low-entropy keys.
func ValidateAppKey(key string) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return ErrMissingAppKey
	}

	var rawKey []byte
	if strings.HasPrefix(trimmed, "base64:") {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(trimmed, "base64:"))
		if err != nil || len(decoded) < 32 {
			return ErrAppKeyTooShort
		}
		rawKey = decoded
	} else if len(trimmed) == 64 {
		decoded, err := hex.DecodeString(trimmed)
		if err == nil && len(decoded) >= 32 {
			rawKey = decoded
		} else {
			rawKey = []byte(trimmed)
		}
	} else {
		if len(trimmed) < 32 {
			return ErrAppKeyTooShort
		}
		rawKey = []byte(trimmed)
	}

	// Verify entropy / character diversity to reject trivial patterns like "aaaaaaaaaaaaaaaa..."
	uniqueBytes := make(map[byte]struct{})
	for _, b := range rawKey {
		uniqueBytes[b] = struct{}{}
	}
	// For 32-byte cryptographic material, require at least 8 distinct bytes
	if len(uniqueBytes) < 8 {
		return ErrAppKeyLowEntropy
	}

	return nil
}

// ValidateConfig verifies that all mandatory operational variables are set and compliant.
func ValidateConfig(cfg *config.Config) error {
	if err := ValidateAppKey(cfg.App.Key); err != nil {
		return err
	}

	if cfg.App.Port != "" {
		portNum, err := strconv.Atoi(cfg.App.Port)
		if err != nil || portNum < 1 || portNum > 65535 {
			return ErrInvalidPort
		}
	}

	driver := strings.TrimSpace(cfg.Database.Driver)
	if driver == "" {
		return ErrMissingDBDriver
	}

	switch driver {
	case "postgres", "mysql":
		if strings.TrimSpace(cfg.Database.Host) == "" {
			return ErrMissingDBHost
		}
		if strings.TrimSpace(cfg.Database.Port) == "" {
			return ErrMissingDBPort
		}
		if strings.TrimSpace(cfg.Database.Database) == "" {
			return ErrMissingDBName
		}
		if strings.TrimSpace(cfg.Database.Username) == "" {
			return ErrMissingDBUser
		}
	case "sqlite":
		if strings.TrimSpace(cfg.Database.Database) == "" {
			return ErrMissingDBName
		}
	default:
		return fmt.Errorf("%w: received '%s'", ErrUnsupportedDBDriver, driver)
	}

	if cfg.Cache.Driver == "redis" {
		if strings.TrimSpace(cfg.Cache.Host) == "" {
			return ErrMissingCacheHost
		}
		if strings.TrimSpace(cfg.Cache.Port) == "" {
			return ErrMissingCachePort
		}
	}

	return nil
}
