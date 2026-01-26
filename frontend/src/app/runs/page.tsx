'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Card, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faTimes,
  faClock,
  faPlay,
  faCalendar,
  faRedo,
  faChevronRight,
  faExclamationTriangle,
  faSync,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/project-context';
import { executionsApi, TestExecution } from '@/lib/api';

interface TestRun {
  id: string;
  name: string;
  scenarioId: string;
  status: 'passed' | 'failed' | 'running' | 'pending' | 'queued' | 'cancelled' | 'timeout';
  duration: string;
  timestamp: string;
  passed: number;
  failed: number;
  total: number;
  startedAt?: string;
  scenario?: {
    id: string;
    name: string;
    steps: unknown[];
  };
}

const STORAGE_KEY = 'test-runs-history';

// Format duration from milliseconds to human readable
const formatDuration = (ms?: number): string => {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

// Format timestamp to relative time
const formatTimestamp = (date?: string): string => {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString();
};

// Convert API execution to TestRun
const mapExecutionToRun = (execution: TestExecution): TestRun => {
  const status = execution.status === 'timeout' ? 'failed' : execution.status;
  return {
    id: execution.id,
    name: execution.scenarioName || `Test ${execution.scenarioId}`,
    scenarioId: execution.scenarioId,
    status: status as TestRun['status'],
    duration: formatDuration(execution.duration),
    timestamp: formatTimestamp(execution.startedAt),
    passed: execution.results?.passed ?? 0,
    failed: execution.results?.failed ?? 0,
    total: execution.results?.total ?? 0,
    startedAt: execution.startedAt,
  };
};

// localStorage helpers
const saveRunsToStorage = (runs: TestRun[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    console.warn('Failed to save runs to localStorage');
  }
};

const loadRunsFromStorage = (): TestRun[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load runs from localStorage');
  }
  return [];
};

