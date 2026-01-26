import { spawn } from 'child_process';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import type {
  TestScenario,
  TestRunConfig,
  TestResult,
  TestArtifact,
} from '../types/index.js';
import { config } from '../config.js';
import { generatePlaywrightSpec } from '../generators/playwright-spec.js';
import { uploadArtifact } from '../storage/s3.js';

export interface PlaywrightRunResult {
  results: TestResult;
  artifacts: TestArtifact[];
}

export interface ProgressCallback {
  (progress: { percent: number; message: string }): void;
}

export async function runPlaywrightTests(
  executionId: string,
  scenario: TestScenario,
  runConfig: TestRunConfig,
  onProgress?: ProgressCallback
): Promise<PlaywrightRunResult> {
  onProgress?.({ percent: 15, message: 'Generating Playwright spec file...' });

  const specResult = await generatePlaywrightSpec(scenario);
  const specPath = specResult.filePath;

  onProgress?.({ percent: 25, message: 'Starting Playwright execution...' });

  const playwrightArgs = buildPlaywrightArgs(specPath, runConfig);

  const result = await executePlaywright(playwrightArgs, executionId, onProgress);

  onProgress?.({ percent: 85, message: 'Collecting test artifacts...' });

  const artifacts = await collectPlaywrightArtifacts(executionId, runConfig);

  onProgress?.({ percent: 95, message: 'Finalizing results...' });

  return {
    results: result,
    artifacts,
  };
}

function buildPlaywrightArgs(specPath: string, runConfig: TestRunConfig): string[] {
  const args = ['test', specPath];

  // Browser selection
  if (runConfig.browser) {
    const browserMap: Record<string, string> = {
      chrome: 'chromium',
      firefox: 'firefox',
      edge: 'chromium', // Edge uses Chromium
      electron: 'chromium',
      webkit: 'webkit',
      safari: 'webkit',
    };
    args.push('--project', browserMap[runConfig.browser] || 'chromium');
  }

  // Headless mode (Playwright runs headless by default)
  if (runConfig.headless === false) {
    args.push('--headed');
  }

  // Retries
  if (runConfig.retries && runConfig.retries > 0) {
    args.push('--retries', runConfig.retries.toString());
  }

  // Timeout
  if (runConfig.timeout) {
    args.push('--timeout', runConfig.timeout.toString());
  }

  // Reporter for JSON output
  args.push('--reporter', 'json,line');

  // Output directory for traces and screenshots
  args.push('--output', config.playwright.outputDir);

  return args;
}

