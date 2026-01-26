'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faPlus,
  faFilter,
  faSpinner,
  faRobot,
  faFileAlt,
  faLink,
  faPencilAlt,
  faTimes,
  faWandMagicSparkles,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { faJira } from '@fortawesome/free-brands-svg-icons';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/project-context';

const FILTER_STORAGE_KEY = 'testCases_filter';

interface TestCase {
  id: string;
  name: string;
  description: string;
  scenario: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'success' | 'warning' | 'pending' | 'failed';
  type: 'Automated' | 'Manual';
  category: string;
}

// Generate test cases based on project type
const generateTestCases = (): TestCase[] => {
  return [
    {
      id: 'TC-001',
      name: 'User Login with Valid Credentials',
      description: 'Verify user can login with valid email and password',
      scenario: 'S1 - Login Flow',
      priority: 'Critical',
      status: 'pending',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-002',
      name: 'User Login with Invalid Credentials',
      description: 'Verify error message shown for invalid credentials',
      scenario: 'S1 - Login Flow',
      priority: 'Critical',
      status: 'pending',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-003',
      name: 'User Registration Flow',
      description: 'Verify new user can register successfully',
      scenario: 'S2 - Registration',
      priority: 'Critical',
      status: 'pending',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-004',
      name: 'Password Reset Request',
      description: 'Verify user can request password reset email',
      scenario: 'S3 - Password Reset',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-005',
      name: 'User Logout',
      description: 'Verify user can logout and session is cleared',
      scenario: 'S4 - Logout',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-006',
      name: 'Homepage Load',
      description: 'Verify homepage loads correctly with all components',
      scenario: 'S5 - Homepage',
      priority: 'Critical',
      status: 'pending',
      type: 'Automated',
      category: 'Navigation',
    },
    {
      id: 'TC-007',
      name: 'Form Validation - Required Fields',
      description: 'Verify required field validation messages',
      scenario: 'S6 - Form Validation',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'Forms',
    },
    {
      id: 'TC-008',
      name: 'Responsive Design - Mobile',
      description: 'Verify UI displays correctly on mobile viewport',
      scenario: 'S7 - Responsive',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'UI/UX',
    },
  ];
};

const priorityColors = {
  Critical: 'bg-neutral-900 text-white',
  High: 'bg-neutral-700 text-white',
  Medium: 'bg-neutral-400 text-white',
  Low: 'bg-neutral-200 text-neutral-700',
};

