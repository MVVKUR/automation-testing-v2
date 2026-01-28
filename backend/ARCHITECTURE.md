# Backend Architecture Overview

## 🏗️ Architecture Pattern

The backend follows a **layered architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         FastAPI Application             │
│         (app/main.py)                   │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼────────┐
│   Routers      │    │   Middleware     │
│  (API Layer)   │    │   (CORS, etc)    │
└───────┬────────┘    └──────────────────┘
        │
┌───────▼────────┐
│   Services     │
│ (Business Logic)│
└───────┬────────┘
        │
┌───────▼────────┐
│   Models       │
│  (Data Layer)  │
└───────┬────────┘
        │
┌───────▼────────┐
│   Database     │
│  (SQLAlchemy)  │
└────────────────┘
```

---

## 📁 Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Application settings & configuration
│   │
│   ├── db/                     # Database layer
│   │   ├── __init__.py
│   │   └── database.py         # SQLAlchemy setup, async session management
│   │
│   ├── models/                 # Data models (SQLAlchemy ORM + Pydantic schemas)
│   │   ├── __init__.py
│   │   ├── project.py          # Project model & schemas
│   │   ├── test_case.py        # Test case model & schemas
│   │   ├── scenario.py         # Scenario model & schemas
│   │   ├── step.py             # Step model & schemas
│   │   ├── test_run.py         # Test run model & schemas
│   │   └── step_result.py      # Step result model & schemas
│   │
│   ├── routers/                 # API route handlers
│   │   ├── __init__.py
│   │   ├── projects.py          # Project CRUD operations
│   │   ├── test_cases.py        # Test case management
│   │   ├── scenarios.py         # Scenario management
│   │   ├── steps.py             # Step management
│   │   ├── test_runs.py         # Test execution tracking
│   │   ├── step_results.py      # Step result tracking
│   │   ├── services.py          # Service management
│   │   ├── ai.py                # AI agent integration (proxies to external service)
│   │   ├── mobile.py            # Mobile testing endpoints
│   │   ├── integrations.py      # External integrations (Jira, GitHub)
│   │   └── test_runner.py       # Test execution (Cypress/Playwright)
│   │
│   └── services/                # Business logic layer
│       ├── __init__.py
│       └── test_runner.py       # Test execution service (Cypress/Playwright)
│
├── tests/                       # Test files
│   └── __init__.py
│
├── run.py                       # Application entry point script
├── requirements.txt             # Python dependencies
└── .env                         # Environment variables (not in repo)
```

---

## 🔑 Core Components

### 1. **Application Entry Point** (`app/main.py`)

- **FastAPI Application**: Main application instance
- **Lifespan Management**: Handles startup/shutdown (database initialization)
- **CORS Middleware**: Configured for cross-origin requests
- **Router Registration**: All API routers mounted under `/api` prefix
- **Health Endpoints**: `/health`, `/api/app-info`, `/api/platform`, `/api/db-path`

**Key Features:**
- Async lifespan context manager for startup/shutdown
- All routers prefixed with `/api`
- CORS enabled for all origins (should be restricted in production)

### 2. **Configuration** (`app/config.py`)

**Settings Class** using Pydantic Settings:
- **App Info**: Name, version, debug mode
- **Server**: Host, port
- **Database**: SQLite with platform-specific data directory
- **AI Services**: Anthropic API key, AI agent URL, test runner URL
- **Integrations**: GitHub token, Jira credentials

**Database Path Strategy:**
- Windows: `%APPDATA%/com.autotest.ai/autotest.db`
- macOS: `~/Library/Application Support/com.autotest.ai/autotest.db`
- Linux: `~/.local/share/com.autotest.ai/autotest.db`

### 3. **Database Layer** (`app/db/database.py`)

- **Async SQLAlchemy**: Uses `aiosqlite` for async SQLite operations
- **Session Management**: `AsyncSessionLocal` factory with dependency injection
- **Base Model**: `Base` class for all ORM models
- **Initialization**: `init_db()` creates all tables on startup

**Key Features:**
- Async/await pattern throughout
- Dependency injection via `get_db()` for route handlers
- Automatic table creation on startup

### 4. **Data Models** (`app/models/`)

Each model file contains:
- **SQLAlchemy ORM Model**: Database table definition
- **Pydantic Schemas**: Request/Response models
  - `Create`: For POST requests
  - `Update`: For PUT/PATCH requests
  - `Response`: For API responses
  - Additional schemas as needed (Filter, Stats, etc.)

**Model Relationships:**
```
Project (1) ──→ (N) TestCase
TestCase (1) ──→ (N) Scenario
Scenario (1) ──→ (N) Step
TestRun (1) ──→ (N) StepResult
```

**Models:**
- **Project**: Top-level container for test automation projects
- **TestCase**: Test case definitions with metadata (priority, category, status)
- **Scenario**: Test scenarios within a test case
- **Step**: Individual test steps (navigate, click, type, verify, wait)
- **TestRun**: Execution records for test runs
- **StepResult**: Results for individual step executions

