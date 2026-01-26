import { Worker, Job } from 'bullmq';
import { config } from '../config.js';
import { runCypressTests } from '../runners/cypress.js';
import { runPlaywrightTests } from '../runners/playwright.js';
import { generateCypressSpec } from '../generators/cypress-spec.js';
import { generatePlaywrightSpec } from '../generators/playwright-spec.js';
import {
  emitExecutionStarted,
  emitExecutionCompleted,
  emitExecutionError,
  emitExecutionProgress,
} from '../websocket/events.js';
import type { RunTestJobData, GenerateSpecJobData, JobResult } from './jobs.js';
import { JOB_NAMES } from './jobs.js';
import type { TestRunner } from '../types/index.js';

const connectionConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

async function processRunTestJob(job: Job<RunTestJobData>): Promise<JobResult> {
  const { executionId, scenarioId, scenario, config: runConfig } = job.data;
  const runner: TestRunner = runConfig.runner ?? 'cypress';

  try {
    emitExecutionStarted(executionId, scenarioId);
    emitExecutionProgress(executionId, 0, 100, `Starting ${runner} test execution...`);

    await job.updateProgress(10);
    emitExecutionProgress(executionId, 10, 100, `Preparing ${runner} environment...`);

    const progressCallback = (progress: { percent: number; message: string }) => {
      job.updateProgress(progress.percent);
      emitExecutionProgress(
        executionId,
        progress.percent,
        100,
        progress.message
      );
    };

    // Run tests with the appropriate runner
    const result = runner === 'playwright'
      ? await runPlaywrightTests(executionId, scenario, runConfig, progressCallback)
      : await runCypressTests(executionId, scenario, runConfig, progressCallback);

    await job.updateProgress(100);

    const status = result.results.failed > 0 ? 'failed' : 'passed';
    emitExecutionCompleted(executionId, status, result.results);

    return {
      success: result.results.failed === 0,
      executionId,
      status,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    emitExecutionError(executionId, errorMessage);
    emitExecutionCompleted(executionId, 'failed');

    return {
      success: false,
      executionId,
      status: 'failed',
      error: errorMessage,
    };
  }
}

interface GenerateSpecJobDataExtended extends GenerateSpecJobData {
  runner?: TestRunner;
}

async function processGenerateSpecJob(job: Job<GenerateSpecJobDataExtended>): Promise<JobResult> {
  const { scenario, outputPath, runner = 'cypress' } = job.data;

  try {
    const result = runner === 'playwright'
      ? await generatePlaywrightSpec(scenario, outputPath)
      : await generateCypressSpec(scenario, outputPath);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export function createWorker(): Worker {
  const worker = new Worker(
    config.queue.name,
    async (job: Job) => {
      console.log(`Processing job ${job.id} of type ${job.name}`);

      switch (job.name) {
        case JOB_NAMES.RUN_TEST:
          return processRunTestJob(job as Job<RunTestJobData>);
        case JOB_NAMES.GENERATE_SPEC:
          return processGenerateSpecJob(job as Job<GenerateSpecJobData>);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection: connectionConfig,
      concurrency: config.queue.concurrency,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed with error:`, error);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`Job ${jobId} has stalled`);
  });

  return worker;
}

export async function closeWorker(worker: Worker): Promise<void> {
  await worker.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting worker...');
  const worker = createWorker();

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await closeWorker(worker);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await closeWorker(worker);
    process.exit(0);
  });
}
