// Tauri API utilities
// This file provides type-safe wrappers for Tauri commands

import type {
  Project,
  CreateProject,
  UpdateProject,
  TestCase,
  CreateTestCase,
  UpdateTestCase,
  TestCaseFilter,
  TestCaseStats,
  Scenario,
  CreateScenario,
  UpdateScenario,
  ScenarioWithSteps,
  Step,
  StepWithConfig,
  CreateStep,
  UpdateStep,
  StepConfig,
  TestRun,
  CreateTestRun,
  UpdateTestRun,
  TestRunSummary,
  StepResult,
  CreateStepResult,
} from '@/types';

// Check if we're running in Tauri
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window;
};

// App info type
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
}

// Invoke a Tauri command with type safety
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ============================================
// App Info Commands
// ============================================

export async function getAppInfo(): Promise<AppInfo> {
  if (!isTauri()) {
    return {
      name: 'AutoTest AI',
      version: '1.0.0',
      platform: 'browser',
      arch: 'web',
    };
  }
  return invoke<AppInfo>('get_app_info');
}

export async function getPlatform(): Promise<string> {
  if (!isTauri()) {
    return 'browser';
  }
  return invoke<string>('get_platform');
}

export async function greet(name: string): Promise<string> {
  if (!isTauri()) {
    return `Hello, ${name}! Welcome to AutoTest AI. (Browser Mode)`;
  }
  return invoke<string>('greet', { name });
}

export async function getDbPath(): Promise<string> {
  if (!isTauri()) {
    return '/mock/path/autotest.db';
  }
  return invoke<string>('get_db_path');
}

// Open URL in default browser
export async function openUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank');
    return;
  }

  const { open } = await import('@tauri-apps/plugin-shell');
  await open(url);
}

// ============================================
// Project Commands
// ============================================

export const projectApi = {
  async create(data: CreateProject): Promise<Project> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Project>('create_project', { data });
  },

  async get(id: string): Promise<Project | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<Project | null>('get_project', { id });
  },

  async list(): Promise<Project[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<Project[]>('list_projects');
  },

  async update(id: string, data: UpdateProject): Promise<Project> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Project>('update_project', { id, data });
  },

  async delete(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('delete_project', { id });
  },

  async search(query: string): Promise<Project[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<Project[]>('search_projects', { query });
  },
};

// ============================================
// Test Case Commands
// ============================================

export const testCaseApi = {
  async create(data: CreateTestCase): Promise<TestCase> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestCase>('create_test_case', { data });
  },

  async get(id: string): Promise<TestCase | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<TestCase | null>('get_test_case', { id });
  },

  async list(filter?: TestCaseFilter): Promise<TestCase[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<TestCase[]>('list_test_cases', { filter });
  },

  async listByProject(projectId: string): Promise<TestCase[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<TestCase[]>('list_test_cases_by_project', { projectId });
  },

  async update(id: string, data: UpdateTestCase): Promise<TestCase> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestCase>('update_test_case', { id, data });
  },

  async updateStatus(id: string, status: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('update_test_case_status', { id, status });
  },

  async delete(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('delete_test_case', { id });
  },

  async getStats(projectId: string): Promise<TestCaseStats> {
    if (!isTauri()) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        by_category: [],
        by_priority: [],
      };
    }
    return invoke<TestCaseStats>('get_test_case_stats', { projectId });
  },
};

// ============================================
// Scenario Commands
// ============================================

export const scenarioApi = {
  async create(data: CreateScenario): Promise<Scenario> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Scenario>('create_scenario', { data });
  },

  async get(id: string): Promise<Scenario | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<Scenario | null>('get_scenario', { id });
  },

  async getWithSteps(id: string): Promise<ScenarioWithSteps | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<ScenarioWithSteps | null>('get_scenario_with_steps', { id });
  },

  async listByTestCase(testCaseId: string): Promise<Scenario[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<Scenario[]>('list_scenarios_by_test_case', { testCaseId });
  },

  async update(id: string, data: UpdateScenario): Promise<Scenario> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Scenario>('update_scenario', { id, data });
  },

  async delete(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('delete_scenario', { id });
  },

  async duplicate(id: string, newName?: string): Promise<Scenario> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Scenario>('duplicate_scenario', { id, newName });
  },
};

// ============================================
// Step Commands
// ============================================

