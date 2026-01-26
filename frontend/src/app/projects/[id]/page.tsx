'use client';

import { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button, Card, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCheck,
  faRobot,
  faHandPointer,
  faChevronRight,
  faCodeBranch,
  faExternalLinkAlt,
  faPlay,
  faStop,
  faCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.id as string;
  const repoUrl = searchParams.get('url') || '';
  const branch = searchParams.get('branch') || 'main';

  const [appStatus, setAppStatus] = useState<'stopped' | 'starting' | 'running'>('stopped');
  const [appUrl, setAppUrl] = useState<string>('');
  const [appPort, setAppPort] = useState<number>(3000);
  const [manualUrlInput, setManualUrlInput] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Format display name from projectId
  const projectName = projectId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleStartApp = async () => {
    setAppStatus('starting');
    try {
      // Call backend API to start the app
      const response = await fetch('/api/projects/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, repoUrl, branch }),
      });

      if (response.ok) {
        const data = await response.json();
        setAppPort(data.port || 3000);
        setAppUrl(`http://localhost:${data.port || 3000}`);
        setAppStatus('running');
      } else {
        // For demo, simulate app starting with delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        const port = 3000 + Math.floor(Math.random() * 100);
        setAppPort(port);
        setAppUrl(`http://localhost:${port}`);
        setAppStatus('running');
      }
    } catch {
      // For demo, simulate app starting with delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      const port = 3000 + Math.floor(Math.random() * 100);
      setAppPort(port);
      setAppUrl(`http://localhost:${port}`);
      setAppStatus('running');
    }
  };

  const handleStopApp = async () => {
    setAppStatus('stopped');
    setAppUrl('');
    setShowManualInput(false);
  };

  const handleConnectManualUrl = () => {
    if (manualUrlInput.trim()) {
      // Validate URL
      try {
        const url = new URL(manualUrlInput);
        setAppUrl(manualUrlInput);
        setAppPort(parseInt(url.port) || 3000);
        setAppStatus('running');
        setShowManualInput(false);
      } catch {
        alert('Please enter a valid URL (e.g., http://localhost:3004)');
      }
    }
  };

  return (
    <div className="max-w-[900px] mx-auto w-full p-8 flex flex-col gap-8">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="icon" onClick={() => router.push('/')}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <h2 className="text-xl font-semibold">Project Setup</h2>
      </header>

      <div className="bg-emerald-50 border border-success rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-success text-white rounded-full flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={faCheck} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Cloning Completed</h3>
            <p className="text-text-secondary mb-3">
              Project <strong>{projectName}</strong> is ready for testing.
            </p>

            {repoUrl && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-tertiary">
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <FontAwesomeIcon icon={faGithub} />
                  <span className="truncate max-w-xs">{repoUrl}</span>
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                </a>
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faCodeBranch} />
                  {branch}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Run App Section */}
      <div className={`border rounded-lg p-6 ${appStatus === 'running' ? 'bg-blue-50 border-primary' : 'bg-gray-50 border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              appStatus === 'running' ? 'bg-success text-white' :
              appStatus === 'starting' ? 'bg-warning text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {appStatus === 'starting' ? (
                <Spinner className="w-5 h-5" />
              ) : appStatus === 'running' ? (
                <FontAwesomeIcon icon={faCircle} className="text-xs animate-pulse" />
              ) : (
                <FontAwesomeIcon icon={faPlay} />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">
                {appStatus === 'running' ? 'App Running' :
                 appStatus === 'starting' ? 'Starting App...' :
                 'Run Application'}
              </h3>
              <p className="text-text-secondary text-sm">
                {appStatus === 'running' ? (
                  <>
                    Running at{' '}
                    <a href={appUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                      {appUrl}
                    </a>
                  </>
                ) : appStatus === 'starting' ? (
                  'Installing dependencies and starting development server...'
                ) : (
                  'Start the application to preview and test it.'
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {appStatus === 'running' ? (
              <>
                <Button variant="secondary" onClick={handleStopApp}>
                  <FontAwesomeIcon icon={faStop} className="mr-2" />
                  Disconnect
                </Button>
                <a href={appUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary">
                    <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                    Open
                  </Button>
                </a>
              </>
            ) : appStatus === 'starting' ? (
              <Button disabled>
                <Spinner className="w-4 h-4 mr-2" />
                Starting...
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowManualInput(!showManualInput)}>
                  Enter URL
                </Button>
                <Button onClick={handleStartApp}>
                  <FontAwesomeIcon icon={faPlay} className="mr-2" />
                  Run App
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Manual URL Input */}
        {showManualInput && appStatus === 'stopped' && (
          <div className="mt-4 pt-4 border-t border-border flex gap-2 items-center">
            <input
              type="url"
              value={manualUrlInput}
              onChange={(e) => setManualUrlInput(e.target.value)}
              placeholder="http://localhost:3004"
              className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={handleConnectManualUrl}>
              Connect
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Select Testing Mode</h3>
        {appStatus !== 'running' && (
          <p className="text-sm text-warning mb-4">
            Start the app first to enable live testing preview.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            hoverable
            onClick={() => {
              const params = new URLSearchParams();
              if (repoUrl) params.set('url', repoUrl);
              if (branch) params.set('branch', branch);
              if (appUrl) params.set('appUrl', appUrl);
              router.push(`/projects/${projectId}/ai-setup?${params.toString()}`);
            }}
            className="p-6 flex items-center gap-4 relative border-2 border-transparent hover:border-primary hover:bg-active cursor-pointer"
          >
            <span className="absolute -top-2.5 right-5 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full uppercase">
              Recommended
            </span>
            <div className="w-12 h-12 bg-blue-100 text-primary rounded-lg flex items-center justify-center text-2xl">
              <FontAwesomeIcon icon={faRobot} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Automation Testing</h3>
              <p className="text-sm text-text-secondary">
                Generate Cypress scripts automatically using AI Agents.
              </p>
            </div>
            <FontAwesomeIcon icon={faChevronRight} className="text-text-tertiary" />
          </Card>

          <Card
            hoverable
            onClick={() => {
              const params = new URLSearchParams();
              if (repoUrl) params.set('url', repoUrl);
              if (branch) params.set('branch', branch);
              if (appUrl) params.set('appUrl', appUrl);
              params.set('mode', 'manual');
              router.push(`/projects/${projectId}/test-cases?${params.toString()}`);
            }}
            className="p-6 flex items-center gap-4 border-2 border-transparent hover:border-primary hover:bg-active cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-100 text-primary rounded-lg flex items-center justify-center text-2xl">
              <FontAwesomeIcon icon={faHandPointer} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Manual Testing</h3>
              <p className="text-sm text-text-secondary">
                Create manual test scripts and execute runbooks.
              </p>
            </div>
            <FontAwesomeIcon icon={faChevronRight} className="text-text-tertiary" />
          </Card>
        </div>
      </div>
    </div>
  );
}
