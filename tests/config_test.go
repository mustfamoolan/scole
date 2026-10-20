package tests

import (
	"errors"
	"testing"

	"institute/bootstrap"
	"institute/config"
)

func validTestConfig() config.Config {
	return config.Config{
		App: config.AppConfig{
			Name:  "institute-test",
			Env:   "testing",
			Port:  "8080",
			Debug: true,
			Key:   "0bc7f2fffaecc57d4852caa9e4511f27",
		},
		Database: config.DatabaseConfig{
			Driver:             "postgres",
			Host:               "127.0.0.1",
			Port:               "5433",
			Database:           "institute_test",
			Username:           "postgres",
			Password:           "secret",
			MaxOpenConns:       10,
			MaxIdleConns:       2,
			ConnMaxLifetimeMin: 5,
		},
		Cache: config.CacheConfig{
			Driver:   "redis",
			Host:     "127.0.0.1",
			Port:     "6379",
			Password: "",
		},
	}
}

func TestValidateConfig_Valid(t *testing.T) {
	cfg := validTestConfig()
	if err := bootstrap.ValidateConfig(&cfg); err != nil {
		t.Fatalf("expected valid config to pass, got: %v", err)
	}
}

func TestValidateConfig_MissingAppKey(t *testing.T) {
	cfg := validTestConfig()
	cfg.App.Key = ""
	err := bootstrap.ValidateConfig(&cfg)
	if !errors.Is(err, bootstrap.ErrMissingAppKey) {
		t.Fatalf("expected ErrMissingAppKey, got: %v", err)
	}
}

func TestValidateConfig_AppKeyTooShort(t *testing.T) {
	cfg := validTestConfig()
	cfg.App.Key = "short-key-less-than-32-bytes"
	err := bootstrap.ValidateConfig(&cfg)
	if !errors.Is(err, bootstrap.ErrAppKeyTooShort) {
		t.Fatalf("expected ErrAppKeyTooShort, got: %v", err)
	}
}

func TestValidateConfig_AppKeyEntropyAndFormats(t *testing.T) {
	testCases := []struct {
		name        string
		key         string
		expectedErr error
	}{
		{
			name:        "16 chars is no longer enough (requires 32 bytes for 256-bit AES/HMAC)",
			key:         "1234567890123456",
			expectedErr: bootstrap.ErrAppKeyTooShort,
		},
		{
			name:        "32 chars with single repeated char has zero entropy",
			key:         "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			expectedErr: bootstrap.ErrAppKeyLowEntropy,
		},
		{
			name:        "32 chars with low distinct chars (<8 unique)",
			key:         "12341234123412341234123412341234",
			expectedErr: bootstrap.ErrAppKeyLowEntropy,
		},
		{
			name:        "valid 32-byte hex key with high diversity",
			key:         "0bc7f2fffaecc57d4852caa9e4511f27",
			expectedErr: nil,
		},
		{
			name:        "valid base64 encoded 32-byte key",
			key:         "base64:c29tZXJhbmRvbTMyeWVhcmxvbmcxMjM0NTY3ODkwMTI=",
			expectedErr: nil,
		},
		{
			name:        "base64 encoded key decoding to less than 32 bytes",
			key:         "base64:c2hvcnQtdmFsdWU=",
			expectedErr: bootstrap.ErrAppKeyTooShort,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := validTestConfig()
			cfg.App.Key = tc.key
			err := bootstrap.ValidateConfig(&cfg)
			if tc.expectedErr == nil {
				if err != nil {
					t.Fatalf("expected valid key to pass, got error: %v", err)
				}
			} else {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("expected error %v, got %v", tc.expectedErr, err)
				}
			}
		})
	}
}

func TestValidateConfig_InvalidPort(t *testing.T) {
	invalidPorts := []string{"abc", "-1", "0", "70000"}
	for _, port := range invalidPorts {
		cfg := validTestConfig()
		cfg.App.Port = port
		err := bootstrap.ValidateConfig(&cfg)
		if !errors.Is(err, bootstrap.ErrInvalidPort) {
			t.Fatalf("port %s: expected ErrInvalidPort, got: %v", port, err)
		}
	}
}

func TestValidateConfig_MissingDBDriver(t *testing.T) {
	cfg := validTestConfig()
	cfg.Database.Driver = ""
	err := bootstrap.ValidateConfig(&cfg)
	if !errors.Is(err, bootstrap.ErrMissingDBDriver) {
		t.Fatalf("expected ErrMissingDBDriver, got: %v", err)
	}
}

func TestValidateConfig_UnsupportedDBDriver(t *testing.T) {
	cfg := validTestConfig()
	cfg.Database.Driver = "oracle"
	err := bootstrap.ValidateConfig(&cfg)
	if !errors.Is(err, bootstrap.ErrUnsupportedDBDriver) {
		t.Fatalf("expected ErrUnsupportedDBDriver, got: %v", err)
	}
}

func TestValidateConfig_MissingNetworkDBFields(t *testing.T) {
	// Missing Host
	cfgHost := validTestConfig()
	cfgHost.Database.Host = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgHost), bootstrap.ErrMissingDBHost) {
		t.Fatalf("expected ErrMissingDBHost")
	}

	// Missing Port
	cfgPort := validTestConfig()
	cfgPort.Database.Port = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgPort), bootstrap.ErrMissingDBPort) {
		t.Fatalf("expected ErrMissingDBPort")
	}

	// Missing Database Name
	cfgName := validTestConfig()
	cfgName.Database.Database = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgName), bootstrap.ErrMissingDBName) {
		t.Fatalf("expected ErrMissingDBName")
	}

	// Missing Username
	cfgUser := validTestConfig()
	cfgUser.Database.Username = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgUser), bootstrap.ErrMissingDBUser) {
		t.Fatalf("expected ErrMissingDBUser")
	}
}

func TestValidateConfig_SQLiteDriver(t *testing.T) {
	cfg := validTestConfig()
	cfg.Database.Driver = "sqlite"
	cfg.Database.Database = "test.db"
	cfg.Database.Host = ""
	cfg.Database.Port = ""
	cfg.Database.Username = ""

	if err := bootstrap.ValidateConfig(&cfg); err != nil {
		t.Fatalf("expected sqlite config to pass, got: %v", err)
	}
}

func TestValidateConfig_MissingRedisCacheFields(t *testing.T) {
	cfgHost := validTestConfig()
	cfgHost.Cache.Host = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgHost), bootstrap.ErrMissingCacheHost) {
		t.Fatalf("expected ErrMissingCacheHost")
	}

	cfgPort := validTestConfig()
	cfgPort.Cache.Port = ""
	if !errors.Is(bootstrap.ValidateConfig(&cfgPort), bootstrap.ErrMissingCachePort) {
		t.Fatalf("expected ErrMissingCachePort")
	}
}
