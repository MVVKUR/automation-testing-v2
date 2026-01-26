'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
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
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm transition-all duration-200 bg-white',
            'focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 focus:outline-none',
            'placeholder:text-neutral-400',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
