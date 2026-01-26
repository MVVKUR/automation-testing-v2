'use client';

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return (
    <div
      className={cn(
        'border-4 border-border-light border-t-primary rounded-full animate-spin',
        {
          'w-6 h-6': size === 'sm',
          'w-12 h-12': size === 'md',
          'w-16 h-16': size === 'lg',
        },
        className
      )}
    />
  );
}
