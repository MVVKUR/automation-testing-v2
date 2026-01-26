'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block mb-1.5 text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2 border border-border-medium rounded text-sm transition-all duration-200',
            'focus:border-border-focus focus:ring-2 focus:ring-primary/10 focus:outline-none',
            'bg-white',
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
