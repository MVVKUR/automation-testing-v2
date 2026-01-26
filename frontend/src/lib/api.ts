const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);

// Type definitions for API responses
export interface Project {
  id: string;
  name: string;
  branch: string;
  source: 'github' | 'gitlab' | 'upload' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  name: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'passed' | 'failed' | 'pending';
  type: 'Automated' | 'Manual';
  createdAt: string;
  updatedAt: string;
}

export interface Scenario {
  id: string;
  testCaseId: string;
  name: string;
  steps: Step[];
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  type: 'group' | 'action';
  label: string;
  action?: string;
  config?: Record<string, unknown>;
  verifications?: Verification[];
}

export interface Verification {
  id: string;
  type: string;
  operator: string;
  value: string;
}

// API functions
export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete<void>(`/projects/${id}`),
  clone: (source: 'github' | 'gitlab', repoUrl: string, branch?: string) =>
    api.post<Project>('/projects/clone', { source, repoUrl, branch: branch || 'main' }),
};

export const testCasesApi = {
  list: (projectId: string) =>
    api.get<TestCase[]>(`/projects/${projectId}/test-cases`),
  get: (projectId: string, id: string) =>
    api.get<TestCase>(`/projects/${projectId}/test-cases/${id}`),
  create: (projectId: string, data: Partial<TestCase>) =>
    api.post<TestCase>(`/projects/${projectId}/test-cases`, data),
  update: (projectId: string, id: string, data: Partial<TestCase>) =>
    api.patch<TestCase>(`/projects/${projectId}/test-cases/${id}`, data),
  delete: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/test-cases/${id}`),
  generate: (projectId: string, strategy: string) =>
    api.post<TestCase[]>(`/projects/${projectId}/test-cases/generate`, {
      strategy,
    }),
};

export const scenariosApi = {
  get: (id: string) => api.get<Scenario>(`/scenarios/${id}`),
  update: (id: string, data: Partial<Scenario>) =>
    api.patch<Scenario>(`/scenarios/${id}`, data),
  run: (id: string) => api.post<{ runId: string }>(`/scenarios/${id}/run`),
};

// Execution types
export interface TestExecution {
  id: string;
  scenarioId: string;
  status: 'pending' | 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  results?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  error?: string;
  scenarioName?: string;
}

export interface ExecutionDetails extends TestExecution {
  jobStatus: string;
  progress: number;
  testsPassed: boolean;
  testResults: {
    passed: number;
    failed: number;
  } | null;
  artifactCount: number;
  artifacts: string[];
}

export interface ExecutionsResponse {
  executions: TestExecution[];
  total: number;
}

export interface RunTestResponse {
  executionId: string;
  jobId: string;
  status: string;
  message: string;
}

export interface RunTestRequest {
  scenarioId?: string;
  scenario?: {
    id: string;
    name: string;
    steps: unknown[];
  };
  config?: {
    browser?: 'chrome' | 'firefox' | 'edge' | 'electron';
    headless?: boolean;
    baseUrl?: string;
  };
  priority?: number;
}

// Test Runner API (connects to test-runner service)
const TEST_RUNNER_URL = process.env.NEXT_PUBLIC_TEST_RUNNER_URL || 'http://localhost:3001/api';

class TestRunnerClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const testRunner = new TestRunnerClient(TEST_RUNNER_URL);

export const executionsApi = {
  list: () => testRunner.get<ExecutionsResponse>('/executions'),
  get: (id: string) => testRunner.get<ExecutionDetails>(`/executions/${id}`),
  run: (data: RunTestRequest) => testRunner.post<RunTestResponse>('/run', data),
  cancel: (id: string) => testRunner.delete<{ success: boolean; message: string }>(`/executions/${id}`),
  getQueueStats: () => testRunner.get<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  }>('/queue/stats'),
  health: () => testRunner.get<{ status: string; timestamp: string; service: string }>('/health'),
};
