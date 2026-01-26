'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload,
  faPlus,
  faPowerOff,
  faLink,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  label: string;
  type: 'group' | 'sub';
  icon?: typeof faPowerOff;
  groupId?: string;
}

const initialSteps: Step[] = [
  { id: 'S1', label: 'Open Application', type: 'group' },
  { id: 'S1-1', label: 'Launch Browser', type: 'sub', icon: faPowerOff, groupId: 'S1' },
  { id: 'S1-2', label: 'Navigate to URL', type: 'sub', icon: faLink, groupId: 'S1' },
  { id: 'S2', label: 'Login Flow', type: 'group' },
];

interface StepsPanelProps {
  activeStepId: string;
  onStepSelect: (stepId: string) => void;
}

export function StepsPanel({ activeStepId, onStepSelect }: StepsPanelProps) {
  const [steps] = useState<Step[]>(initialSteps);

  return (
    <aside className="w-[280px] bg-surface border-r border-border-light flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 bg-surface border-b border-border-light">
        <h2 className="text-sm font-semibold uppercase text-text-secondary tracking-wide">
          Steps
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="icon" className="w-7 h-7 text-xs">
            <FontAwesomeIcon icon={faDownload} />
          </Button>
          <Button variant="outline" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            Add
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {steps.map((step) => (
          <div
            key={step.id}
            onClick={() => step.type === 'sub' && onStepSelect(step.id)}
            className={cn(
              'px-3 py-2.5 mb-1 rounded cursor-pointer flex items-center gap-2.5 transition-colors relative',
              step.type === 'group' && 'bg-hover text-text-primary font-semibold',
              step.type === 'sub' && 'ml-2 text-text-secondary border border-transparent',
              step.type === 'sub' && 'hover:bg-hover',
              step.type === 'sub' &&
                activeStepId === step.id &&
                'bg-active text-primary border-blue-200'
            )}
          >
            {step.type === 'group' && (
              <span className="bg-border-light px-1.5 py-0.5 rounded text-xs text-text-secondary">
                {step.id}
              </span>
            )}
            {step.type === 'sub' && (
              <>
                <div className="absolute left-[-10px] w-0.5 h-full bg-border-light" />
                {step.icon && (
                  <FontAwesomeIcon
                    icon={step.icon}
                    className={cn(
                      'text-sm',
                      activeStepId === step.id ? 'text-primary' : 'text-text-secondary'
                    )}
                  />
                )}
              </>
            )}
            <span className="text-sm">{step.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
