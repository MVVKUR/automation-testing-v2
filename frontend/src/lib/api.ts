// API utilities for communicating with the Python backend
// This replaces the Tauri IPC layer with HTTP requests

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

// Backend URL - will be set by Electron or default for browser dev
let BACKEND_URL = 'http://127.0.0.1:8000';

// Check if we're running in Electron
export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'electronAPI' in window;
};

// Initialize backend URL from Electron if available
export async function initializeApi(): Promise<void> {
  if (isElectron()) {
    try {
      // @ts-ignore - electronAPI is injected by preload
      BACKEND_URL = await window.electronAPI.getBackendUrl();
    } catch (e) {
      console.warn('Failed to get backend URL from Electron, using default');
    }
  }
}

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// App Info
// ============================================

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
}

export async function getAppInfo(): Promise<AppInfo> {
  if (isElectron()) {
    // @ts-ignore
    return window.electronAPI.getAppInfo();
  }
  return fetchApi<AppInfo>('/app-info');
}

export async function getPlatform(): Promise<string> {
  if (isElectron()) {
    // @ts-ignore
    const info = await window.electronAPI.getAppInfo();
    return info.platform;
  }
  return fetchApi<string>('/platform');
}

export async function getDbPath(): Promise<string> {
  return fetchApi<string>('/db-path');
}

