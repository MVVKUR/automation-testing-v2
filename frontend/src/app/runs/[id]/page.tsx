'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Card, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faTimes,
  faClock,
  faPlay,
  faArrowLeft,
  faRedo,
  faDownload,
  faExclamationTriangle,
  faFile,
  faImage,
  faVideo,
  faFileAlt,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/project-context';
import { executionsApi, ExecutionDetails } from '@/lib/api';

interface RunDetails {
  id: string;
  name: string;
  scenarioId: string;
  status: 'pending' | 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';
  duration: number;
  startedAt?: string;
  completedAt?: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  progress: number;
  error?: string;
  artifacts: string[];
}

const STORAGE_KEY = 'test-runs-history';

// Format duration from milliseconds
const formatDuration = (ms?: number): string => {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

// Format date
const formatDate = (date?: string): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
};

// Get artifact icon based on file extension
const getArtifactIcon = (artifact: string) => {
  if (artifact.match(/\.(png|jpg|jpeg|gif)$/i)) return faImage;
  if (artifact.match(/\.(mp4|webm|mov)$/i)) return faVideo;
  if (artifact.match(/\.(log|txt)$/i)) return faFileAlt;
  return faFile;
};

// Load run from localStorage
const loadRunFromStorage = (id: string): RunDetails | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const runs = JSON.parse(stored);
      const run = runs.find((r: { id: string }) => r.id === id);
      if (run) {
        return {
          id: run.id,
          name: run.name,
          scenarioId: run.scenarioId,
          status: run.status,
          duration: 0,
          startedAt: run.startedAt,
          passed: run.passed || 0,
          failed: run.failed || 0,
          skipped: 0,
          total: run.total || 0,
          progress: 100,
          artifacts: [],
        };
      }
    }
  } catch {
    console.warn('Failed to load run from localStorage');
  }
  return null;
};

