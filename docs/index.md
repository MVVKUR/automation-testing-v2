---
layout: default
title: Home
---

# AutoTest AI

**AI-powered test automation for modern development teams**

Generate, manage, and execute test cases with the power of AI. Built as a cross-platform desktop application that integrates seamlessly with your workflow.

[Get Started](#quick-start){: .btn .btn-primary }
[View on GitHub](https://github.com/MVVKUR/automation-testing-v2){: .btn }

---

## User Interface

### Dashboard
The main dashboard provides quick access to all testing options:

| Option | Description |
|--------|-------------|
| **Connect URL** | Test a running web app by entering its URL |
| **GitHub** | Clone & test repository from GitHub |
| **GitLab** | Clone & test repository from GitLab |
| **Upload ZIP** | Drag & drop project archive |
| **Android** | Test APK on emulator or device |
| **iOS** | Test on simulator or device |

### Settings
Configure your testing environment:

- **Test Runner** - Set test runner URL and default browser (Chrome, Firefox, etc.)
- **Headless Mode** - Run tests without visible browser
- **AI Configuration** - Select AI provider (Anthropic Claude) and enable self-healing selectors
- **Appearance** - Light/Dark theme toggle

### Connect to Running App
The connection dialog allows you to:
1. Enter your application's URL
2. Optionally name your project
3. Choose between standard testing or MCP-powered testing (Beta)

---

## Features

### Web Testing
Test web applications directly in the browser with multiple connection options:
- **Connect URL** - Test a running web app by entering its URL
- **GitHub Integration** - Clone and test repositories directly
- **GitLab Integration** - Clone and test GitLab repositories
- **Upload ZIP** - Drag and drop project archives

### Mobile Testing
Test native Android and iOS applications:
- **Android** - Test APK on emulator or physical device via ADB
- **iOS** - Test on simulator or device

### AI-Powered Test Generation
Automatically generate comprehensive test cases using Claude AI. Simply describe your requirements or point to your code, and let AI do the heavy lifting.

### Visual Scenario Builder
Create test scenarios with an intuitive drag-and-drop interface. No coding required for building complex test flows.

### Multi-Runner Support
Execute tests with your preferred framework - supports both **Cypress** and **Playwright** out of the box.

### Cross-Platform
Runs natively on **macOS**, **Windows**, and **Linux**. One codebase, all platforms.

### Self-Healing Selectors
AI-powered selector healing automatically fixes broken element selectors when the UI changes.

### MCP Integration (Beta)
Model Context Protocol support for advanced AI-browser interactions and testing automation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Desktop App                         │
│  ┌───────────────────┐     ┌──────────────────────────┐ │
│  │   Next.js Frontend │     │     Backend             │ │
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

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Python** 3.11+ (for AI Agent)
- **Anthropic API Key** (for AI features)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/MVVKUR/automation-testing-v2.git
   cd autotest-ai
   ```

2. **Install frontend dependencies**

   ```bash
   cd frontend
   npm install
   ```

3. **Start the backend**

   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --port 8000 --reload
   ```

4. **Start the frontend**

   ```bash
   cd frontend
   npm run dev
   ```

5. **Open the app**

   Navigate to `http://localhost:3000` in your browser, or run the desktop app.

---

## Services

| Service | Description | Port |
|---------|-------------|------|
| Frontend | Next.js + Electron | 3000 |
| Backend | Python FastAPI | 8000 |
| AI Agent | Python FastAPI | 8001 |
| Test Runner | Node.js Express | 8002 |

---

## Configuration

Create a `.env.local` file in the `frontend/` directory:

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

---

## Downloads

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Download DMG](https://github.com/MVVKUR/automation-testing-v2/releases/latest) |
| macOS (Intel) | [Download DMG](https://github.com/MVVKUR/automation-testing-v2/releases/latest) |
| Windows | [Download EXE](https://github.com/MVVKUR/automation-testing-v2/releases/latest) |
| Linux | [Download AppImage](https://github.com/MVVKUR/automation-testing-v2/releases/latest) |

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Code Style

- **TypeScript**: ESLint + Prettier
- **Python**: Black + Ruff

---

## License

MIT License - see [LICENSE](https://github.com/MVVKUR/automation-testing-v2/blob/main/LICENSE) for details.

---

<p style="text-align: center; color: #666; margin-top: 3rem;">
  Built with Next.js, FastAPI, and Claude AI
</p>
