import dotenv from 'dotenv';
import type { S3Config } from './types/index.js';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  s3: S3Config;
  cypress: {
    baseUrl: string;
    specsDir: string;
    videosDir: string;
    screenshotsDir: string;
    defaultTimeout: number;
    defaultBrowser: string;
  };
  playwright: {
    baseUrl: string;
    specsDir: string;
    outputDir: string;
    videosDir: string;
    screenshotsDir: string;
    tracesDir: string;
    defaultTimeout: number;
    defaultBrowser: string;
  };
  queue: {
    name: string;
    concurrency: number;
    maxRetries: number;
  };
  cors: {
    origin: string | string[];
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

export const config: Config = {
  port: getEnvNumber('PORT', 8082),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
  },

  s3: {
    endpoint: getEnv('S3_ENDPOINT', 'http://localhost:9000'),
    region: getEnv('S3_REGION', 'us-east-1'),
    bucket: getEnv('S3_BUCKET', 'test-artifacts'),
    accessKeyId: getEnv('S3_ACCESS_KEY_ID', 'minioadmin'),
    secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY', 'minioadmin'),
    forcePathStyle: true,
  },

  cypress: {
    baseUrl: getEnv('CYPRESS_BASE_URL', 'http://localhost:3000'),
    specsDir: getEnv('CYPRESS_SPECS_DIR', './cypress/e2e'),
    videosDir: getEnv('CYPRESS_VIDEOS_DIR', './cypress/videos'),
    screenshotsDir: getEnv('CYPRESS_SCREENSHOTS_DIR', './cypress/screenshots'),
    defaultTimeout: getEnvNumber('CYPRESS_DEFAULT_TIMEOUT', 10000),
    defaultBrowser: getEnv('CYPRESS_DEFAULT_BROWSER', 'electron'),
  },

  playwright: {
    baseUrl: getEnv('PLAYWRIGHT_BASE_URL', 'http://localhost:3000'),
    specsDir: getEnv('PLAYWRIGHT_SPECS_DIR', './playwright/tests'),
    outputDir: getEnv('PLAYWRIGHT_OUTPUT_DIR', './playwright/test-results'),
    videosDir: getEnv('PLAYWRIGHT_VIDEOS_DIR', './playwright/videos'),
    screenshotsDir: getEnv('PLAYWRIGHT_SCREENSHOTS_DIR', './playwright/screenshots'),
    tracesDir: getEnv('PLAYWRIGHT_TRACES_DIR', './playwright/traces'),
    defaultTimeout: getEnvNumber('PLAYWRIGHT_DEFAULT_TIMEOUT', 30000),
    defaultBrowser: getEnv('PLAYWRIGHT_DEFAULT_BROWSER', 'chromium'),
  },

  queue: {
    name: getEnv('QUEUE_NAME', 'test-runner'),
    concurrency: getEnvNumber('QUEUE_CONCURRENCY', 2),
    maxRetries: getEnvNumber('QUEUE_MAX_RETRIES', 3),
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
    ],
  },
};

export default config;