export const stepApi = {
  async create(data: CreateStep): Promise<Step> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Step>('create_step', { data });
  },

  async get(id: string): Promise<StepWithConfig | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<StepWithConfig | null>('get_step', { id });
  },

  async listByScenario(scenarioId: string): Promise<StepWithConfig[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<StepWithConfig[]>('list_steps_by_scenario', { scenarioId });
  },

  async update(id: string, data: UpdateStep): Promise<Step> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Step>('update_step', { id, data });
  },

  async updateConfig(id: string, config: StepConfig): Promise<Step> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Step>('update_step_config', { id, config });
  },

  async delete(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('delete_step', { id });
  },

  async reorder(scenarioId: string, stepIds: string[]): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('reorder_steps', { scenarioId, stepIds });
  },

  async bulkCreate(steps: CreateStep[]): Promise<Step[]> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<Step[]>('bulk_create_steps', { steps });
  },

  async bulkDelete(stepIds: string[]): Promise<number> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<number>('bulk_delete_steps', { stepIds });
  },
};

// ============================================
// Test Run Commands
// ============================================

export const testRunApi = {
  async create(data: CreateTestRun): Promise<TestRun> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestRun>('create_test_run', { data });
  },

  async get(id: string): Promise<TestRun | null> {
    if (!isTauri()) {
      return null;
    }
    return invoke<TestRun | null>('get_test_run', { id });
  },

  async list(projectId: string, limit?: number): Promise<TestRun[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<TestRun[]>('list_test_runs', { projectId, limit });
  },

  async update(id: string, data: UpdateTestRun): Promise<TestRun> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestRun>('update_test_run', { id, data });
  },

  async start(id: string): Promise<TestRun> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestRun>('start_test_run', { id });
  },

  async complete(id: string, passed: number, failed: number, skipped: number): Promise<TestRun> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<TestRun>('complete_test_run', { id, passed, failed, skipped });
  },

  async delete(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<void>('delete_test_run', { id });
  },

  async getSummary(projectId: string): Promise<TestRunSummary> {
    if (!isTauri()) {
      return {
        total_runs: 0,
        passed_runs: 0,
        failed_runs: 0,
        avg_duration_ms: null,
      };
    }
    return invoke<TestRunSummary>('get_test_run_summary', { projectId });
  },
};

// ============================================
// Step Result Commands
// ============================================

export const stepResultApi = {
  async create(data: CreateStepResult): Promise<StepResult> {
    if (!isTauri()) {
      throw new Error('Database operations require Tauri environment');
    }
    return invoke<StepResult>('create_step_result', { data });
  },

  async list(testRunId: string): Promise<StepResult[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<StepResult[]>('list_step_results', { testRunId });
  },
};

// ============================================
// Service Types
// ============================================

export interface ServiceHealth {
  name: string;
  status: 'Stopped' | 'Starting' | 'Running' | 'Unhealthy' | 'Stopping' | 'Error';
  response_time_ms: number | null;
  details: {
    status: string;
    service?: string;
    version?: string;
  } | null;
  error: string | null;
  checked_at: number;
}

export interface ServiceUrls {
  ai_agent: string;
  test_runner: string;
}

export interface AnalyzeCodeRequest {
  code: string;
  language: string;
  context?: string;
}

export interface AnalyzeCodeResponse {
  analysis: {
    functions: Array<{
      name: string;
      parameters: string[];
      return_type: string | null;
      line_start: number;
      line_end: number;
    }>;
    complexity: string;
    test_coverage_suggestion: string;
  };
  suggestions: string[];
}

export interface GenerateTestsRequest {
  code: string;
  language: string;
  framework: string;
  test_type: string;
  requirements?: string[];
}

export interface GenerateTestsResponse {
  tests: Array<{
    name: string;
    description: string;
    code: string;
    test_type: string;
  }>;
  coverage_estimate: string;
}

export interface ParseRequirementsRequest {
  requirements: string;
  format?: string;
}

export interface ParseRequirementsResponse {
  test_cases: Array<{
    title: string;
    description: string;
    preconditions: string[];
    steps: Array<{
      order: number;
      action: string;
      expected: string | null;
    }>;
    expected_results: string[];
    priority: string;
  }>;
}

export interface RunTestsRequest {
  scenario_id: string;
  runner: 'cypress' | 'playwright';
  browser?: string;
  headless?: boolean;
  timeout?: number;
  env_vars?: Record<string, string>;
}

export interface RunTestsResponse {
  execution_id: string;
  status: string;
  message: string;
}

export interface ExecutionStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  current_step?: string;
  results?: {
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
    artifacts: Array<{
      artifact_type: string;
      name: string;
      path: string;
      size?: number;
    }>;
  };
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface JiraCredentials {
  base_url: string;
  email: string;
  api_token: string;
  project_key: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issue_type: string;
  priority: string | null;
  assignee: string | null;
  labels: string[];
}

export interface GitHubCredentials {
  token: string;
  owner: string;
  repo: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  assignee: string | null;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  head: string;
  base: string;
  html_url: string;
  merged: boolean;
}

// ============================================
// Service Management Commands
// ============================================

