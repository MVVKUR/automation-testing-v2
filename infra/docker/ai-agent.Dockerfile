# AI Agent Dockerfile
# Python-based AI service for test generation and analysis

FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Development image
FROM base AS development

# Install poetry for dependency management
RUN pip install poetry

# Copy dependency files
COPY services/ai-agent/pyproject.toml services/ai-agent/poetry.lock* ./

# Install dependencies (including dev dependencies)
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi

# Copy source code
COPY services/ai-agent ./

EXPOSE 8000

# Start development server with hot reload
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Builder stage
FROM base AS builder

RUN pip install poetry

COPY services/ai-agent/pyproject.toml services/ai-agent/poetry.lock* ./

# Export requirements and install
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes && \
    pip install -r requirements.txt

# Production image
FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 python && \
    useradd --system --uid 1001 --gid python pyuser

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY services/ai-agent/src ./src

# Change ownership
RUN chown -R pyuser:python /app

USER pyuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