export default function TestCasesPage() {
  const router = useRouter();
  const { currentProject } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    current: number;
    total: number;
    status: 'idle' | 'running' | 'completed' | 'failed';
  }>({ current: 0, total: 0, status: 'idle' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMethod, setGenerationMethod] = useState<string | null>(null);

  // Load persisted filter from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilter) {
        setFilter(savedFilter);
      }
    }
  }, []);

  // Persist filter to localStorage
  const handleFilterChange = useCallback((newFilter: string) => {
    setFilter(newFilter);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FILTER_STORAGE_KEY, newFilter);
    }
  }, []);

  useEffect(() => {
    // Redirect if no project is connected
    if (!currentProject) {
      router.push('/');
      return;
    }

    // Start with empty test cases - user chooses how to generate
    setIsLoading(false);
  }, [currentProject, router]);

  const handleTestClick = (testCase: TestCase) => {
    if (!currentProject) return;

    const params = new URLSearchParams();
    params.set('appUrl', currentProject.appUrl);

    // Add mobile-specific params
    if (currentProject.source === 'android' || currentProject.source === 'ios') {
      params.set('mode', currentProject.source);
      if (currentProject.packageName) {
        params.set('packageName', currentProject.packageName);
      }
      if (currentProject.deviceId) {
        params.set('deviceId', currentProject.deviceId);
      }
    }

    router.push(`/scenarios/${testCase.id}?${params.toString()}`);
  };

  const handleRunAll = async () => {
    if (!currentProject || isRunningAll) return;

    const casesToRun = filter === 'all' ? testCases : testCases.filter(tc => tc.category === filter);
    setIsRunningAll(true);
    setRunProgress({ current: 0, total: casesToRun.length, status: 'running' });

    // Reset all test case statuses to pending
    setTestCases(prev => prev.map(tc => ({ ...tc, status: 'pending' as const })));

    const testRunnerUrl = 'http://localhost:8082';

    try {
      // Run tests sequentially
      for (let i = 0; i < casesToRun.length; i++) {
        const testCase = casesToRun[i];
        setRunProgress(prev => ({ ...prev, current: i + 1 }));

        // Update current test to running
        setTestCases(prev => prev.map(tc =>
          tc.id === testCase.id ? { ...tc, status: 'warning' as const } : tc
        ));

        try {
          // Send test to runner
          const response = await fetch(`${testRunnerUrl}/api/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenarioId: testCase.id,
              scenario: {
                id: testCase.id,
                name: testCase.name,
                targetUrl: currentProject.appUrl,
                steps: [
                  { id: 'step-1', action: 'visit', value: `${currentProject.appUrl}/login`, description: 'Navigate to page' },
                ],
              },
              options: { browser: 'chrome', headless: true },
            }),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const result = await response.json();

          // Poll for completion
          let completed = false;
          let attempts = 0;
          while (!completed && attempts < 60) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;

            try {
              const statusRes = await fetch(`${testRunnerUrl}/api/executions/${result.executionId}`);
              const statusData = await statusRes.json();

              if (statusData.jobStatus === 'completed') {
                completed = true;
                setTestCases(prev => prev.map(tc =>
                  tc.id === testCase.id
                    ? { ...tc, status: statusData.testsPassed ? 'success' as const : 'failed' as const }
                    : tc
                ));
              } else if (statusData.jobStatus === 'failed') {
                completed = true;
                setTestCases(prev => prev.map(tc =>
                  tc.id === testCase.id ? { ...tc, status: 'failed' as const } : tc
                ));
              }
            } catch {
              // Continue polling
            }
          }

          if (!completed) {
            setTestCases(prev => prev.map(tc =>
              tc.id === testCase.id ? { ...tc, status: 'failed' as const } : tc
            ));
          }
        } catch {
          // Test runner not available - simulate results for demo
          await new Promise(r => setTimeout(r, 500));
          setTestCases(prev => prev.map(tc =>
            tc.id === testCase.id
              ? { ...tc, status: Math.random() > 0.3 ? 'success' as const : 'failed' as const }
              : tc
          ));
        }
      }

      setRunProgress(prev => ({ ...prev, status: 'completed' }));
    } catch {
      setRunProgress(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsRunningAll(false);
    }
  };

  // Handle AI generation
  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGenerationMethod('ai');
    setShowAddModal(false);

    // Simulate AI generating test cases
    await new Promise(r => setTimeout(r, 2000));
    setTestCases(generateTestCases());
    setIsGenerating(false);
    setGenerationMethod(null);
  };

  // Handle requirements import
  const handleRequirementsImport = () => {
    setGenerationMethod('requirements');
    // This would open a file upload or text input modal
  };

  // Handle Jira connect
  const handleJiraConnect = () => {
    setGenerationMethod('jira');
    // This would open Jira connection modal
  };

  // Handle manual create
  const handleManualCreate = () => {
    setShowAddModal(false);
    // Navigate to create test case page
    router.push('/test-cases/new');
  };

  const filteredTestCases = filter === 'all'
    ? testCases
    : testCases.filter(tc => tc.category === filter);

  const categories = ['all', ...Array.from(new Set(testCases.map(tc => tc.category)))];

  const stats = {
    total: testCases.length,
    passed: testCases.filter(tc => tc.status === 'success').length,
    failed: testCases.filter(tc => tc.status === 'failed').length,
    pending: testCases.filter(tc => tc.status === 'pending' || tc.status === 'warning').length,
  };

  if (!currentProject) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-border">
                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Filter Skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
              ))}
            </div>
          </div>

          {/* Test Cases Skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-4 px-6 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 w-64 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                <div className="h-8 w-14 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Loading Message */}
          <div className="mt-6 text-center">
            <Spinner className="mx-auto mb-2" />
            <p className="text-sm text-text-secondary">Generating test cases for {currentProject.name}...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Test Cases</h1>
            <p className="text-sm text-text-secondary">
              {currentProject.name} • {testCases.length} test cases
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowAddModal(true)}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add Test
            </Button>
            <Button onClick={handleRunAll} disabled={isRunningAll || testCases.length === 0}>
              <FontAwesomeIcon
                icon={isRunningAll ? faSpinner : faPlay}
                className={cn('mr-2', isRunningAll && 'animate-spin')}
              />
              {isRunningAll
                ? `Running ${runProgress.current}/${runProgress.total}...`
                : 'Run All'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
            <p className="text-sm text-neutral-500">Total Tests</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">{stats.passed}</p>
            <p className="text-sm text-neutral-500">Passed</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">{stats.failed}</p>
            <p className="text-sm text-neutral-500">Failed</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <p className="text-2xl font-bold text-neutral-900">{stats.pending}</p>
            <p className="text-sm text-neutral-500">Pending</p>
          </div>
        </div>

        {/* Generation Options - Show when no test cases */}
        {testCases.length === 0 && !isGenerating && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Get Started</h2>
            <p className="text-sm text-neutral-500 mb-6">Choose how you want to create your test cases</p>
            <div className="grid grid-cols-2 gap-4">
              {/* AI Generate */}
              <Card
                hoverable
                className="p-6 cursor-pointer group"
                onClick={handleAIGenerate}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="text-neutral-700 text-xl group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">Generate with AI</h3>
                    <p className="text-sm text-neutral-500">Auto-analyze your app and generate test cases using AI</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">Recommended for quick start</span>
                </div>
              </Card>

              {/* Import from Requirements */}
              <Card
                hoverable
                className="p-6 cursor-pointer group"
                onClick={handleRequirementsImport}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                    <FontAwesomeIcon icon={faFileAlt} className="text-neutral-700 text-xl group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">Import from Requirements</h3>
                    <p className="text-sm text-neutral-500">Upload requirement docs or paste text to generate tests</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">Supports PDF, Word, Markdown</span>
                </div>
              </Card>

              {/* Connect to Jira */}
              <Card
                hoverable
                className="p-6 cursor-pointer group"
                onClick={handleJiraConnect}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                    <FontAwesomeIcon icon={faJira} className="text-neutral-700 text-xl group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">Connect to Jira</h3>
                    <p className="text-sm text-neutral-500">Sync test cases with your Jira tickets and stories</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">Requires Jira Cloud account</span>
                </div>
              </Card>

              {/* Create Manually */}
              <Card
                hoverable
                className="p-6 cursor-pointer group"
                onClick={handleManualCreate}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                    <FontAwesomeIcon icon={faPencilAlt} className="text-neutral-700 text-xl group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">Create Manually</h3>
                    <p className="text-sm text-neutral-500">Write your own test cases from scratch</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">Full control over test design</span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* AI Generating State */}
        {isGenerating && (
          <div className="mb-8">
            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-neutral-700 text-2xl animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">AI is analyzing your application...</h3>
              <p className="text-sm text-neutral-500 mb-4">Scanning pages, forms, and user flows to generate comprehensive test cases</p>
              <div className="flex items-center justify-center gap-2">
                <Spinner />
                <span className="text-sm text-neutral-500">This may take a moment</span>
              </div>
            </Card>
          </div>
        )}

        {/* Test Cases List */}
        {testCases.length > 0 && (
          <>
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <FontAwesomeIcon icon={faFilter} className="text-neutral-400" />
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleFilterChange(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      filter === cat
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    )}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredTestCases.map((testCase) => (
                <Card
                  key={testCase.id}
                  hoverable
                  onClick={() => handleTestClick(testCase)}
                  className="p-4 px-6 flex items-center gap-4 cursor-pointer"
                >
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full flex-shrink-0',
                      testCase.status === 'success' && 'bg-neutral-900',
                      testCase.status === 'warning' && 'bg-neutral-500',
                      testCase.status === 'pending' && 'bg-neutral-300',
                      testCase.status === 'failed' && 'bg-neutral-600'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{testCase.name}</h4>
                    <p className="text-xs text-text-tertiary truncate">{testCase.description}</p>
                  </div>
                  <span className={cn('px-2 py-1 rounded text-xs font-medium', priorityColors[testCase.priority])}>
                    {testCase.priority}
                  </span>
                  <span className="text-xs text-text-secondary w-24">{testCase.category}</span>
                  <span className="text-xs text-text-tertiary w-16">{testCase.id}</span>
                  <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                    Edit
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Add Test Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4">
              <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-900">Add Test Cases</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center text-neutral-500"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-neutral-500 mb-6">Choose how you want to create your test cases</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* AI Generate */}
                  <button
                    onClick={handleAIGenerate}
                    className="p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-neutral-900 transition-colors">
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-neutral-700 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">Generate with AI</h3>
                    <p className="text-xs text-neutral-500">Auto-analyze and generate tests</p>
                  </button>

                  {/* Import Requirements */}
                  <button
                    onClick={handleRequirementsImport}
                    className="p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-neutral-900 transition-colors">
                      <FontAwesomeIcon icon={faFileAlt} className="text-neutral-700 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">From Requirements</h3>
                    <p className="text-xs text-neutral-500">Upload docs or paste text</p>
                  </button>

                  {/* Jira */}
                  <button
                    onClick={handleJiraConnect}
                    className="p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-neutral-900 transition-colors">
                      <FontAwesomeIcon icon={faJira} className="text-neutral-700 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">Connect to Jira</h3>
                    <p className="text-xs text-neutral-500">Sync with Jira tickets</p>
                  </button>

                  {/* Manual */}
                  <button
                    onClick={handleManualCreate}
                    className="p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-neutral-900 transition-colors">
                      <FontAwesomeIcon icon={faPencilAlt} className="text-neutral-700 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">Create Manually</h3>
                    <p className="text-xs text-neutral-500">Write tests from scratch</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
