import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  count?: number;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, message = 'Đang tải dữ liệu học tập...', size = 'md', ...props }, ref) => {
    const spinnerSizes = {
      sm: 'w-5 h-5',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    };

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          'flex flex-col items-center justify-center p-8 text-center text-[var(--text-secondary,#475569)] min-h-[160px] gap-3',
          className
        )}
        {...props}
      >
        <Loader2
          className={cn('animate-spin text-[var(--action-primary,#4F46E5)]', spinnerSizes[size])}
          aria-hidden="true"
        />
        {message && <p className="text-sm font-medium">{message}</p>}
        <span className="sr-only">Đang tải...</span>
      </div>
    );
  }
);

LoadingState.displayName = 'LoadingState';
