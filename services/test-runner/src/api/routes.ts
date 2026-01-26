import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { generateCypressSpec } from '../generators/cypress-spec.js';
import { listArtifacts } from '../storage/s3.js';
import {
  getAllExecutions,
  getExecution as getStoredExecution,
  saveExecution,
  updateExecution as updateStoredExecution,
  getRecentExecutions,
} from '../storage/executions.js';
import {
  JOB_NAMES,
  DEFAULT_JOB_OPTIONS,
  createRunTestJobData,
  createGenerateSpecJobData,
  createExecution,
} from '../queue/jobs.js';
import type {
  RunTestRequest,
  GenerateSpecRequest,
  TestExecution,
  TestScenario,
  TestRunner,
} from '../types/index.js';
import { generatePlaywrightSpec } from '../generators/playwright-spec.js';
import { getAvailableRunners } from '../runners/index.js';

const router = Router();

const connectionConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const testQueue = new Queue(config.queue.name, { connection: connectionConfig });

// In-memory cache for quick access during active runs
const executionsCache = new Map<string, TestExecution>();

router.post('/run', async (req: Request, res: Response) => {
  try {
    const body = req.body as RunTestRequest;

    if (!body.scenarioId && !body.scenario) {
      res.status(400).json({
        error: 'Either scenarioId or scenario must be provided',
      });
      return;
    }

    const scenario: TestScenario = body.scenario ?? {
      id: body.scenarioId,
      name: `Test ${body.scenarioId}`,
      steps: [],
    };

    const runner: TestRunner = body.config?.runner ?? 'cypress';
    const executionId = uuidv4();
    const execution = createExecution(executionId, scenario.id, 'queued', runner, scenario.name);
    executionsCache.set(executionId, execution);
    saveExecution(execution);

    const jobData = createRunTestJobData(executionId, scenario, body.config ?? {});

    const job = await testQueue.add(JOB_NAMES.RUN_TEST, jobData, {
      ...DEFAULT_JOB_OPTIONS,
      priority: body.priority ?? 0,
      jobId: executionId,
    });

    res.status(202).json({
      executionId,
      jobId: job.id,
      status: 'queued',
      runner,
      message: `Test execution queued successfully with ${runner}`,
    });
  } catch (error) {
    console.error('Error queueing test run:', error);
    res.status(500).json({
      error: 'Failed to queue test execution',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache first, then persistent storage
    let execution = executionsCache.get(id) ?? getStoredExecution(id);
    if (!execution) {
      res.status(404).json({
        error: 'Execution not found',
      });
      return;
    }

    const job = await testQueue.getJob(id);
    let jobStatus = 'unknown';
    let progress = 0;
    let testResults = null;
    let testsPassed = false;

    if (job) {
      jobStatus = await job.getState();
      progress = typeof job.progress === 'number' ? job.progress : 0;

      // Get the actual test results from the completed job
      if (jobStatus === 'completed') {
        const returnValue = job.returnvalue as { success?: boolean; data?: { results?: { failed?: number; passed?: number } } } | null;
        if (returnValue) {
          testsPassed = returnValue.success === true;
          testResults = returnValue.data?.results || null;
        }
      }
    }

    let artifacts: string[] = [];
    try {
      artifacts = await listArtifacts(id);
    } catch {
      // Artifacts may not exist yet
    }

    res.json({
      ...execution,
      jobStatus,
      progress,
      testsPassed,
      testResults,
      artifactCount: artifacts.length,
      artifacts,
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({
      error: 'Failed to fetch execution details',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/executions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const allExecutions = getRecentExecutions(limit);

    res.json({
      executions: allExecutions,
      total: allExecutions.length,
    });
  } catch (error) {
    console.error('Error listing executions:', error);
    res.status(500).json({
      error: 'Failed to list executions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/runs - alias for /api/executions with additional run history details
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const status = req.query.status as string | undefined;

    let allExecutions = getRecentExecutions(limit);

    // Filter by status if provided
    if (status) {
      allExecutions = allExecutions.filter((e) => e.status === status);
    }

    // Enrich with job status from queue
    const enrichedRuns = await Promise.all(
      allExecutions.map(async (execution) => {
        const job = await testQueue.getJob(execution.id);
        let jobStatus: string = execution.status;
        let progress = 0;

        if (job) {
          jobStatus = await job.getState();
          progress = typeof job.progress === 'number' ? job.progress : 0;
        }

        return {
          id: execution.id,
          scenarioId: execution.scenarioId,
          scenarioName: execution.scenarioName,
          runner: execution.runner,
          status: execution.status,
          jobStatus,
          progress,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          duration: execution.duration,
          results: execution.results,
          error: execution.error,
        };
      })
    );

    res.json({
      runs: enrichedRuns,
      total: enrichedRuns.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({
      error: 'Failed to list runs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Extended request type with runner option
interface GenerateSpecRequestExtended extends GenerateSpecRequest {
  runner?: TestRunner;
}

router.post('/generate-spec', async (req: Request, res: Response) => {
  try {
    const body = req.body as GenerateSpecRequestExtended;

    if (!body.scenario) {
      res.status(400).json({
        error: 'Scenario is required',
      });
      return;
    }

    if (!body.scenario.steps || body.scenario.steps.length === 0) {
      res.status(400).json({
        error: 'Scenario must have at least one step',
      });
      return;
    }

    const runner: TestRunner = body.runner ?? 'cypress';
    const result = runner === 'playwright'
      ? await generatePlaywrightSpec(body.scenario, body.outputPath)
      : await generateCypressSpec(body.scenario, body.outputPath);

    res.json({
      success: true,
      runner,
      filePath: result.filePath,
      specContent: result.specContent,
    });
  } catch (error) {
    console.error('Error generating spec:', error);
    res.status(500).json({
      error: 'Failed to generate spec',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/generate-spec/async', async (req: Request, res: Response) => {
  try {
    const body = req.body as GenerateSpecRequest;

    if (!body.scenario) {
      res.status(400).json({
        error: 'Scenario is required',
      });
      return;
    }

    const jobData = createGenerateSpecJobData(body.scenario, body.outputPath);

    const job = await testQueue.add(JOB_NAMES.GENERATE_SPEC, jobData, {
      ...DEFAULT_JOB_OPTIONS,
    });

    res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Spec generation queued successfully',
    });
  } catch (error) {
    console.error('Error queueing spec generation:', error);
    res.status(500).json({
      error: 'Failed to queue spec generation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/executions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await testQueue.getJob(id);
    if (job) {
      const state = await job.getState();
      if (state === 'active') {
        res.status(400).json({
          error: 'Cannot cancel an active execution',
        });
        return;
      }

      await job.remove();
    }

    let execution = executionsCache.get(id) ?? getStoredExecution(id);
    if (execution) {
      execution.status = 'cancelled';
      executionsCache.set(id, execution);
      saveExecution(execution);
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    res.status(500).json({
      error: 'Failed to cancel execution',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      testQueue.getWaitingCount(),
      testQueue.getActiveCount(),
      testQueue.getCompletedCount(),
      testQueue.getFailedCount(),
      testQueue.getDelayedCount(),
    ]);

    res.json({
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({
      error: 'Failed to fetch queue statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available test runners and their installation status
router.get('/runners', async (_req: Request, res: Response) => {
  try {
    const runners = await getAvailableRunners();

    res.json({
      runners,
      default: 'cypress',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching runners:', error);
    res.status(500).json({
      error: 'Failed to fetch available runners',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'test-runner',
  });
});

export function updateExecution(execution: TestExecution): void {
  executionsCache.set(execution.id, execution);
  saveExecution(execution);
}

export function getExecution(id: string): TestExecution | undefined {
  return executionsCache.get(id) ?? getStoredExecution(id);
}

export default router;