export const serviceApi = {
  async checkHealth(serviceName: string): Promise<ServiceHealth> {
    if (!isTauri()) {
      return {
        name: serviceName,
        status: 'Stopped',
        response_time_ms: null,
        details: null,
        error: 'Not running in Tauri environment',
        checked_at: Date.now() / 1000,
      };
    }
    return invoke<ServiceHealth>('check_service_health', { serviceName });
  },

  async checkAllHealth(): Promise<ServiceHealth[]> {
    if (!isTauri()) {
      return [];
    }
    return invoke<ServiceHealth[]>('check_all_services_health');
  },

  getUrls(): ServiceUrls {
    return {
      ai_agent: 'http://127.0.0.1:8001',
      test_runner: 'http://127.0.0.1:8002',
    };
  },
};

// ============================================
// AI Agent Commands
// ============================================

export const aiAgentApi = {
  async analyzeCode(request: AnalyzeCodeRequest): Promise<AnalyzeCodeResponse> {
    if (!isTauri()) {
      throw new Error('AI Agent requires Tauri environment');
    }
    return invoke<AnalyzeCodeResponse>('ai_analyze_code', { request });
  },

  async generateTests(request: GenerateTestsRequest): Promise<GenerateTestsResponse> {
    if (!isTauri()) {
      throw new Error('AI Agent requires Tauri environment');
    }
    return invoke<GenerateTestsResponse>('ai_generate_tests', { request });
  },

  async parseRequirements(request: ParseRequirementsRequest): Promise<ParseRequirementsResponse> {
    if (!isTauri()) {
      throw new Error('AI Agent requires Tauri environment');
    }
    return invoke<ParseRequirementsResponse>('ai_parse_requirements', { request });
  },

  async isAvailable(): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }
    return invoke<boolean>('ai_check_available');
  },
};

// ============================================
// AI Web Automation Types
// ============================================

export interface AiWebStepConfig {
  selector?: string;
  xpath?: string;
  url?: string;
  value?: string;
  timeout?: number;
  element_description?: string;
  assertion_type?: string;
  expected_value?: string;
}

export interface AiWebSuggestedStep {
  step_type: string;
  label: string;
  config: AiWebStepConfig;
  confidence: number;
}

export interface DetectedWebElement {
  element_type: string;
  description: string;
  selector: string;
  xpath?: string;
  text_content?: string;
  attributes?: Record<string, string>;
}

export interface AiWebAnalysisResult {
  page_description: string;
  page_url?: string;
  detected_elements: DetectedWebElement[];
  suggested_steps: AiWebSuggestedStep[];
  test_context: string;
}

export interface AiWebElementLocation {
  found: boolean;
  selector: string;
  xpath?: string;
  element_type: string;
  confidence: number;
  description: string;
  alternatives: string[];
}

// ============================================
// AI Web Automation Commands
// ============================================

export const aiWebApi = {
  /**
   * Analyze a web page screenshot and suggest test steps
   */
  async analyzeWebPage(
    screenshotBase64: string,
    pageHtml?: string,
    currentUrl?: string,
    currentSteps?: unknown[],
    testContext?: string
  ): Promise<AiWebAnalysisResult> {
    if (!isTauri()) {
      throw new Error('AI Web Analysis requires Tauri environment');
    }
    return invoke<AiWebAnalysisResult>('ai_analyze_web_page', {
      screenshotBase64,
      pageHtml: pageHtml || null,
      currentUrl: currentUrl || null,
      currentSteps: currentSteps || [],
      testContext: testContext || null,
    });
  },

  /**
   * Find a web element's CSS selector using AI
   */
  async findWebElement(
    screenshotBase64: string,
    elementDescription: string,
    pageHtml?: string
  ): Promise<AiWebElementLocation> {
    if (!isTauri()) {
      throw new Error('AI Web Element Finder requires Tauri environment');
    }
    return invoke<AiWebElementLocation>('ai_find_web_element', {
      screenshotBase64,
      elementDescription,
      pageHtml: pageHtml || null,
    });
  },

  /**
   * Get a single AI-suggested web test step
   */
  async suggestWebStep(
    screenshotBase64: string,
    lastStepType?: string,
    testGoal?: string,
    pageHtml?: string
  ): Promise<AiWebSuggestedStep> {
    if (!isTauri()) {
      throw new Error('AI Web Suggestion requires Tauri environment');
    }
    return invoke<AiWebSuggestedStep>('ai_suggest_web_step', {
      screenshotBase64,
      lastStepType: lastStepType || null,
      testGoal: testGoal || null,
      pageHtml: pageHtml || null,
    });
  },
};

// ============================================
// Test Runner Commands
// ============================================

