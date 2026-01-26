# Test Runner Dockerfile
# Node.js service for executing Playwright/Cypress tests

FROM node:20-alpine AS base

# Install dependencies for Playwright browsers
RUN apk add --no-cache \
    chromium \
    firefox \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libc6-compat

# Set Playwright to use system browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH=/usr/bin/firefox

# Dependencies stage
FROM base AS deps
WORKDIR /app

COPY services/test-runner/package*.json ./

RUN npm ci --only=production && npm cache clean --force

# Development image
FROM base AS development
WORKDIR /app

COPY services/test-runner/package*.json ./
RUN npm install

# Install Playwright browsers for dev
RUN npx playwright install --with-deps chromium firefox

COPY services/test-runner ./

EXPOSE 3001

CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
WORKDIR /app

COPY services/test-runner/package*.json ./
RUN npm ci

COPY services/test-runner ./

RUN npm run build

# Production image
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Create directories for test artifacts
RUN mkdir -p /app/test-results /app/screenshots /app/videos && \
    chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]
