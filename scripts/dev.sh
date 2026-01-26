#!/bin/bash
# =============================================================================
# Development Startup Script
# =============================================================================
# This script starts all services in development mode with hot reload.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=== Automation Testing E2E - Development Mode ===${NC}"
echo ""

# Check for required tools
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose v2 is not installed${NC}"
        exit 1
    fi

    echo -e "${GREEN}All requirements met${NC}"
    echo ""
}

# Load environment variables
load_env() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        echo -e "${YELLOW}Loading environment from .env${NC}"
        export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
    else
        echo -e "${YELLOW}Warning: .env file not found, using defaults${NC}"
        echo -e "${YELLOW}Run: cp .env.example .env${NC}"
    fi
    echo ""
}

# Start infrastructure services
start_infrastructure() {
    echo -e "${BLUE}Starting infrastructure services...${NC}"

    cd "$PROJECT_ROOT"
    docker compose up -d postgres redis qdrant minio

    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

    # Wait for PostgreSQL
    echo -n "  PostgreSQL: "
    until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-ate2e}" > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}Ready${NC}"

    # Wait for Redis
    echo -n "  Redis: "
    until docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-redis_secret}" ping > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}Ready${NC}"

    # Wait for Qdrant
    echo -n "  Qdrant: "
    until curl -s http://localhost:${QDRANT_PORT:-6333}/health > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}Ready${NC}"

    # Wait for MinIO
    echo -n "  MinIO: "
    until curl -s http://localhost:${MINIO_PORT:-9000}/minio/health/live > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}Ready${NC}"

    echo ""
}

# Start application services
start_services() {
    local mode="${1:-docker}"

    if [ "$mode" == "docker" ]; then
        echo -e "${BLUE}Starting application services in Docker...${NC}"
        cd "$PROJECT_ROOT"
        docker compose up -d core-api ai-agent test-runner frontend

        echo -e "${YELLOW}Waiting for application services...${NC}"
        sleep 5

    elif [ "$mode" == "local" ]; then
        echo -e "${BLUE}Starting application services locally...${NC}"
        echo -e "${YELLOW}Please start each service manually:${NC}"
        echo ""
        echo "  Core API:"
        echo "    cd $PROJECT_ROOT/services/core-api && npm run dev"
        echo ""
        echo "  AI Agent:"
        echo "    cd $PROJECT_ROOT/services/ai-agent && poetry run uvicorn app.main:app --reload"
        echo ""
        echo "  Test Runner:"
        echo "    cd $PROJECT_ROOT/services/test-runner && npm run dev"
        echo ""
        echo "  Frontend:"
        echo "    cd $PROJECT_ROOT/frontend && npm run dev"
        echo ""
    fi
}

# Print service URLs
print_urls() {
    echo -e "${GREEN}=== Services are running ===${NC}"
    echo ""
    echo -e "  ${BLUE}Frontend:${NC}       http://localhost:${FRONTEND_PORT:-3002}"
    echo -e "  ${BLUE}Core API:${NC}       http://localhost:${CORE_API_PORT:-3000}"
    echo -e "  ${BLUE}AI Agent:${NC}       http://localhost:${AI_AGENT_PORT:-8000}"
    echo -e "  ${BLUE}Test Runner:${NC}    http://localhost:${TEST_RUNNER_PORT:-3001}"
    echo ""
    echo -e "  ${BLUE}MinIO Console:${NC}  http://localhost:${MINIO_CONSOLE_PORT:-9001}"
    echo -e "    User: ${MINIO_ROOT_USER:-minio_admin}"
    echo -e "    Pass: ${MINIO_ROOT_PASSWORD:-minio_secret}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  docker compose logs -f [service]  # View logs"
    echo "  docker compose down               # Stop all services"
    echo "  docker compose ps                 # List running services"
    echo ""
}

# Show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --all, -a       Start all services in Docker (default)"
    echo "  --infra, -i     Start only infrastructure services"
    echo "  --local, -l     Start infrastructure in Docker, run apps locally"
    echo "  --down, -d      Stop all services"
    echo "  --logs, -L      Show logs for all services"
    echo "  --help, -h      Show this help message"
    echo ""
}

# Main function
main() {
    local mode="all"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --all|-a)
                mode="all"
                shift
                ;;
            --infra|-i)
                mode="infra"
                shift
                ;;
            --local|-l)
                mode="local"
                shift
                ;;
            --down|-d)
                echo -e "${YELLOW}Stopping all services...${NC}"
                cd "$PROJECT_ROOT"
                docker compose down
                echo -e "${GREEN}All services stopped${NC}"
                exit 0
                ;;
            --logs|-L)
                cd "$PROJECT_ROOT"
                docker compose logs -f
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done

    check_requirements
    load_env
    start_infrastructure

    case $mode in
        all)
            start_services "docker"
            ;;
        local)
            start_services "local"
            ;;
        infra)
            echo -e "${GREEN}Infrastructure services are running${NC}"
            echo -e "${YELLOW}Start application services manually${NC}"
            ;;
    esac

    print_urls
}

# Run main function
main "$@"
