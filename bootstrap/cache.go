package bootstrap

import (
	"context"
	"fmt"
	"time"

	"institute/config"
	"github.com/fatih/color"
	"github.com/redis/go-redis/v9"
)

var Redis *redis.Client
var Ctx = context.Background()

// InitializeCache connects to Redis using configured credentials and connection timeouts.
func InitializeCache() {
	cacheConfig := config.Global.Cache

	if cacheConfig.Driver != "redis" {
		fmt.Printf("%s Cache driver is '%s', skipping Redis initialization\n", color.YellowString("⚠️"), cacheConfig.Driver)
		return
	}

	Redis = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", cacheConfig.Host, cacheConfig.Port),
		Password:     cacheConfig.Password,
		DB:           0,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     20,
		MinIdleConns: 5,
	})

	// Test initial connection with timeout
	pingCtx, cancel := context.WithTimeout(Ctx, 3*time.Second)
	defer cancel()

	_, err := Redis.Ping(pingCtx).Result()
	if err != nil {
		fmt.Printf("%s Redis connection failed: %v\n", color.YellowString("⚠️"), err)
		return
	}

	fmt.Printf("%s Redis connected successfully\n", color.CyanString("⚙️"))
}

// CheckCacheHealth checks whether Redis cache is operational for readiness checks.
func CheckCacheHealth(ctx context.Context) error {
	if config.Global.Cache.Driver != "redis" {
		return nil // Non-redis cache drivers are not checked via network
	}
	if Redis == nil {
		return fmt.Errorf("redis cache client is not initialized")
	}
	return Redis.Ping(ctx).Err()
}

// Cache Wrapper (Laravel-style)
func CacheGet(key string) (string, error) {
	if Redis == nil {
		return "", fmt.Errorf("cache client is not initialized")
	}
	return Redis.Get(Ctx, key).Result()
}

func CacheSet(key string, value interface{}, expiration time.Duration) error {
	if Redis == nil {
		return fmt.Errorf("cache client is not initialized")
	}
	return Redis.Set(Ctx, key, value, expiration).Err()
}

func CacheForget(key string) error {
	if Redis == nil {
		return fmt.Errorf("cache client is not initialized")
	}
	return Redis.Del(Ctx, key).Err()
}
