export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  steps: TestStep[];
  tags?: string[];
  timeout?: number;
}

export interface TestStep {
  id: string;
  action: TestAction;
  selector?: string;
  value?: string;
  description?: string;
  timeout?: number;
  assertions?: TestAssertion[];
}

export type TestAction =
  | 'visit'
  | 'click'
  | 'type'
  | 'clear'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'assert'
  | 'custom';

export interface TestAssertion {
  type: AssertionType;
  selector?: string;
  expected?: string | number | boolean;
  operator?: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}

export type AssertionType =
  | 'visible'
  | 'hidden'
  | 'exists'
  | 'notExists'
  | 'text'
  | 'value'
  | 'attribute'
  | 'url'
  | 'title'
  | 'count';

export interface TestExecution {
  id: string;
  scenarioId: string;
  scenarioName?: string;
  runner?: TestRunner;
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  results?: TestResult;
  artifacts?: TestArtifact[];
  error?: string;
  metadata?: Record<string, unknown>;
}

export type ExecutionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  specs: SpecResult[];
}

export interface SpecResult {
  name: string;
  file: string;
  passed: boolean;
  duration: number;
  tests: IndividualTestResult[];
  error?: string;
}

export interface IndividualTestResult {
  title: string;
  state: 'passed' | 'failed' | 'pending' | 'skipped';
  duration: number;
  error?: TestError;
}

export interface TestError {
  message: string;
  stack?: string;
  codeFrame?: string;
}

export interface TestArtifact {
  id: string;
  executionId: string;
  type: ArtifactType;
  name: string;
  path: string;
  url?: string;
  size?: number;
  createdAt: Date;
}

export type ArtifactType =
  | 'screenshot'
  | 'video'
  | 'report'
  | 'log'
  | 'trace';

export interface RunTestRequest {
  scenarioId: string;
  scenario?: TestScenario;
  config?: TestRunConfig;
  priority?: number;
}

export type TestRunner = 'cypress' | 'playwright';

export interface TestRunConfig {
  runner?: TestRunner;
  browser?: 'chrome' | 'firefox' | 'edge' | 'electron' | 'webkit' | 'safari' | 'chromium';
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  baseUrl?: string;
  env?: Record<string, string>;
  video?: boolean;
  screenshots?: boolean;
  retries?: number;
  timeout?: number;
  trace?: boolean; // Playwright-specific: enable trace recording
}

export interface GenerateSpecRequest {
  scenario: TestScenario;
  outputPath?: string;
}

export interface GenerateSpecResponse {
  specContent: string;
  filePath: string;
}

export interface WebSocketEvents {
  'execution:started': { executionId: string; scenarioId: string; runner?: TestRunner };
  'execution:progress': { executionId: string; step: number; total: number; message: string; runner?: TestRunner };
  'execution:completed': { executionId: string; status: ExecutionStatus; results?: TestResult; runner?: TestRunner };
  'execution:error': { executionId: string; error: string; runner?: TestRunner };
  'execution:log': { executionId: string; level: string; message: string; timestamp: Date; runner?: TestRunner };
}

export interface QueueJob {
  id: string;
  type: 'run-test' | 'generate-spec';
  data: RunTestRequest | GenerateSpecRequest;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}
