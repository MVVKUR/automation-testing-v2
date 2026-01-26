'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button, Card, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlay, faPlus, faFilter } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

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

// Generate test cases based on project type (React/Next.js app patterns)
const generateTestCases = (projectName: string): TestCase[] => {
  return [
    // Authentication Tests
    {
      id: 'TC-001',
      name: 'User Login with Valid Credentials',
      description: 'Verify user can login with valid email and password',
      scenario: 'S1 - Login Flow',
      priority: 'Critical',
      status: 'success',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-002',
      name: 'User Login with Invalid Credentials',
      description: 'Verify error message shown for invalid credentials',
      scenario: 'S1 - Login Flow',
      priority: 'Critical',
      status: 'success',
      type: 'Automated',
      category: 'Authentication',
    },
    {
      id: 'TC-003',
      name: 'User Registration Flow',
      description: 'Verify new user can register successfully',
      scenario: 'S2 - Registration',
      priority: 'Critical',
      status: 'warning',
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
      status: 'success',
      type: 'Automated',
      category: 'Authentication',
    },

    // Navigation Tests
    {
      id: 'TC-006',
      name: 'Homepage Load',
      description: 'Verify homepage loads correctly with all components',
      scenario: 'S5 - Homepage',
      priority: 'Critical',
      status: 'success',
      type: 'Automated',
      category: 'Navigation',
    },
    {
      id: 'TC-007',
      name: 'Navigation Menu Links',
      description: 'Verify all navigation links work correctly',
      scenario: 'S6 - Navigation',
      priority: 'High',
      status: 'success',
      type: 'Automated',
      category: 'Navigation',
    },
    {
      id: 'TC-008',
      name: 'Breadcrumb Navigation',
      description: 'Verify breadcrumb shows correct path and links work',
      scenario: 'S7 - Breadcrumbs',
      priority: 'Medium',
      status: 'pending',
      type: 'Automated',
      category: 'Navigation',
    },

    // Form Tests
    {
      id: 'TC-009',
      name: 'Form Validation - Required Fields',
      description: 'Verify required field validation messages',
      scenario: 'S8 - Form Validation',
      priority: 'High',
      status: 'warning',
      type: 'Automated',
      category: 'Forms',
    },
    {
      id: 'TC-010',
      name: 'Form Validation - Email Format',
      description: 'Verify email format validation',
      scenario: 'S8 - Form Validation',
      priority: 'Medium',
      status: 'success',
      type: 'Automated',
      category: 'Forms',
    },
    {
      id: 'TC-011',
      name: 'Form Submission Success',
      description: 'Verify form submits successfully with valid data',
      scenario: 'S9 - Form Submit',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'Forms',
    },

    // UI/UX Tests
    {
      id: 'TC-012',
      name: 'Responsive Design - Mobile',
      description: 'Verify UI displays correctly on mobile viewport',
      scenario: 'S10 - Responsive',
      priority: 'High',
      status: 'warning',
      type: 'Automated',
      category: 'UI/UX',
    },
    {
      id: 'TC-013',
      name: 'Responsive Design - Tablet',
      description: 'Verify UI displays correctly on tablet viewport',
      scenario: 'S10 - Responsive',
      priority: 'Medium',
      status: 'pending',
      type: 'Automated',
      category: 'UI/UX',
    },
    {
      id: 'TC-014',
      name: 'Loading States',
      description: 'Verify loading indicators display during async operations',
      scenario: 'S11 - Loading States',
      priority: 'Medium',
      status: 'success',
      type: 'Automated',
      category: 'UI/UX',
    },
    {
      id: 'TC-015',
      name: 'Error State Display',
      description: 'Verify error messages display correctly',
      scenario: 'S12 - Error Handling',
      priority: 'High',
      status: 'pending',
      type: 'Automated',
      category: 'UI/UX',
    },

    // API Integration Tests
    {
      id: 'TC-016',
      name: 'API Data Fetch',
      description: 'Verify data is fetched and displayed from API',
      scenario: 'S13 - API Integration',
      priority: 'Critical',
      status: 'success',
      type: 'Automated',
      category: 'API',
    },
    {
      id: 'TC-017',
      name: 'API Error Handling',
      description: 'Verify app handles API errors gracefully',
      scenario: 'S14 - API Errors',
      priority: 'High',
      status: 'warning',
      type: 'Automated',
      category: 'API',
    },
  ];
};

const priorityColors = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-600',
};

export default function TestCasesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const repoUrl = searchParams.get('url') || '';
  const branch = searchParams.get('branch') || 'main';
  const appUrl = searchParams.get('appUrl') || '';
  const mode = searchParams.get('mode') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filter, setFilter] = useState<string>('all');

  // Format project name
  const projectName = projectId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    // Simulate AI generating test cases
    const timer = setTimeout(() => {
      setTestCases(generateTestCases(projectId));
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [projectId]);

  const handleTestClick = (testCase: TestCase) => {
    // Build query string with appUrl if available
    const queryParams = new URLSearchParams({
      project: projectId,
    });
    if (repoUrl) {
      queryParams.set('url', repoUrl);
    }
    if (appUrl) {
      queryParams.set('appUrl', appUrl);
    }
    if (mode) {
      queryParams.set('mode', mode);
    }
    router.push(`/scenarios/${testCase.id}?${queryParams.toString()}`);
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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Spinner className="mb-4" />
        <p className="text-text-secondary">Generating test cases for {projectName}...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full p-8 flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Button variant="icon" onClick={() => router.back()}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Generated Test Cases</h2>
          <p className="text-sm text-text-secondary">
            {projectName} • {testCases.length} test cases generated
          </p>
        </div>
        <Button variant="secondary" onClick={() => {}}>
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Test
        </Button>
        <Button onClick={() => alert('Running all tests...')}>
          <FontAwesomeIcon icon={faPlay} className="mr-2" />
          Run All
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
          <p className="text-sm text-text-secondary">Total Tests</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-success">{stats.passed}</p>
          <p className="text-sm text-text-secondary">Passed</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-danger">{stats.failed}</p>
          <p className="text-sm text-text-secondary">Failed</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-warning">{stats.pending}</p>
          <p className="text-sm text-text-secondary">Pending</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faFilter} className="text-text-tertiary" />
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              )}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Test Cases List */}
      <div className="flex flex-col gap-3">
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
                testCase.status === 'success' && 'bg-success',
                testCase.status === 'warning' && 'bg-warning',
                testCase.status === 'pending' && 'bg-text-tertiary',
                testCase.status === 'failed' && 'bg-danger'
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
    </div>
  );
}