### 5. **Routers** (`app/routers/`)

**Standard CRUD Pattern:**
Most routers follow RESTful conventions:
- `POST /api/{resource}` - Create
- `GET /api/{resource}` - List all
- `GET /api/{resource}/{id}` - Get by ID
- `PUT /api/{resource}/{id}` - Update
- `DELETE /api/{resource}/{id}` - Delete
- Additional endpoints for specific operations

**Router Breakdown:**

| Router | Prefix | Purpose |
|--------|--------|---------|
| `projects` | `/api/projects` | Project management, connection validation |
| `test_cases` | `/api/test-cases` | Test case CRUD, filtering, statistics |
| `scenarios` | `/api/scenarios` | Scenario management |
| `steps` | `/api/steps` | Step management |
| `test_runs` | `/api/test-runs` | Test run tracking |
| `step_results` | `/api/step-results` | Step result tracking |
| `services` | `/api/services` | Service management |
| `ai` | `/api/ai` | AI agent proxy endpoints |
| `mobile` | `/api/mobile` | Mobile testing (device control, screenshots) |
| `integrations` | `/api/integrations` | External integrations (Jira, GitHub) |
| `test_runner` | `/api/test-runner` | Test execution (Cypress/Playwright) |

**Special Routers:**

1. **AI Router** (`ai.py`):
   - Proxies requests to external AI agent service
   - Endpoints: `/analyze-code`, `/generate-tests`, `/parse-requirements`
   - Web automation: `/web/analyze`, `/web/find-element`, `/web/suggest-step`
   - Uses `httpx` for async HTTP client

2. **Test Runner Router** (`test_runner.py`):
   - Executes Cypress and Playwright tests
   - Converts test steps to test specs
   - Runs tests in temporary directories
   - Returns execution results

3. **Mobile Router** (`mobile.py`):
   - Device management (list, connect)
   - Screenshot capture
   - Input actions (tap, swipe, type, key events)
   - Uses ADB for Android automation

4. **Integrations Router** (`integrations.py`):
   - Jira integration (create issues, search)
   - GitHub integration (create issues, PRs)

### 6. **Services Layer** (`app/services/`)

**Test Runner Service** (`test_runner.py`):
- **Purpose**: Execute Cypress and Playwright tests
- **Features**:
  - Converts test steps to framework-specific specs
  - Creates temporary test directories
  - Runs tests via `npx` subprocess
  - Captures stdout/stderr
  - Handles timeouts and errors
- **Methods**:
  - `run_cypress()`: Execute Cypress test from spec
  - `run_playwright()`: Execute Playwright test from spec
  - `run_steps_as_cypress()`: Convert steps to Cypress and run
  - `run_steps_as_playwright()`: Convert steps to Playwright and run
- **Singleton Pattern**: Global `test_runner` instance

---

## 🔄 Request Flow

### Typical API Request Flow:

```
1. Client Request
   ↓
2. FastAPI Router (app/routers/*.py)
   ↓
3. Dependency Injection (get_db())
   ↓
4. Service Layer (if needed) (app/services/*.py)
   ↓
5. Database Operations (SQLAlchemy ORM)
   ↓
6. Response (Pydantic Schema)
   ↓
7. Client Response
```

### Example: Creating a Project

```
POST /api/projects
  ↓
projects.py::create_project()
  ↓
get_db() → AsyncSession
  ↓
Project model → SQLAlchemy
  ↓
Database INSERT
  ↓
ProjectResponse schema
  ↓
JSON Response
```

---

## 🔌 External Dependencies

### Internal Services (Microservices):
- **AI Agent Service**: `http://127.0.0.1:8001` (default)
  - Code analysis
  - Test generation
  - Web page analysis
- **Test Runner Service**: `http://127.0.0.1:8002` (default, not currently used)

### External APIs:
- **Anthropic API**: For AI capabilities (via AI agent service)
- **Jira API**: Issue tracking integration
- **GitHub API**: Repository integration

### System Dependencies:
- **Node.js/npx**: Required for Cypress/Playwright execution
- **ADB**: Required for Android mobile testing

---

## 🗄️ Database Schema

**SQLite Database** with the following tables:

1. **projects**
   - `id` (PK, UUID)
   - `name`, `description`, `app_url`, `repo_url`, `project_type`
   - `created_at`, `updated_at`

2. **test_cases**
   - `id` (PK, UUID)
   - `project_id` (FK → projects.id, CASCADE DELETE)
   - `name`, `description`, `category`, `priority`, `test_type`, `status`
   - `created_at`, `updated_at`

3. **scenarios**
   - `id` (PK, UUID)
   - `test_case_id` (FK → test_cases.id, CASCADE DELETE)
   - `name`, `description`, `target_url`
   - `created_at`, `updated_at`

