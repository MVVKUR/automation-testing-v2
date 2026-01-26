# Core API Dockerfile
# Rust backend service for the automation testing platform

# Build stage
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app

# Copy Cargo files first for dependency caching
COPY services/core-api/Cargo.toml services/core-api/Cargo.lock* ./

# Create a dummy main.rs to build dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy the actual source code
COPY services/core-api/src ./src

# Build the application
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM alpine:3.19 AS production

# Install runtime dependencies
RUN apk add --no-cache libgcc openssl ca-certificates curl

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/core-api /app/core-api

# Change ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["./core-api"]
