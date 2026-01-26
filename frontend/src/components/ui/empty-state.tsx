'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className
      )}
      data-testid="empty-state"
    >
      {icon && (
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      {description && (
        <p className="text-neutral-600 mb-6 max-w-md">{description}</p>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoProjectsEmpty({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      }
      title="No projects yet"
      description="Create your first project to start automating tests with AI."
      action={{ label: 'Create Project', onClick: onCreateClick }}
    />
  );
}

export function NoTestCasesEmpty({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      title="No test cases"
      description="Create your first test case to start testing your application."
      action={{ label: 'Create Test Case', onClick: onCreateClick }}
    />
  );
}

export function NoRunsEmpty() {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      }
      title="No test runs yet"
      description="Run your first test to see execution history here."
    />
  );
}

export function NoScenariosEmpty({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      }
      title="No scenarios"
      description="Create test scenarios with step-by-step actions."
      action={{ label: 'Create Scenario', onClick: onCreateClick }}
    />
  );
}

export function SearchEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon={
        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title="No results found"
      description={`No matches found for "${query}". Try adjusting your search.`}
    />
  );
}

export default EmptyState;
