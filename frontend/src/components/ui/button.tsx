'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'outline' | 'icon' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-neutral-900 text-white hover:bg-black':
              variant === 'primary',
            'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300':
              variant === 'secondary',
            'text-neutral-500 hover:text-neutral-900':
              variant === 'text',
            'border border-dashed border-neutral-300 text-neutral-700 hover:border-solid hover:bg-neutral-50':
              variant === 'outline',
            'w-8 h-8 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900':
              variant === 'icon',
            'text-red-600 hover:bg-red-50':
              variant === 'danger',
          },
          {
            'px-2 py-1 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          variant === 'icon' && 'p-0',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
