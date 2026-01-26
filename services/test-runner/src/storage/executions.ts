import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { TestExecution } from '../types/index.js';

const STORAGE_DIR = join(process.cwd(), 'data');
const EXECUTIONS_FILE = join(STORAGE_DIR, 'executions.json');

interface ExecutionsStore {
  executions: TestExecution[];
  lastUpdated: string;
}

function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadStore(): ExecutionsStore {
  ensureStorageDir();

  if (!existsSync(EXECUTIONS_FILE)) {
    return { executions: [], lastUpdated: new Date().toISOString() };
  }

  try {
    const data = readFileSync(EXECUTIONS_FILE, 'utf-8');
    return JSON.parse(data) as ExecutionsStore;
  } catch (error) {
    console.error('Error loading executions store:', error);
    return { executions: [], lastUpdated: new Date().toISOString() };
  }
}

function saveStore(store: ExecutionsStore): void {
  ensureStorageDir();

  try {
    store.lastUpdated = new Date().toISOString();
    writeFileSync(EXECUTIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving executions store:', error);
  }
}

export function getAllExecutions(): TestExecution[] {
  const store = loadStore();
  return store.executions;
}

export function getExecution(id: string): TestExecution | undefined {
  const store = loadStore();
  return store.executions.find((e) => e.id === id);
}

export function saveExecution(execution: TestExecution): void {
  const store = loadStore();
  const existingIndex = store.executions.findIndex((e) => e.id === execution.id);

  if (existingIndex >= 0) {
    store.executions[existingIndex] = execution;
  } else {
    store.executions.push(execution);
  }

  saveStore(store);
}

export function updateExecution(id: string, updates: Partial<TestExecution>): TestExecution | undefined {
  const store = loadStore();
  const existingIndex = store.executions.findIndex((e) => e.id === id);

  if (existingIndex < 0) {
    return undefined;
  }

  store.executions[existingIndex] = {
    ...store.executions[existingIndex],
    ...updates,
  };

  saveStore(store);
  return store.executions[existingIndex];
}

export function deleteExecution(id: string): boolean {
  const store = loadStore();
  const existingIndex = store.executions.findIndex((e) => e.id === id);

  if (existingIndex < 0) {
    return false;
  }

  store.executions.splice(existingIndex, 1);
  saveStore(store);
  return true;
}

export function getExecutionsByStatus(status: string): TestExecution[] {
  const store = loadStore();
  return store.executions.filter((e) => e.status === status);
}

export function getRecentExecutions(limit: number = 50): TestExecution[] {
  const store = loadStore();
  return store.executions
    .sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit);
}
