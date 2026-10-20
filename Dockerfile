# Build Stage
FROM golang:1.26.3-alpine AS builder

WORKDIR /app

# Copy source code and vendored dependencies
COPY . .

# Build the application with vendored dependencies
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o main main.go

# Production Stage
FROM alpine:latest

WORKDIR /app

# Copy binary and static assets
COPY --from=builder /app/main .
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env.example .env

# Create storage directories
RUN mkdir -p storage/logs storage/uploads storage/framework/cache

# Expose port
EXPOSE 8080

CMD ["./main"]
