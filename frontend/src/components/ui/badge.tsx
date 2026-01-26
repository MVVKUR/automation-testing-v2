'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'default';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full uppercase',
        {
          'bg-primary text-white': variant === 'primary',
          'bg-success text-white': variant === 'success',
          'bg-warning text-white': variant === 'warning',
          'bg-danger text-white': variant === 'danger',
          'bg-border-light text-text-secondary': variant === 'default',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
