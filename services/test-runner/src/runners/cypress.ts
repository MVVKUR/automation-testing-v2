import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  TestScenario,
  TestRunConfig,
  TestResult,
  TestArtifact,
} from '../types/index.js';
import { config } from '../config.js';
import { generateCypressSpec } from '../generators/cypress-spec.js';
import { uploadArtifact } from '../storage/s3.js';

export interface CypressRunResult {
  results: TestResult;
  artifacts: TestArtifact[];
}

export interface ProgressCallback {
  (progress: { percent: number; message: string }): void;
}

export async function runCypressTests(
  executionId: string,
  scenario: TestScenario,
  runConfig: TestRunConfig,
  onProgress?: ProgressCallback
): Promise<CypressRunResult> {
  onProgress?.({ percent: 15, message: 'Generating Cypress spec file...' });

  const specResult = await generateCypressSpec(scenario);
  const specPath = specResult.filePath;

  onProgress?.({ percent: 25, message: 'Starting Cypress execution...' });

  const cypressArgs = buildCypressArgs(specPath, runConfig);

  const result = await executeCypress(cypressArgs, onProgress);

  onProgress?.({ percent: 85, message: 'Collecting test artifacts...' });

  const artifacts = await collectArtifacts(executionId, runConfig);

  onProgress?.({ percent: 95, message: 'Finalizing results...' });

  return {
    results: result,
    artifacts,
  };
}

function buildCypressArgs(specPath: string, runConfig: TestRunConfig): string[] {
  const args = ['run'];

  args.push('--spec', specPath);

  if (runConfig.browser) {
    args.push('--browser', runConfig.browser);
  }

  if (runConfig.headless !== false) {
    args.push('--headless');
  }

  if (runConfig.baseUrl) {
    args.push('--config', `baseUrl=${runConfig.baseUrl}`);
  }

  if (runConfig.viewport) {
    args.push(
      '--config',
      `viewportWidth=${runConfig.viewport.width},viewportHeight=${runConfig.viewport.height}`
    );
  }

  if (runConfig.video === false) {
    args.push('--config', 'video=false');
  }

  if (runConfig.retries && runConfig.retries > 0) {
    args.push('--config', `retries=${runConfig.retries}`);
  }

  if (runConfig.timeout) {
    args.push('--config', `defaultCommandTimeout=${runConfig.timeout}`);
  }

  if (runConfig.env) {
    const envString = Object.entries(runConfig.env)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    args.push('--env', envString);
  }

  return args;
}

async function executeCypress(
  args: string[],
  onProgress?: ProgressCallback
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const cypressPath = join(process.cwd(), 'node_modules', '.bin', 'cypress');

    const proc = spawn(cypressPath, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
    });

    let stdout = '';
    let stderr = '';
    let progressPercent = 30;

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;

      if (output.includes('Running:')) {
        progressPercent = Math.min(progressPercent + 10, 75);
        onProgress?.({ percent: progressPercent, message: 'Running tests...' });
      }

      if (output.includes('Passing:') || output.includes('Failing:')) {
        progressPercent = 80;
        onProgress?.({ percent: progressPercent, message: 'Tests completed, processing results...' });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const result = parseTestResults(stdout, stderr, code ?? 0);
      resolve(result);
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to execute Cypress: ${error.message}`));
    });
  });
}

function parseTestResults(stdout: string, stderr: string, exitCode: number): TestResult {
  const result: TestResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    specs: [],
  };

  const passingMatch = stdout.match(/(\d+)\s+passing/);
  const failingMatch = stdout.match(/(\d+)\s+failing/);
  const pendingMatch = stdout.match(/(\d+)\s+pending/);

  result.passed = passingMatch ? parseInt(passingMatch[1], 10) : 0;
  result.failed = failingMatch ? parseInt(failingMatch[1], 10) : 0;
  result.skipped = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;
  result.total = result.passed + result.failed + result.skipped;

  const specMatches = stdout.matchAll(/Running:\s+(.+\.cy\.[tj]s)/g);
  for (const match of specMatches) {
    result.specs.push({
      name: match[1],
      file: match[1],
      passed: exitCode === 0,
      duration: 0,
      tests: [],
    });
  }

  if (exitCode !== 0 && result.failed === 0 && result.passed === 0) {
    result.failed = 1;
    result.total = 1;
    result.specs.push({
      name: 'unknown',
      file: 'unknown',
      passed: false,
      duration: 0,
      tests: [],
      error: stderr || 'Cypress exited with non-zero code',
    });
  }

  return result;
}

async function collectArtifacts(
  executionId: string,
  runConfig: TestRunConfig
): Promise<TestArtifact[]> {
  const artifacts: TestArtifact[] = [];

  if (runConfig.video !== false) {
    const videosDir = config.cypress.videosDir;
    if (existsSync(videosDir)) {
      const videoFiles = readdirSync(videosDir).filter((f) => f.endsWith('.mp4'));
      for (const file of videoFiles) {
        const filePath = join(videosDir, file);
        try {
          const artifact = await uploadArtifact(executionId, filePath, 'video');
          artifacts.push(artifact);
        } catch (error) {
          console.error(`Failed to upload video ${file}:`, error);
        }
      }
    }
  }

  if (runConfig.screenshots !== false) {
    const screenshotsDir = config.cypress.screenshotsDir;
    if (existsSync(screenshotsDir)) {
      const screenshotFiles = findFilesRecursive(screenshotsDir, ['.png', '.jpg']);
      for (const filePath of screenshotFiles) {
        try {
          const artifact = await uploadArtifact(executionId, filePath, 'screenshot');
          artifacts.push(artifact);
        } catch (error) {
          console.error(`Failed to upload screenshot ${filePath}:`, error);
        }
      }
    }
  }

  return artifacts;
}

function findFilesRecursive(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFilesRecursive(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function validateCypressInstallation(): Promise<boolean> {
  const cypressPath = join(process.cwd(), 'node_modules', '.bin', 'cypress');
  return existsSync(cypressPath);
}
