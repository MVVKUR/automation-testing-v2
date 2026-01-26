# AutoTest AI

AI-powered test automation desktop application built with Tauri, Next.js, and Rust.

## Features

- **AI-Powered Test Generation**: Generate test cases automatically using Claude AI
- **Visual Scenario Builder**: Create test scenarios with a drag-and-drop interface
- **Multi-Runner Support**: Execute tests with Cypress or Playwright
- **Cross-Platform**: Runs on macOS, Windows, and Linux
- **GitHub & Jira Integration**: Sync issues and test cases with your tools
- **Real-Time Execution**: Watch test runs with live progress updates
- **Offline Capable**: Works without internet (except for AI features)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Tauri Desktop App                   │
│  ┌───────────────────┐     ┌──────────────────────────┐ │
│  │   Next.js Frontend │     │     Rust Backend        │ │
│  │   - React UI       │ ◄── │     - SQLite DB         │ │
│  │   - Zustand State  │     │     - Service Manager   │ │
│  │   - TailwindCSS    │     │     - IPC Commands      │ │
│  └─────────┬─────────┘     └──────────┬──────────────┘ │
└─────────────┼──────────────────────────┼────────────────┘
              │                          │
      ┌───────▼────────┐         ┌───────▼────────┐
      │   AI Agent     │         │  Test Runner   │
      │   (Python)     │         │  (Node.js)     │
      │   Port 8001    │         │  Port 8002     │
      └────────────────┘         └────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Rust 1.77+
- Python 3.11+ (for AI Agent)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/autotest-ai.git
cd autotest-ai

# Install frontend dependencies
cd frontend
npm install

# Start development
npm run tauri:dev
```

### Start Backend Services

```bash
# Terminal 1: AI Agent (Python)
cd services/ai-agent
pip install -r requirements.txt
uvicorn main:app --port 8001

# Terminal 2: Test Runner (Node.js)
cd services/test-runner
npm install
npm run dev
```

## Project Structure

```
autotest-ai/
├── frontend/                 # Tauri + Next.js app
│   ├── src/                  # React components and pages
│   │   ├── app/              # Next.js app router pages
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts
│   │   ├── lib/              # Utilities and Tauri API
│   │   └── stores/           # Zustand state stores
│   ├── src-tauri/            # Rust backend
│   │   ├── src/
│   │   │   ├── commands/     # Tauri IPC commands
│   │   │   ├── db/           # SQLite database
│   │   │   ├── models/       # Data models
│   │   │   └── services/     # External service clients
│   │   └── Cargo.toml
│   └── e2e/                  # Playwright E2E tests
├── services/
│   ├── ai-agent/             # Python AI service
│   └── test-runner/          # Node.js test execution service
├── docs/                     # Documentation
└── .github/workflows/        # CI/CD pipelines
```

## Development

### Frontend Development

```bash
cd frontend

# Development mode
npm run tauri:dev

# Lint
npm run lint

# Run E2E tests
npm test

# Build for production
npm run tauri:build
```

### Rust Backend

```bash
cd frontend/src-tauri

# Check code
cargo clippy

# Run tests
cargo test

# Format code
cargo fmt
```

## Testing

### E2E Tests (Playwright)

```bash
cd frontend

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run headed (visible browser)
npm run test:headed

# Debug mode
npm run test:debug
```

### Test Files

- `e2e/app.spec.ts` - Core application tests
- `e2e/projects.spec.ts` - Project management tests
- `e2e/test-cases.spec.ts` - Test case CRUD tests
- `e2e/runs.spec.ts` - Test execution tests
- `e2e/scenarios.spec.ts` - Scenario builder tests

## Building

### Development Build

```bash
cd frontend
npm run tauri:dev
```

### Production Build

```bash
cd frontend
npm run tauri:build
```

Build outputs:
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/` or `nsis/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` or `deb/`

## Configuration

### Environment Variables

Create `frontend/.env.local`:

```env
# AI Agent
AI_AGENT_URL=http://localhost:8001
ANTHROPIC_API_KEY=your-api-key

# Test Runner
TEST_RUNNER_URL=http://localhost:8002

# Integrations (optional)
GITHUB_TOKEN=your-github-token
JIRA_HOST=your-org.atlassian.net
JIRA_EMAIL=your-email
JIRA_API_TOKEN=your-jira-token
```

## Services

| Service | Description | Port |
|---------|-------------|------|
| Desktop App | Tauri + Next.js | - |
| AI Agent | Python FastAPI | 8001 |
| Test Runner | Node.js Express | 8002 |

## API Reference

### Tauri Commands

The app exposes these IPC commands from Rust to the frontend:

#### Project Management
- `create_project` / `get_project` / `list_projects` / `delete_project`

#### Test Cases
- `create_test_case` / `get_test_case` / `list_test_cases` / `update_test_case`

#### Scenarios & Steps
- `create_scenario` / `get_scenario` / `list_scenarios_by_test_case`
- `create_step` / `reorder_steps` / `bulk_create_steps`

#### Test Execution
- `runner_execute_tests` / `runner_get_execution` / `runner_cancel_execution`

#### AI Features
- `ai_analyze_code` / `ai_generate_tests` / `ai_parse_requirements`

#### Integrations
- `jira_get_issue` / `jira_create_issue` / `jira_search_issues`
- `github_get_issue` / `github_create_issue` / `github_list_issues`

## Documentation

- [Code Signing Guide](./docs/CODE_SIGNING.md) - Set up code signing for distribution

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Code Style

- **TypeScript**: ESLint + Prettier
- **Rust**: `cargo fmt` + `cargo clippy`
- **Python**: Black + Ruff

## Troubleshooting

### macOS: "App is damaged"

```bash
xattr -cr "/Applications/AutoTest AI.app"
```

### Services not connecting

1. Check that AI Agent is running on port 8001
2. Check that Test Runner is running on port 8002
3. Verify firewall settings allow local connections

### Database issues

The SQLite database is stored at:
- macOS: `~/Library/Application Support/com.autotest.ai/`
- Windows: `%APPDATA%/com.autotest.ai/`
- Linux: `~/.local/share/com.autotest.ai/`

## License

MIT License - see [LICENSE](LICENSE) for details.
