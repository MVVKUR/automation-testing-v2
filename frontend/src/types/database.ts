// Database types - matching Rust models
// These types are used for IPC communication with Tauri backend

// ============================================
// Project Types
// ============================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
  app_url: string;
  repo_url: string | null;
  project_type: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProject {
  name: string;
  description?: string;
  app_url: string;
  repo_url?: string;
  project_type?: string;
}

export interface UpdateProject {
  name?: string;
  description?: string;
  app_url?: string;
  repo_url?: string;
  project_type?: string;
}

// ============================================
// Test Case Types
// ============================================

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TestType = 'Automated' | 'Manual';
export type TestStatus = 'pending' | 'success' | 'failed' | 'warning' | 'running' | 'skipped';

export interface TestCase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  category: string | null;
  priority: string;
  test_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTestCase {
  project_id: string;
  name: string;
  description?: string;
  category?: string;
  priority?: string;
  test_type?: string;
}

export interface UpdateTestCase {
  name?: string;
  description?: string;
  category?: string;
  priority?: string;
  test_type?: string;
  status?: string;
}

export interface TestCaseFilter {
  project_id?: string;
  category?: string;
  priority?: string;
  status?: string;
  test_type?: string;
}

export interface TestCaseStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  by_category: CategoryCount[];
  by_priority: PriorityCount[];
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

// ============================================
// Scenario Types
// ============================================

export interface Scenario {
  id: string;
  test_case_id: string;
  name: string;
  description: string | null;
  target_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScenario {
  test_case_id: string;
  name: string;
  description?: string;
  target_url?: string;
}

export interface UpdateScenario {
  name?: string;
  description?: string;
  target_url?: string;
}

export interface ScenarioWithSteps extends Scenario {
  steps: Step[];
}

// ============================================
// Step Types
// ============================================

export type StepType = 'navigate' | 'type' | 'click' | 'wait' | 'verify' | 'screenshot' | 'scroll' | 'hover' | 'select' | 'custom';

export interface StepConfig {
  url?: string;
  selector?: string;
  value?: string;
  timeout?: number;
  expected?: string;
  operator?: string;
  [key: string]: unknown;
}

export interface Step {
  id: string;
  scenario_id: string;
  step_order: number;
  step_type: string;
  label: string;
  config: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface StepWithConfig {
  id: string;
  scenario_id: string;
  step_order: number;
  step_type: string;
  label: string;
  config: StepConfig;
  created_at: string;
  updated_at: string;
}

export interface CreateStep {
  scenario_id: string;
  step_order: number;
  step_type: string;
  label: string;
  config?: StepConfig;
}

export interface UpdateStep {
  step_order?: number;
  step_type?: string;
  label?: string;
  config?: StepConfig;
}

// ============================================
// Test Run Types
// ============================================

export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface TestRun {
  id: string;
  project_id: string;
  name: string;
  status: string;
  duration_ms: number | null;
  passed: number;
  failed: number;
  skipped: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateTestRun {
  project_id: string;
  name: string;
}

export interface UpdateTestRun {
  status?: string;
  duration_ms?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  started_at?: string;
  completed_at?: string;
}

export interface TestRunSummary {
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  avg_duration_ms: number | null;
}

export interface StepResult {
  id: string;
  test_run_id: string;
  step_id: string;
  test_case_id: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  screenshot_path: string | null;
  created_at: string;
}

export interface CreateStepResult {
  test_run_id: string;
  step_id: string;
  test_case_id: string;
  status: string;
  duration_ms?: number;
  error_message?: string;
  screenshot_path?: string;
}