export async function openUrl(url: string): Promise<void> {
  if (isElectron()) {
    // @ts-ignore
    await window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// ============================================
// Project Commands
// ============================================

export interface ConnectRequest {
  app_url: string;
  name?: string;
  project_type?: string;
}

export interface ConnectResponse {
  project: Project;
  connected: boolean;
  error?: string;
}

export const projectApi = {
  async connect(data: ConnectRequest): Promise<ConnectResponse> {
    return fetchApi<ConnectResponse>('/projects/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async create(data: CreateProject): Promise<Project> {
    return fetchApi<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<Project | null> {
    try {
      return await fetchApi<Project>(`/projects/${id}`);
    } catch {
      return null;
    }
  },

  async list(): Promise<Project[]> {
    return fetchApi<Project[]>('/projects');
  },

  async update(id: string, data: UpdateProject): Promise<Project> {
    return fetchApi<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    await fetchApi(`/projects/${id}`, { method: 'DELETE' });
  },

  async search(query: string): Promise<Project[]> {
    return fetchApi<Project[]>(`/projects/search/${encodeURIComponent(query)}`);
  },
};

// ============================================
// Test Case Commands
// ============================================

export const testCaseApi = {
  async create(data: CreateTestCase): Promise<TestCase> {
    return fetchApi<TestCase>('/test-cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<TestCase | null> {
    try {
      return await fetchApi<TestCase>(`/test-cases/${id}`);
    } catch {
      return null;
    }
  },

  async list(filter?: TestCaseFilter): Promise<TestCase[]> {
    const params = new URLSearchParams();
    if (filter?.project_id) params.set('project_id', filter.project_id);
    if (filter?.category) params.set('category', filter.category);
    if (filter?.priority) params.set('priority', filter.priority);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.test_type) params.set('test_type', filter.test_type);

    const query = params.toString();
    return fetchApi<TestCase[]>(`/test-cases${query ? `?${query}` : ''}`);
  },

  async listByProject(projectId: string): Promise<TestCase[]> {
    return fetchApi<TestCase[]>(`/test-cases/project/${projectId}`);
  },

  async update(id: string, data: UpdateTestCase): Promise<TestCase> {
    return fetchApi<TestCase>(`/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateStatus(id: string, status: string): Promise<void> {
    await fetchApi(`/test-cases/${id}/status?status=${status}`, {
      method: 'PATCH',
    });
  },

  async delete(id: string): Promise<void> {
    await fetchApi(`/test-cases/${id}`, { method: 'DELETE' });
  },

  async getStats(projectId: string): Promise<TestCaseStats> {
    return fetchApi<TestCaseStats>(`/test-cases/stats/${projectId}`);
  },
};

// ============================================
// Scenario Commands
// ============================================

export const scenarioApi = {
  async create(data: CreateScenario): Promise<Scenario> {
    return fetchApi<Scenario>('/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<Scenario | null> {
    try {
      return await fetchApi<Scenario>(`/scenarios/${id}`);
    } catch {
      return null;
    }
  },

  async getWithSteps(id: string): Promise<ScenarioWithSteps | null> {
    try {
      return await fetchApi<ScenarioWithSteps>(`/scenarios/${id}/with-steps`);
    } catch {
      return null;
    }
  },

  async listByTestCase(testCaseId: string): Promise<Scenario[]> {
    return fetchApi<Scenario[]>(`/scenarios/test-case/${testCaseId}`);
  },

  async update(id: string, data: UpdateScenario): Promise<Scenario> {
    return fetchApi<Scenario>(`/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    await fetchApi(`/scenarios/${id}`, { method: 'DELETE' });
  },

  async duplicate(id: string, newName?: string): Promise<Scenario> {
    const params = newName ? `?new_name=${encodeURIComponent(newName)}` : '';
    return fetchApi<Scenario>(`/scenarios/${id}/duplicate${params}`, {
      method: 'POST',
    });
  },
};

// ============================================
// Step Commands
// ============================================

export const stepApi = {
  async create(data: CreateStep): Promise<Step> {
    return fetchApi<Step>('/steps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<StepWithConfig | null> {
    try {
      return await fetchApi<StepWithConfig>(`/steps/${id}`);
    } catch {
      return null;
    }
  },

  async listByScenario(scenarioId: string): Promise<StepWithConfig[]> {
    return fetchApi<StepWithConfig[]>(`/steps/scenario/${scenarioId}`);
  },

  async update(id: string, data: UpdateStep): Promise<Step> {
    return fetchApi<Step>(`/steps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateConfig(id: string, config: StepConfig): Promise<Step> {
    return fetchApi<Step>(`/steps/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  async delete(id: string): Promise<void> {
    await fetchApi(`/steps/${id}`, { method: 'DELETE' });
  },

  async reorder(scenarioId: string, stepIds: string[]): Promise<void> {
    await fetchApi(`/steps/reorder?scenario_id=${scenarioId}`, {
      method: 'POST',
      body: JSON.stringify(stepIds),
    });
  },

  async bulkCreate(steps: CreateStep[]): Promise<Step[]> {
    return fetchApi<Step[]>('/steps/bulk', {
      method: 'POST',
      body: JSON.stringify(steps),
    });
  },

  async bulkDelete(stepIds: string[]): Promise<number> {
    const result = await fetchApi<{ deleted: number }>('/steps/bulk', {
      method: 'DELETE',
      body: JSON.stringify(stepIds),
    });
    return result.deleted;
  },
};

// ============================================
// Test Run Commands
// ============================================

export const testRunApi = {
  async create(data: CreateTestRun): Promise<TestRun> {
    return fetchApi<TestRun>('/test-runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<TestRun | null> {
    try {
      return await fetchApi<TestRun>(`/test-runs/${id}`);
    } catch {
      return null;
    }
  },

  async list(projectId: string, limit?: number): Promise<TestRun[]> {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<TestRun[]>(`/test-runs/project/${projectId}${params}`);
  },

  async update(id: string, data: UpdateTestRun): Promise<TestRun> {
    return fetchApi<TestRun>(`/test-runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async start(id: string): Promise<TestRun> {
    return fetchApi<TestRun>(`/test-runs/${id}/start`, {
      method: 'POST',
    });
  },

  async complete(
    id: string,
    passed: number,
    failed: number,
    skipped: number
  ): Promise<TestRun> {
    return fetchApi<TestRun>(
      `/test-runs/${id}/complete?passed=${passed}&failed=${failed}&skipped=${skipped}`,
      { method: 'POST' }
    );
  },

  async delete(id: string): Promise<void> {
    await fetchApi(`/test-runs/${id}`, { method: 'DELETE' });
  },

  async getSummary(projectId: string): Promise<TestRunSummary> {
    return fetchApi<TestRunSummary>(`/test-runs/summary/${projectId}`);
  },
};

// ============================================
// Step Result Commands
// ============================================

export const stepResultApi = {
  async create(data: CreateStepResult): Promise<StepResult> {
    return fetchApi<StepResult>('/step-results', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async list(testRunId: string): Promise<StepResult[]> {
    return fetchApi<StepResult[]>(`/step-results/test-run/${testRunId}`);
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

// ============================================
// Service Management Commands
// ============================================

export const serviceApi = {
  async checkHealth(serviceName: string): Promise<ServiceHealth> {
    return fetchApi<ServiceHealth>(`/services/health/${serviceName}`);
  },

  async checkAllHealth(): Promise<ServiceHealth[]> {
    return fetchApi<ServiceHealth[]>('/services/health');
  },

  async getUrls(): Promise<ServiceUrls> {
    return fetchApi<ServiceUrls>('/services/urls');
  },
};

// ============================================
// AI Agent Types & Commands
// ============================================

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

export const aiAgentApi = {
  async analyzeCode(request: AnalyzeCodeRequest): Promise<AnalyzeCodeResponse> {
    return fetchApi<AnalyzeCodeResponse>('/ai/analyze-code', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async generateTests(request: GenerateTestsRequest): Promise<GenerateTestsResponse> {
    return fetchApi<GenerateTestsResponse>('/ai/generate-tests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async parseRequirements(request: ParseRequirementsRequest): Promise<ParseRequirementsResponse> {
    return fetchApi<ParseRequirementsResponse>('/ai/parse-requirements', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async isAvailable(): Promise<boolean> {
    try {
      const result = await fetchApi<{ available: boolean }>('/ai/available');
      return result.available;
    } catch {
      return false;
    }
  },
};

// ============================================
// AI Web Automation Types & Commands
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

export const aiWebApi = {
  async analyzeWebPage(
    screenshotBase64: string,
    pageHtml?: string,
    currentUrl?: string,
    currentSteps?: unknown[],
    testContext?: string
  ): Promise<AiWebAnalysisResult> {
    return fetchApi<AiWebAnalysisResult>('/ai/web/analyze', {
      method: 'POST',
      body: JSON.stringify({
        screenshot_base64: screenshotBase64,
        page_html: pageHtml || null,
        current_url: currentUrl || null,
        current_steps: currentSteps || [],
        test_context: testContext || null,
      }),
    });
  },

  async findWebElement(
    screenshotBase64: string,
    elementDescription: string,
    pageHtml?: string
  ): Promise<AiWebElementLocation> {
    return fetchApi<AiWebElementLocation>('/ai/web/find-element', {
      method: 'POST',
      body: JSON.stringify({
        screenshot_base64: screenshotBase64,
        element_description: elementDescription,
        page_html: pageHtml || null,
      }),
    });
  },

  async suggestWebStep(
    screenshotBase64: string,
    lastStepType?: string,
    testGoal?: string,
    pageHtml?: string
  ): Promise<AiWebSuggestedStep> {
    return fetchApi<AiWebSuggestedStep>('/ai/web/suggest-step', {
      method: 'POST',
      body: JSON.stringify({
        screenshot_base64: screenshotBase64,
        last_step_type: lastStepType || null,
        test_goal: testGoal || null,
        page_html: pageHtml || null,
      }),
    });
  },
};

// ============================================
// Test Runner Types & Commands
// ============================================

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

export const testRunnerApi = {
  async executeTests(request: RunTestsRequest): Promise<RunTestsResponse> {
    return fetchApi<RunTestsResponse>('/test-runner/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getExecution(executionId: string): Promise<ExecutionStatus> {
    return fetchApi<ExecutionStatus>(`/test-runner/execution/${executionId}`);
  },

  async cancelExecution(executionId: string): Promise<void> {
    await fetchApi(`/test-runner/execution/${executionId}/cancel`, {
      method: 'POST',
    });
  },

  async getQueueStats(): Promise<QueueStats> {
    return fetchApi<QueueStats>('/test-runner/queue-stats');
  },

  async isAvailable(): Promise<boolean> {
    try {
      await fetchApi('/test-runner/health');
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Jira Integration
// ============================================

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

export const jiraApi = {
  async getIssue(credentials: JiraCredentials, issueKey: string): Promise<JiraIssue> {
    return fetchApi<JiraIssue>(`/integrations/jira/issue/${issueKey}`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async createIssue(
    credentials: JiraCredentials,
    summary: string,
    description: string,
    issueType: string,
    labels?: string[]
  ): Promise<JiraIssue> {
    return fetchApi<JiraIssue>('/integrations/jira/issue', {
      method: 'POST',
      body: JSON.stringify({
        credentials,
        summary,
        description,
        issue_type: issueType,
        labels,
      }),
    });
  },

  async searchIssues(
    credentials: JiraCredentials,
    jql: string,
    maxResults?: number
  ): Promise<{ issues: JiraIssue[]; total: number }> {
    return fetchApi('/integrations/jira/search', {
      method: 'POST',
      body: JSON.stringify({
        credentials,
        jql,
        max_results: maxResults,
      }),
    });
  },
};

// ============================================
// GitHub Integration
// ============================================

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

export const githubApi = {
  async getIssue(credentials: GitHubCredentials, issueNumber: number): Promise<GitHubIssue> {
    return fetchApi<GitHubIssue>(`/integrations/github/issue/${issueNumber}`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async createIssue(
    credentials: GitHubCredentials,
    title: string,
    body: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<GitHubIssue> {
    return fetchApi<GitHubIssue>('/integrations/github/issue', {
      method: 'POST',
      body: JSON.stringify({
        credentials,
        title,
        body,
        labels,
        assignees,
      }),
    });
  },

  async listIssues(
    credentials: GitHubCredentials,
    state?: string,
    labels?: string[]
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (labels?.length) params.set('labels', labels.join(','));

    return fetchApi<GitHubIssue[]>(`/integrations/github/issues?${params}`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async getPullRequest(credentials: GitHubCredentials, prNumber: number): Promise<GitHubPullRequest> {
    return fetchApi<GitHubPullRequest>(`/integrations/github/pr/${prNumber}`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
};

// ============================================
// Mobile Device Types & Commands
// ============================================

export interface DeviceInfo {
  id: string;
  name: string;
  status: string;
  platform: 'android' | 'ios';
}

export const mobileApi = {
  // Android
  async listAndroidDevices(): Promise<DeviceInfo[]> {
    return fetchApi<DeviceInfo[]>('/mobile/android/devices');
  },

  async androidScreenshot(deviceId: string): Promise<string> {
    const result = await fetchApi<{ screenshot: string }>(`/mobile/android/${deviceId}/screenshot`);
    return result.screenshot;
  },

  async androidTap(deviceId: string, x: number, y: number): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/tap`, {
      method: 'POST',
      body: JSON.stringify({ x, y }),
    });
  },

  async androidSwipe(
    deviceId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationMs: number = 300
  ): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/swipe`, {
      method: 'POST',
      body: JSON.stringify({
        start_x: startX,
        start_y: startY,
        end_x: endX,
        end_y: endY,
        duration_ms: durationMs,
      }),
    });
  },

  async androidInputText(deviceId: string, text: string): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/input`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async androidKeyEvent(deviceId: string, keycode: number): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/keyevent`, {
      method: 'POST',
      body: JSON.stringify({ keycode }),
    });
  },

  async androidLaunchApp(deviceId: string, packageName: string): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ package: packageName }),
    });
  },

  async androidStopApp(deviceId: string, packageName: string): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ package: packageName }),
    });
  },

  async androidClearApp(deviceId: string, packageName: string): Promise<void> {
    await fetchApi(`/mobile/android/${deviceId}/clear`, {
      method: 'POST',
      body: JSON.stringify({ package: packageName }),
    });
  },

  async androidDumpUi(deviceId: string): Promise<string> {
    const result = await fetchApi<{ xml: string }>(`/mobile/android/${deviceId}/ui-dump`);
    return result.xml;
  },

  // iOS
  async listIosDevices(): Promise<DeviceInfo[]> {
    return fetchApi<DeviceInfo[]>('/mobile/ios/devices');
  },

  async iosBootSimulator(deviceId: string): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/boot`, { method: 'POST' });
  },

  async iosShutdownSimulator(deviceId: string): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/shutdown`, { method: 'POST' });
  },

  async iosScreenshot(deviceId: string): Promise<string> {
    const result = await fetchApi<{ screenshot: string }>(`/mobile/ios/${deviceId}/screenshot`);
    return result.screenshot;
  },

  async iosTap(deviceId: string, x: number, y: number): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/tap`, {
      method: 'POST',
      body: JSON.stringify({ x, y }),
    });
  },

  async iosInputText(deviceId: string, text: string): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/input`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async iosLaunchApp(deviceId: string, bundleId: string): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ package: bundleId }),
    });
  },

  async iosTerminateApp(deviceId: string, bundleId: string): Promise<void> {
    await fetchApi(`/mobile/ios/${deviceId}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ package: bundleId }),
    });
  },
};

// ============================================
// Combined API Export (matching old tauri.ts interface)
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
  mobile: mobileApi,
};

// Also export as api for backward compatibility
export const api = tauriApi;

export default tauriApi;