export default function RunDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { currentProject } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [run, setRun] = useState<RunDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);

  const fetchRunDetails = useCallback(async () => {
    setError(null);

    try {
      const response: ExecutionDetails = await executionsApi.get(id);
      setRun({
        id: response.id,
        name: response.scenarioName || `Test ${response.scenarioId}`,
        scenarioId: response.scenarioId,
        status: response.status,
        duration: response.duration || 0,
        startedAt: response.startedAt,
        completedAt: response.completedAt,
        passed: response.testResults?.passed ?? response.results?.passed ?? 0,
        failed: response.testResults?.failed ?? response.results?.failed ?? 0,
        skipped: response.results?.skipped ?? 0,
        total: response.results?.total ?? 0,
        progress: response.progress,
        error: response.error,
        artifacts: response.artifacts || [],
      });
    } catch (err) {
      console.warn('Failed to fetch from API, checking localStorage:', err);
      // Try localStorage fallback
      const storedRun = loadRunFromStorage(id);
      if (storedRun) {
        setRun(storedRun);
      } else {
        setError('Run not found');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!currentProject) {
      router.push('/');
      return;
    }

    fetchRunDetails();

    // Poll if running
    const interval = setInterval(() => {
      if (run?.status === 'running' || run?.status === 'queued') {
        fetchRunDetails();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentProject, router, fetchRunDetails, run?.status]);

  const handleRerun = async () => {
    if (!run) return;
    setIsRerunning(true);

    try {
      const response = await executionsApi.run({
        scenarioId: run.scenarioId,
        scenario: {
          id: run.scenarioId,
          name: run.name,
          steps: [],
        },
      });

      // Navigate to the new run
      router.push(`/runs/${response.executionId}`);
    } catch (err) {
      console.error('Failed to re-run test:', err);
      setError('Failed to re-run test. Is the test runner service running?');
    } finally {
      setIsRerunning(false);
    }
  };

  const handleBack = () => {
    router.push('/runs');
  };

  if (!currentProject) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Spinner className="mb-4" />
        <p className="text-text-secondary">Loading run details...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl text-yellow-500 mb-4" />
        <h2 className="text-xl font-medium text-text-primary mb-2">Run Not Found</h2>
        <p className="text-text-secondary mb-4">The requested test run could not be found.</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Back to Runs
        </button>
      </div>
    );
  }

  const getStatusIcon = (status: RunDetails['status']) => {
    switch (status) {
      case 'passed':
        return <FontAwesomeIcon icon={faCheck} className="text-green-500" />;
      case 'failed':
      case 'timeout':
        return <FontAwesomeIcon icon={faTimes} className="text-red-500" />;
      case 'running':
        return <FontAwesomeIcon icon={faPlay} className="text-blue-500 animate-pulse" />;
      case 'queued':
        return <FontAwesomeIcon icon={faClock} className="text-yellow-500" />;
      case 'cancelled':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-gray-500" />;
      default:
        return <FontAwesomeIcon icon={faClock} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: RunDetails['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-700';
      case 'failed':
      case 'timeout':
        return 'bg-red-100 text-red-700';
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'queued':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const passRate = run.total > 0 ? Math.round((run.passed / run.total) * 100) : 0;

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Runs
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100">
                {getStatusIcon(run.status)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-text-primary">{run.name}</h1>
                  <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(run.status))}>
                    {run.status}
                  </span>
                </div>
                <p className="text-sm text-text-secondary font-mono">{run.id}</p>
              </div>
            </div>
            <button
              onClick={handleRerun}
              disabled={isRerunning || run.status === 'running' || run.status === 'queued'}
              className={cn(
                'px-4 py-2 rounded-lg bg-primary text-white',
                'hover:bg-primary-dark transition-colors',
                'flex items-center gap-2',
                (isRerunning || run.status === 'running' || run.status === 'queued') &&
                  'opacity-50 cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faRedo} className={cn(isRerunning && 'animate-spin')} />
              Re-run Test
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Progress Bar (for running tests) */}
        {(run.status === 'running' || run.status === 'queued') && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-text-secondary">{run.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${run.progress}%` }}
              />
            </div>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-text-primary">{run.total}</p>
            <p className="text-sm text-text-secondary">Total Tests</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{run.passed}</p>
            <p className="text-sm text-text-secondary">Passed</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{run.failed}</p>
            <p className="text-sm text-text-secondary">Failed</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{run.skipped}</p>
            <p className="text-sm text-text-secondary">Skipped</p>
          </Card>
        </div>

        {/* Pass Rate */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pass Rate</span>
            <span className="text-sm font-bold">{passRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={cn(
                'h-3 rounded-full transition-all',
                passRate >= 80 ? 'bg-green-500' : passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${passRate}%` }}
            />
          </div>
        </Card>

        {/* Details */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Execution Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-secondary">Started</p>
              <p className="font-medium">{formatDate(run.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Completed</p>
              <p className="font-medium">{formatDate(run.completedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Duration</p>
              <p className="font-medium">{formatDuration(run.duration)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Scenario ID</p>
              <p className="font-medium font-mono text-sm">{run.scenarioId}</p>
            </div>
          </div>
        </Card>

        {/* Error Message */}
        {run.error && (
          <Card className="p-6 mb-6 border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold mb-2 text-red-700">Error</h2>
            <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono bg-white p-4 rounded-lg overflow-auto">
              {run.error}
            </pre>
          </Card>
        )}

        {/* Artifacts */}
        {run.artifacts.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Artifacts ({run.artifacts.length})</h2>
            <div className="space-y-2">
              {run.artifacts.map((artifact, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={getArtifactIcon(artifact)} className="text-text-tertiary" />
                    <span className="text-sm font-medium">{artifact.split('/').pop()}</span>
                  </div>
                  <button
                    className="p-2 text-text-tertiary hover:text-primary transition-colors"
                    title="Download artifact"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty Artifacts */}
        {run.artifacts.length === 0 && run.status !== 'running' && run.status !== 'queued' && (
          <Card className="p-6 text-center">
            <FontAwesomeIcon icon={faFile} className="text-3xl text-text-tertiary mb-2" />
            <p className="text-text-secondary">No artifacts available for this run.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