4. **steps**
   - `id` (PK, UUID)
   - `scenario_id` (FK → scenarios.id, CASCADE DELETE)
   - `order`, `type`, `config` (JSON), `description`
   - `created_at`, `updated_at`

5. **test_runs**
   - `id` (PK, UUID)
   - `test_case_id` (FK → test_cases.id)
   - `status`, `started_at`, `completed_at`, `result`
   - `created_at`, `updated_at`

6. **step_results**
   - `id` (PK, UUID)
   - `test_run_id` (FK → test_runs.id)
   - `step_id` (FK → steps.id)
   - `status`, `result`, `error_message`, `screenshot`
   - `created_at`, `updated_at`

**Cascade Deletes:**
- Deleting a project deletes all test cases
- Deleting a test case deletes all scenarios
- Deleting a scenario deletes all steps

---

## 🚀 Key Features

### 1. **Async/Await Throughout**
- All database operations are async
- HTTP client calls are async
- Subprocess execution is async

### 2. **Type Safety**
- Pydantic models for request/response validation
- SQLAlchemy type hints
- Type checking support

### 3. **Dependency Injection**
- Database sessions via FastAPI dependencies
- Clean separation of concerns

### 4. **Error Handling**
- HTTPException for API errors
- Graceful error responses
- External service error handling

### 5. **Platform Support**
- Cross-platform database paths
- Platform detection endpoints
- Mobile testing support (Android/iOS)

---

## 📦 Technology Stack

| Component | Technology |
|-----------|-----------|
| **Web Framework** | FastAPI |
| **Database** | SQLite (via aiosqlite) |
| **ORM** | SQLAlchemy (async) |
| **Validation** | Pydantic v2 |
| **HTTP Client** | httpx |
| **Test Frameworks** | Cypress, Playwright (via npx) |
| **Mobile Testing** | ADB (Android Debug Bridge) |
| **Server** | Uvicorn |

---

## 🔐 Security Considerations

1. **CORS**: Currently allows all origins (`*`) - should be restricted in production
2. **API Keys**: Stored in environment variables (`.env`)
3. **Database**: SQLite file with platform-specific permissions
4. **Input Validation**: Pydantic models validate all inputs
5. **SQL Injection**: Protected by SQLAlchemy ORM

---

## 🧪 Testing Architecture

- **Test Execution**: Via external test runners (Cypress/Playwright)
- **Test Storage**: Test cases, scenarios, and steps stored in database
- **Test Results**: Tracked in `test_runs` and `step_results` tables
- **AI Integration**: AI can generate and analyze tests

---

## 📝 API Design Patterns

1. **RESTful Conventions**: Standard HTTP methods and status codes
2. **Resource-Based URLs**: `/api/{resource}/{id}`
3. **Request/Response Models**: Separate Pydantic schemas
4. **Error Responses**: Consistent error format
5. **Health Checks**: `/health` endpoint for monitoring

---

## 🔄 Data Flow Examples

### Creating a Test Case with Steps:

```
1. POST /api/projects → Create project
2. POST /api/test-cases → Create test case (linked to project)
3. POST /api/scenarios → Create scenario (linked to test case)
4. POST /api/steps → Create steps (linked to scenario)
5. POST /api/test-runs → Start test run
6. POST /api/test-runner/run-steps → Execute test
7. POST /api/step-results → Record results
```

### AI-Powered Test Generation:

```
1. POST /api/ai/analyze-code → Analyze codebase
2. POST /api/ai/generate-tests → Generate test code
3. POST /api/ai/parse-requirements → Convert requirements to test cases
4. POST /api/test-cases → Save generated test cases
```

---

## 🎯 Architecture Strengths

1. ✅ **Clear Separation of Concerns**: Layers are well-defined
2. ✅ **Async/Await**: Modern Python async patterns
3. ✅ **Type Safety**: Pydantic + SQLAlchemy type hints
4. ✅ **Scalability**: Can easily add new routers/services
5. ✅ **Maintainability**: Consistent patterns across codebase
6. ✅ **Extensibility**: Easy to add new integrations

## ⚠️ Areas for Improvement

1. ⚠️ **CORS Configuration**: Should restrict origins in production
2. ⚠️ **Error Handling**: Could be more consistent across routers
3. ⚠️ **Logging**: No structured logging framework
4. ⚠️ **Authentication**: No authentication/authorization layer
5. ⚠️ **Validation**: Some business logic validation could be in services
6. ⚠️ **Testing**: No unit/integration tests visible

---

## 📚 Summary

This is a **well-structured FastAPI backend** for an automation testing platform. It follows modern Python async patterns, uses SQLAlchemy for data persistence, and provides a clean REST API for managing test automation projects, cases, scenarios, and executions. The architecture supports AI-powered test generation, multiple test frameworks (Cypress/Playwright), mobile testing, and external integrations (Jira, GitHub).