async function executePlaywright(
  args: string[],
  executionId: string,
  onProgress?: ProgressCallback
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const playwrightPath = join(process.cwd(), 'node_modules', '.bin', 'playwright');

    // Ensure output directory exists
    const outputDir = config.playwright.outputDir;
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const proc = spawn(playwrightPath, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        PLAYWRIGHT_JSON_OUTPUT_NAME: `${executionId}-results.json`,
      },
    });

    let stdout = '';
    let stderr = '';
    let progressPercent = 30;

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;

      // Parse progress from Playwright output
      if (output.includes('Running')) {
        progressPercent = Math.min(progressPercent + 10, 75);
        onProgress?.({ percent: progressPercent, message: 'Running tests...' });
      }

      if (output.includes('passed') || output.includes('failed')) {
        progressPercent = 80;
        onProgress?.({ percent: progressPercent, message: 'Tests completed, processing results...' });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const result = parsePlaywrightResults(stdout, stderr, code ?? 0);
      resolve(result);
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to execute Playwright: ${error.message}`));
    });
  });
}

function parsePlaywrightResults(stdout: string, stderr: string, exitCode: number): TestResult {
  const result: TestResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    specs: [],
  };

  // Try to parse JSON output from Playwright
  try {
    // Look for JSON in stdout (Playwright outputs JSON when using json reporter)
    const jsonMatch = stdout.match(/\{[\s\S]*"config"[\s\S]*\}/);
    if (jsonMatch) {
      const jsonResult = JSON.parse(jsonMatch[0]);

      if (jsonResult.suites) {
        for (const suite of jsonResult.suites) {
          processSuite(suite, result);
        }
      }

      // Override with summary stats if available
      if (jsonResult.stats) {
        result.passed = jsonResult.stats.expected || result.passed;
        result.failed = jsonResult.stats.unexpected || result.failed;
        result.skipped = jsonResult.stats.skipped || result.skipped;
        result.total = result.passed + result.failed + result.skipped;
      }
    }
  } catch {
    // Fall back to regex parsing
    const passedMatch = stdout.match(/(\d+)\s+passed/);
    const failedMatch = stdout.match(/(\d+)\s+failed/);
    const skippedMatch = stdout.match(/(\d+)\s+skipped/);

    result.passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    result.failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    result.skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
    result.total = result.passed + result.failed + result.skipped;
  }

  // If we couldn't parse results but have exit code
  if (exitCode !== 0 && result.total === 0) {
    result.failed = 1;
    result.total = 1;
    result.specs.push({
      name: 'unknown',
      file: 'unknown',
      passed: false,
      duration: 0,
      tests: [],
      error: stderr || 'Playwright exited with non-zero code',
    });
  }

  return result;
}

function processSuite(suite: any, result: TestResult): void {
  if (suite.specs) {
    for (const spec of suite.specs) {
      const specResult = {
        name: spec.title || 'Unknown',
        file: spec.file || 'unknown',
        passed: true,
        duration: 0,
        tests: [] as any[],
      };

      for (const test of spec.tests || []) {
        let testState: 'passed' | 'failed' | 'pending' | 'skipped' = 'passed';
        const testDuration = test.results?.[0]?.duration || 0;

        const status = test.results?.[0]?.status;
        if (status === 'passed' || status === 'expected') {
          result.passed++;
          testState = 'passed';
        } else if (status === 'failed' || status === 'unexpected') {
          result.failed++;
          testState = 'failed';
          specResult.passed = false;
        } else if (status === 'skipped') {
          result.skipped++;
          testState = 'skipped';
        }

        const testResult = {
          title: test.title || 'Unknown',
          state: testState,
          duration: testDuration,
        };

        result.total++;
        specResult.duration += testResult.duration;
        specResult.tests.push(testResult);
      }

      result.specs.push(specResult);
    }
  }

  // Process nested suites
  if (suite.suites) {
    for (const nestedSuite of suite.suites) {
      processSuite(nestedSuite, result);
    }
  }
}

async function collectPlaywrightArtifacts(
  executionId: string,
  runConfig: TestRunConfig
): Promise<TestArtifact[]> {
  const artifacts: TestArtifact[] = [];

  // Collect traces
  const tracesDir = config.playwright.tracesDir;
  if (existsSync(tracesDir)) {
    const traceFiles = findFilesRecursive(tracesDir, ['.zip']);
    for (const filePath of traceFiles) {
      try {
        const artifact = await uploadArtifact(executionId, filePath, 'trace');
        artifacts.push(artifact);
      } catch (error) {
        console.error(`Failed to upload trace ${filePath}:`, error);
      }
    }
  }

  // Collect screenshots
  if (runConfig.screenshots !== false) {
    const screenshotsDir = config.playwright.screenshotsDir;
    if (existsSync(screenshotsDir)) {
      const screenshotFiles = findFilesRecursive(screenshotsDir, ['.png', '.jpg', '.jpeg']);
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

  // Collect videos
  if (runConfig.video !== false) {
    const videosDir = config.playwright.videosDir;
    if (existsSync(videosDir)) {
      const videoFiles = findFilesRecursive(videosDir, ['.webm', '.mp4']);
      for (const filePath of videoFiles) {
        try {
          const artifact = await uploadArtifact(executionId, filePath, 'video');
          artifacts.push(artifact);
        } catch (error) {
          console.error(`Failed to upload video ${filePath}:`, error);
        }
      }
    }
  }

  // Collect test output (screenshots on failure, etc.)
  const outputDir = config.playwright.outputDir;
  if (existsSync(outputDir)) {
    const outputFiles = findFilesRecursive(outputDir, ['.png', '.jpg', '.webm', '.mp4']);
    for (const filePath of outputFiles) {
      try {
        // Determine artifact type based on extension
        const ext = filePath.toLowerCase();
        let type: 'screenshot' | 'video' = 'screenshot';
        if (ext.endsWith('.webm') || ext.endsWith('.mp4')) {
          type = 'video';
        }
        const artifact = await uploadArtifact(executionId, filePath, type);
        artifacts.push(artifact);
      } catch (error) {
        console.error(`Failed to upload output ${filePath}:`, error);
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
    } else if (entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function validatePlaywrightInstallation(): Promise<boolean> {
  const playwrightPath = join(process.cwd(), 'node_modules', '.bin', 'playwright');
  return existsSync(playwrightPath);
}
