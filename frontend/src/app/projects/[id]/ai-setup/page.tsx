'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const strategies = [
  {
    id: 'auto',
    title: 'Auto-Analyze Project',
    description: 'AI scans your codebase to identify critical flows and generate tests.',
  },
  {
    id: 'requirements',
    title: 'From Requirements',
    description: 'Paste user stories or requirements documents.',
  },
  {
    id: 'jira',
    title: 'Connect Jira',
    description: 'Fetch tickets from Jira Board to create acceptance tests.',
  },
];

export default function AISetupPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const appUrl = searchParams.get('appUrl');
  const mode = searchParams.get('mode');

  const handleStrategySelect = (strategyId: string) => {
    if (strategyId === 'auto') {
      // Build query string with appUrl and project if available
      const queryParams = new URLSearchParams({
        action: 'ai_gen',
        strategy: strategyId,
        project: projectId as string,
      });
      if (appUrl) {
        queryParams.set('appUrl', appUrl);
      }
      if (mode) {
        queryParams.set('mode', mode);
      }
      router.push(`/loading?${queryParams.toString()}`);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto w-full p-8 flex flex-col gap-8">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="icon" onClick={() => router.push(`/projects/${projectId}`)}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <h2 className="text-xl font-semibold">AI Agent Configuration</h2>
      </header>

      <div>
        <h3 className="text-lg font-semibold mb-4">How should we generate test cases?</h3>
        <div className="flex flex-col gap-4">
          {strategies.map((strategy) => (
            <Card
              key={strategy.id}
              hoverable
              onClick={() => handleStrategySelect(strategy.id)}
              className="p-5 flex items-center gap-4 cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full border-2 border-border-medium hover:border-primary" />
              <div>
                <h3 className="font-semibold">{strategy.title}</h3>
                <p className="text-sm text-text-secondary">{strategy.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
