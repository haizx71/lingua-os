import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../Button/Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      title,
      description,
      icon = <Sparkles className="w-8 h-8 text-[var(--action-primary,#4F46E5)]" />,
      actionLabel,
      onAction,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="region"
        aria-label={title}
        className={cn(
          'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[var(--radius-lg,1rem)] border border-dashed border-[var(--border-default,#CBD5E1)] bg-[var(--surface,#FFFFFF)] max-w-md mx-auto my-6',
          className
        )}
        {...props}
      >
        <div className="w-14 h-14 rounded-full bg-[var(--surface-subtle,#F1F5F9)] flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary,#0F172A)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--text-secondary,#475569)] mb-6 max-w-xs">{description}</p>
        {actionLabel && onAction && (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