export default function RunsPage() {
  const router = useRouter();
  const { currentProject } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  // Fetch runs from API and merge with localStorage
  const fetchRuns = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    setError(null);

    try {
      const response = await executionsApi.list();
      const apiRuns = response.executions.map(mapExecutionToRun);

      // Load stored runs
      const storedRuns = loadRunsFromStorage();

      // Merge: API runs take precedence, add any stored runs not in API
      const apiRunIds = new Set(apiRuns.map(r => r.id));
      const mergedRuns = [
        ...apiRuns,
        ...storedRuns.filter(r => !apiRunIds.has(r.id)),
      ];

      // Sort by timestamp (most recent first)
      mergedRuns.sort((a, b) => {
        const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return dateB - dateA;
      });

      setRuns(mergedRuns);
      saveRunsToStorage(mergedRuns);
    } catch (err) {
      console.warn('Failed to fetch from API, using localStorage:', err);
      // Fall back to localStorage if API is unavailable
      const storedRuns = loadRunsFromStorage();
      if (storedRuns.length > 0) {
        setRuns(storedRuns);
      } else {
        setError('Unable to connect to test runner service');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!currentProject) {
      router.push('/');
      return;
    }

    fetchRuns();

    // Poll for updates every 10 seconds if there are running tests
    const interval = setInterval(() => {
      const hasRunning = runs.some(r => r.status === 'running' || r.status === 'queued');
      if (hasRunning) {
        fetchRuns();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentProject, router, fetchRuns, runs]);

  // Handle click on a run to view details
  const handleRunClick = (run: TestRun) => {
    router.push(`/runs/${run.id}`);
  };

  // Handle re-run
  const handleRerun = async (e: React.MouseEvent, run: TestRun) => {
    e.stopPropagation(); // Prevent triggering the card click
    setRerunningId(run.id);

    try {
      const response = await executionsApi.run({
        scenarioId: run.scenarioId,
        scenario: run.scenario || {
          id: run.scenarioId,
          name: run.name,
          steps: [],
        },
      });

      // Add the new run to state immediately
      const newRun: TestRun = {
        id: response.executionId,
        name: run.name,
        scenarioId: run.scenarioId,
        status: 'queued',
        duration: '0s',
        timestamp: 'Just now',
        passed: 0,
        failed: 0,
        total: 0,
        startedAt: new Date().toISOString(),
        scenario: run.scenario,
      };

      setRuns(prev => {
        const updated = [newRun, ...prev];
        saveRunsToStorage(updated);
        return updated;
      });

      // Refresh to get latest status
      setTimeout(() => fetchRuns(), 1000);
    } catch (err) {
      console.error('Failed to re-run test:', err);
      setError('Failed to re-run test. Is the test runner service running?');
    } finally {
      setRerunningId(null);
    }
  };

  if (!currentProject) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Spinner className="mb-4" />
        <p className="text-text-secondary">Loading run history...</p>
      </div>
    );
  }

  const getStatusIcon = (status: TestRun['status']) => {
    switch (status) {
      case 'passed':
        return <FontAwesomeIcon icon={faCheck} className="text-neutral-900" />;
      case 'failed':
      case 'timeout':
        return <FontAwesomeIcon icon={faTimes} className="text-neutral-600" />;
      case 'running':
        return <FontAwesomeIcon icon={faPlay} className="text-neutral-700 animate-pulse" />;
      case 'queued':
        return <FontAwesomeIcon icon={faClock} className="text-neutral-500" />;
      case 'cancelled':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-neutral-400" />;
      case 'pending':
      default:
        return <FontAwesomeIcon icon={faClock} className="text-neutral-400" />;
    }
  };

  const getStatusColor = (status: TestRun['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-neutral-900 text-white';
      case 'failed':
      case 'timeout':
        return 'bg-neutral-600 text-white';
      case 'running':
        return 'bg-neutral-700 text-white';
      case 'queued':
        return 'bg-neutral-400 text-white';
      case 'cancelled':
        return 'bg-neutral-200 text-neutral-700';
      case 'pending':
      default:
        return 'bg-neutral-200 text-neutral-700';
    }
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Run History</h1>
            <p className="text-sm text-text-secondary">
              {currentProject.name} • {runs.length} test runs
            </p>
          </div>
          <button
            onClick={() => fetchRuns(true)}
            disabled={isRefreshing}
            className={cn(
              'px-4 py-2 rounded-lg border border-neutral-200 bg-white',
              'hover:bg-neutral-50 transition-colors',
              'flex items-center gap-2 text-sm text-neutral-700',
              isRefreshing && 'opacity-50 cursor-not-allowed'
            )}
          >
            <FontAwesomeIcon icon={faSync} className={cn('text-neutral-500', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-neutral-100 border border-neutral-200 rounded-lg flex items-center gap-3">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-neutral-600" />
            <p className="text-sm text-neutral-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-neutral-500 hover:text-neutral-700"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">{runs.length}</p>
            <p className="text-sm text-neutral-500">Total Runs</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">
              {runs.filter(r => r.status === 'passed').length}
            </p>
            <p className="text-sm text-neutral-500">Passed</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">
              {runs.filter(r => r.status === 'failed' || r.status === 'timeout').length}
            </p>
            <p className="text-sm text-neutral-500">Failed</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">
              {runs.filter(r => r.status === 'running' || r.status === 'queued').length}
            </p>
            <p className="text-sm text-text-secondary">Running</p>
          </div>
        </div>

        {/* Runs List */}
        {runs.length === 0 ? (
          <Card className="p-8 text-center">
            <FontAwesomeIcon icon={faPlay} className="text-4xl text-text-tertiary mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No test runs yet</h3>
            <p className="text-text-secondary">Run your first test to see results here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Card
                key={run.id}
                hoverable
                className="p-4 cursor-pointer group"
                onClick={() => handleRunClick(run)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                    {getStatusIcon(run.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{run.name}</h4>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(run.status))}>
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-tertiary mt-1">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faCalendar} />
                        {run.timestamp}
                      </span>
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faClock} />
                        {run.duration}
                      </span>
                      <span className="text-gray-400 font-mono text-[10px]">
                        {run.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <div className="text-sm font-medium">
                      <span className="text-green-600">{run.passed}</span>
                      <span className="text-text-tertiary mx-1">/</span>
                      <span className="text-red-600">{run.failed}</span>
                      <span className="text-text-tertiary mx-1">/</span>
                      <span>{run.total}</span>
                    </div>
                    <p className="text-xs text-text-tertiary">passed / failed / total</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Re-run button */}
                    <button
                      onClick={(e) => handleRerun(e, run)}
                      disabled={rerunningId === run.id || run.status === 'running' || run.status === 'queued'}
                      className={cn(
                        'p-2 rounded-lg border border-neutral-200 text-neutral-500',
                        'hover:bg-neutral-900 hover:text-white hover:border-neutral-900',
                        'transition-colors',
                        (rerunningId === run.id || run.status === 'running' || run.status === 'queued') &&
                          'opacity-50 cursor-not-allowed'
                      )}
                      title="Re-run this test"
                    >
                      <FontAwesomeIcon
                        icon={faRedo}
                        className={cn(rerunningId === run.id && 'animate-spin')}
                      />
                    </button>
                    {/* View details arrow */}
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="text-neutral-400 group-hover:text-neutral-900 transition-colors"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
