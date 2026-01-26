import type {
  TestScenario,
  TestRunConfig,
  TestExecution,
  ExecutionStatus,
  TestRunner,
} from '../types/index.js';

export interface RunTestJobData {
  executionId: string;
  scenarioId: string;
  scenario: TestScenario;
  config: TestRunConfig;
}

export interface GenerateSpecJobData {
  scenario: TestScenario;
  outputPath?: string;
}

export type JobType = 'run-test' | 'generate-spec';

export interface JobResult {
  success: boolean;
  executionId?: string;
  status?: ExecutionStatus;
  error?: string;
  data?: unknown;
}

export const JOB_NAMES = {
  RUN_TEST: 'run-test',
  GENERATE_SPEC: 'generate-spec',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600,
    count: 100,
  },
  removeOnFail: {
    age: 86400,
    count: 200,
  },
};

export function createRunTestJobData(
  executionId: string,
  scenario: TestScenario,
  config: TestRunConfig = {}
): RunTestJobData {
  const runner: TestRunner = config.runner ?? 'cypress';
  const defaultBrowser = runner === 'playwright' ? 'chromium' : 'electron';

  return {
    executionId,
    scenarioId: scenario.id,
    scenario,
    config: {
      runner,
      browser: config.browser ?? defaultBrowser,
      headless: config.headless ?? true,
      viewport: config.viewport ?? { width: 1280, height: 720 },
      video: config.video ?? true,
      screenshots: config.screenshots ?? true,
      retries: config.retries ?? 0,
      timeout: config.timeout ?? 60000,
      trace: config.trace ?? (runner === 'playwright'), // Enable trace for Playwright by default
      ...config,
    },
  };
}

export function createGenerateSpecJobData(
  scenario: TestScenario,
  outputPath?: string
): GenerateSpecJobData {
  return {
    scenario,
    outputPath,
  };
}

export function createExecution(
  executionId: string,
  scenarioId: string,
  status: ExecutionStatus = 'pending',
  runner: TestRunner = 'cypress',
  scenarioName?: string
): TestExecution {
  return {
    id: executionId,
    scenarioId,
    scenarioName,
    runner,
    status,
    metadata: {},
  };
}

export function updateExecutionStatus(
  execution: TestExecution,
  status: ExecutionStatus
): TestExecution {
  const now = new Date();

  return {
    ...execution,
    status,
    startedAt: status === 'running' ? now : execution.startedAt,
    completedAt: ['passed', 'failed', 'cancelled', 'timeout'].includes(status)
      ? now
      : execution.completedAt,
    duration:
      execution.startedAt && ['passed', 'failed', 'cancelled', 'timeout'].includes(status)
        ? now.getTime() - new Date(execution.startedAt).getTime()
        : execution.duration,
  };
}
