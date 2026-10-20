package tests

import (
	"errors"
	"testing"

	"institute/app/services"
)

func TestSecurity_PasswordHashing(t *testing.T) {
	password := "SecureAdminPass2026!"

	hash, err := services.HashPassword(password)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if hash == password {
		t.Fatalf("password hash must not be equal to raw password")
	}

	// Verify matching password
	if !services.CheckPassword(password, hash) {
		t.Fatalf("expected correct password to match hash")
	}

	// Verify non-matching password
	if services.CheckPassword("WrongPassword123!", hash) {
		t.Fatalf("wrong password should not match hash")
	}

	// Verify password length enforcement
	_, err = services.HashPassword("short")
	if !errors.Is(err, services.ErrPasswordTooShort) {
		t.Fatalf("expected ErrPasswordTooShort for passwords under 8 characters, got: %v", err)
	}
}

func TestSecurity_TokenGeneration(t *testing.T) {
	rawToken, tokenHash, err := services.GenerateToken()
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// 32 bytes hex encoded = 64 characters
	if len(rawToken) != 64 {
		t.Fatalf("expected raw token length 64, got %d", len(rawToken))
	}
	if len(tokenHash) != 64 {
		t.Fatalf("expected token hash length 64, got %d", len(tokenHash))
	}

	if rawToken == tokenHash {
		t.Fatalf("token hash must not be equal to raw token")
	}

	// Verify HashToken deterministic calculation
	recalculatedHash := services.HashToken(rawToken)
	if recalculatedHash != tokenHash {
		t.Fatalf("token hash mismatch: %s != %s", recalculatedHash, tokenHash)
	}
}
