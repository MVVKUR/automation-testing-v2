import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import routes from './api/routes.js';
import { initializeWebSocket } from './websocket/events.js';
import { createWorker } from './queue/worker.js';
import { ensureBucketExists } from './storage/s3.js';
import { validateCypressInstallation } from './runners/cypress.js';

const app = express();
const server = createServer(app);

app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    service: 'test-runner',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      run: 'POST /api/run',
      runs: 'GET /api/runs',
      executions: 'GET /api/executions',
      execution: 'GET /api/executions/:id',
      generateSpec: 'POST /api/generate-spec',
      queueStats: 'GET /api/queue/stats',
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
  });
});

async function startServer(): Promise<void> {
  try {
    console.log('Initializing Test Runner service...');

    const cypressInstalled = await validateCypressInstallation();
    if (!cypressInstalled) {
      console.warn('Warning: Cypress not found. Run npm install to install dependencies.');
    }

    try {
      await ensureBucketExists();
      console.log('S3 bucket verified');
    } catch (error) {
      console.warn('Warning: Could not verify S3 bucket. Artifacts may not be stored.', error);
    }

    initializeWebSocket(server);
    console.log('WebSocket server initialized');

    const worker = createWorker();
    console.log('BullMQ worker started');

    server.listen(config.port, () => {
      console.log(`Test Runner service running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`WebSocket enabled on same port`);
    });

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);

      server.close(() => {
        console.log('HTTP server closed');
      });

      await worker.close();
      console.log('Worker closed');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, server };
