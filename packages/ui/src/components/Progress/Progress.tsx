import React from 'react';
import { cn } from '../../utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showValueText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning';
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      label,
      showValueText = false,
      size = 'md',
      variant = 'primary',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const heightClasses = {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-4',
    };

    const variantClasses = {
      primary: 'bg-[var(--action-primary,#4F46E5)]',
      success: 'bg-[var(--status-success,#059669)]',
      warning: 'bg-[var(--status-warning,#D97706)]',
    };

    return (
      <div ref={ref} className={cn('w-full flex flex-col gap-1.5', className)} {...props}>
        {(label || showValueText) && (
          <div className="flex justify-between items-center text-xs font-medium text-[var(--text-secondary,#475569)]">
            {label && <span>{label}</span>}
            {showValueText && <span className="font-semibold">{Math.round(percentage)}%</span>}
          </div>
        )}
        <div
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label || 'Tiến độ'}
          className={cn(
            'w-full bg-[var(--surface-subtle,#F1F5F9)] rounded-full overflow-hidden border border-[var(--border-subtle,#E2E8F0)]',
            heightClasses[size]
          )}
        >
          <div
            className={cn('h-full transition-all duration-300 ease-out', variantClasses[variant])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';
