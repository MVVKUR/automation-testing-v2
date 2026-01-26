import type {
  TestScenario,
  TestRunConfig,
  TestResult,
  TestArtifact,
  TestRunner,
} from '../types/index.js';
import { runCypressTests, validateCypressInstallation } from './cypress.js';
import { runPlaywrightTests, validatePlaywrightInstallation } from './playwright.js';

export interface RunResult {
  results: TestResult;
  artifacts: TestArtifact[];
}

export interface ProgressCallback {
  (progress: { percent: number; message: string }): void;
}

/**
 * Run tests using the specified runner
 */
export async function runTests(
  runner: TestRunner,
  executionId: string,
  scenario: TestScenario,
  config: TestRunConfig,
  onProgress?: ProgressCallback
): Promise<RunResult> {
  switch (runner) {
    case 'playwright':
      return runPlaywrightTests(executionId, scenario, config, onProgress);
    case 'cypress':
    default:
      return runCypressTests(executionId, scenario, config, onProgress);
  }
}

/**
 * Validate that the specified runner is properly installed
 */
export async function validateRunnerInstallation(runner: TestRunner): Promise<boolean> {
  switch (runner) {
    case 'playwright':
      return validatePlaywrightInstallation();
    case 'cypress':
    default:
      return validateCypressInstallation();
  }
}

/**
 * Get available runners and their installation status
 */
export async function getAvailableRunners(): Promise<
  Array<{ runner: TestRunner; installed: boolean; name: string; description: string }>
> {
  const [cypressInstalled, playwrightInstalled] = await Promise.all([
    validateCypressInstallation(),
    validatePlaywrightInstallation(),
  ]);

  return [
    {
      runner: 'cypress',
      installed: cypressInstalled,
      name: 'Cypress',
      description: 'JavaScript End-to-End Testing Framework with real browser support',
    },
    {
      runner: 'playwright',
      installed: playwrightInstalled,
      name: 'Playwright',
      description: 'Cross-browser automation library by Microsoft with multi-language support',
    },
  ];
}

// Re-export individual runners
export { runCypressTests, validateCypressInstallation } from './cypress.js';
export { runPlaywrightTests, validatePlaywrightInstallation } from './playwright.js';
