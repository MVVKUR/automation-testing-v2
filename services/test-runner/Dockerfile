# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY cypress.config.ts ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install dependencies for Cypress
RUN apt-get update && apt-get install -y \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    libvulkan1 \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Cypress binary
RUN npx cypress install

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/cypress.config.ts ./

# Create directories for Cypress
RUN mkdir -p cypress/e2e cypress/fixtures cypress/support cypress/videos cypress/screenshots \
    && chown -R appuser:appuser /app

# Copy Cypress support files if they exist
COPY cypress/support ./cypress/support/

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=8082
ENV CYPRESS_CACHE_FOLDER=/app/.cache/Cypress

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8082/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start command
CMD ["node", "dist/index.js"]