export const testRunnerApi = {
  async executeTests(request: RunTestsRequest): Promise<RunTestsResponse> {
    if (!isTauri()) {
      throw new Error('Test Runner requires Tauri environment');
    }
    return invoke<RunTestsResponse>('runner_execute_tests', { request });
  },

  async getExecution(executionId: string): Promise<ExecutionStatus> {
    if (!isTauri()) {
      throw new Error('Test Runner requires Tauri environment');
    }
    return invoke<ExecutionStatus>('runner_get_execution', { executionId });
  },

  async cancelExecution(executionId: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Test Runner requires Tauri environment');
    }
    return invoke<void>('runner_cancel_execution', { executionId });
  },

  async getQueueStats(): Promise<QueueStats> {
    if (!isTauri()) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }
    return invoke<QueueStats>('runner_get_queue_stats');
  },

  async isAvailable(): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }
    return invoke<boolean>('runner_check_available');
  },
};

// ============================================
// Jira Integration Commands
// ============================================

export const jiraApi = {
  async getIssue(credentials: JiraCredentials, issueKey: string): Promise<JiraIssue> {
    if (!isTauri()) {
      throw new Error('Jira integration requires Tauri environment');
    }
    return invoke<JiraIssue>('jira_get_issue', { credentials, issueKey });
  },

  async createIssue(
    credentials: JiraCredentials,
    summary: string,
    description: string,
    issueType: string,
    labels?: string[]
  ): Promise<JiraIssue> {
    if (!isTauri()) {
      throw new Error('Jira integration requires Tauri environment');
    }
    return invoke<JiraIssue>('jira_create_issue', { credentials, summary, description, issueType, labels });
  },

  async searchIssues(
    credentials: JiraCredentials,
    jql: string,
    maxResults?: number
  ): Promise<{ issues: JiraIssue[]; total: number }> {
    if (!isTauri()) {
      throw new Error('Jira integration requires Tauri environment');
    }
    return invoke<{ issues: JiraIssue[]; total: number }>('jira_search_issues', { credentials, jql, maxResults });
  },
};

// ============================================
// GitHub Integration Commands
// ============================================

export const githubApi = {
  async getIssue(credentials: GitHubCredentials, issueNumber: number): Promise<GitHubIssue> {
    if (!isTauri()) {
      throw new Error('GitHub integration requires Tauri environment');
    }
    return invoke<GitHubIssue>('github_get_issue', { credentials, issueNumber });
  },

  async createIssue(
    credentials: GitHubCredentials,
    title: string,
    body: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<GitHubIssue> {
    if (!isTauri()) {
      throw new Error('GitHub integration requires Tauri environment');
    }
    return invoke<GitHubIssue>('github_create_issue', { credentials, title, body, labels, assignees });
  },

  async listIssues(
    credentials: GitHubCredentials,
    state?: string,
    labels?: string[]
  ): Promise<GitHubIssue[]> {
    if (!isTauri()) {
      throw new Error('GitHub integration requires Tauri environment');
    }
    return invoke<GitHubIssue[]>('github_list_issues', { credentials, state, labels });
  },

  async getPullRequest(credentials: GitHubCredentials, prNumber: number): Promise<GitHubPullRequest> {
    if (!isTauri()) {
      throw new Error('GitHub integration requires Tauri environment');
    }
    return invoke<GitHubPullRequest>('github_get_pull_request', { credentials, prNumber });
  },
};

// ============================================
// Real-time Event Subscriptions
// ============================================

export interface ExecutionEvent {
  type: string;
  execution_id: string;
  [key: string]: unknown;
}

export const eventsApi = {
  async subscribeToExecution(executionId: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Events require Tauri environment');
    }
    return invoke<void>('subscribe_to_execution', { executionId });
  },

  async onExecutionEvent(callback: (event: ExecutionEvent) => void): Promise<() => void> {
    if (!isTauri()) {
      return () => {};
    }

    const { listen } = await import('@tauri-apps/api/event');

    const unlisteners = await Promise.all([
      listen<ExecutionEvent>('execution:started', (event) => callback(event.payload)),
      listen<ExecutionEvent>('execution:progress', (event) => callback(event.payload)),
      listen<ExecutionEvent>('execution:step_completed', (event) => callback(event.payload)),
      listen<ExecutionEvent>('execution:completed', (event) => callback(event.payload)),
      listen<ExecutionEvent>('execution:failed', (event) => callback(event.payload)),
      listen<ExecutionEvent>('execution:log', (event) => callback(event.payload)),
    ]);

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  },
};

// ============================================
// Combined API Export
// ============================================

export const tauriApi = {
  projects: projectApi,
  testCases: testCaseApi,
  scenarios: scenarioApi,
  steps: stepApi,
  testRuns: testRunApi,
  stepResults: stepResultApi,
  services: serviceApi,
  aiAgent: aiAgentApi,
  aiWeb: aiWebApi,
  testRunner: testRunnerApi,
  jira: jiraApi,
  github: githubApi,
  events: eventsApi,
};

export default tauriApi;
