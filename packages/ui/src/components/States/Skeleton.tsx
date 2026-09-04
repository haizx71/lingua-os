import React from 'react';
import { cn } from '../../utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rectangular', ...props }, ref) => {
    const variants = {
      text: 'h-4 w-full rounded-[var(--radius-sm,0.375rem)]',
      rectangular: 'rounded-[var(--radius-md,0.625rem)]',
      circular: 'rounded-full aspect-square',
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          'animate-pulse bg-[var(--surface-subtle,#F1F5F9)] border border-[var(--border-subtle,#E2E8F0)]',
          variants[variant],
          className
        )}


        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
