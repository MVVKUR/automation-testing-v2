'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Chip = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'px-3 py-1.5 bg-surface border border-border-medium rounded-full text-xs text-text-primary shadow-sm',
          'transition-all duration-200',
          'hover:border-primary hover:text-primary hover:-translate-y-0.5 hover:shadow-md',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Chip.displayName = 'Chip';

export { Chip };
