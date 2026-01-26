'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui';

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const action = searchParams.get('action');
  const url = searchParams.get('url');
  const branch = searchParams.get('branch') || 'main';
  const appUrl = searchParams.get('appUrl');
  const mode = searchParams.get('mode');
  const project = searchParams.get('project');

  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('Initializing...');

  // Get project name from params or extract from URL
  const getProjectName = () => {
    // Use project param if available
    if (project) return project;
    // Otherwise extract from URL
    if (!url) return 'repository';
    try {
      const parts = url.split('/');
      return parts[parts.length - 1]?.replace('.git', '') || 'repository';
    } catch {
      return 'repository';
    }
  };

  useEffect(() => {
    const steps = action === 'ai_gen'
      ? [
          { progress: 20, text: 'Analyzing project structure...' },
          { progress: 40, text: 'Identifying components and routes...' },
          { progress: 60, text: 'Generating test cases...' },
          { progress: 80, text: 'Creating Cypress scenarios...' },
          { progress: 100, text: 'Finalizing...' },
        ]
      : [
          { progress: 20, text: 'Connecting to repository...' },
          { progress: 40, text: 'Cloning repository...' },
          { progress: 60, text: 'Analyzing dependencies...' },
          { progress: 80, text: 'Setting up project...' },
          { progress: 100, text: 'Almost done...' },
        ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].progress);
        setStep(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        // Navigate to next page
        const repoName = getProjectName();
        if (action === 'ai_gen') {
          // Build query string with appUrl if available
          const queryParams = new URLSearchParams();
          if (appUrl) {
            queryParams.set('appUrl', appUrl);
          }
          if (mode) {
            queryParams.set('mode', mode);
          }
          const queryString = queryParams.toString();
          router.push(`/projects/${repoName}/test-cases${queryString ? `?${queryString}` : ''}`);
        } else {
          router.push(`/projects/${repoName}?url=${encodeURIComponent(url || '')}&branch=${branch}`);
        }
      }
    }, 800);

    return () => clearInterval(interval);
  }, [router, action, url, branch, appUrl, mode, project]);

  const getLoadingText = () => {
    const repoName = getProjectName();
    if (action === 'ai_gen') {
      return {
        title: 'AI Agent Working...',
        subtitle: `Analyzing ${repoName} and generating Cypress test cases...`,
      };
    }
    return {
      title: `Cloning ${source === 'github' ? 'GitHub' : 'GitLab'} Repository...`,
      subtitle: url ? `${getProjectName()} (Branch: ${branch})` : 'Fetching repository data...',
    };
  };

  const { title, subtitle } = getLoadingText();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-full max-w-md">
        <Spinner className="mb-6 mx-auto" />
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-text-secondary mb-6">{subtitle}</p>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-text-tertiary">{step}</p>
      </div>
    </div>
  );
}

export default function LoadingPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Spinner className="mb-6" />
        <h2 className="text-xl font-semibold mb-2">Loading...</h2>
      </div>
    }>
      <LoadingContent />
    </Suspense>
  );
}
