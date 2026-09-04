import React from 'react';
import { cn } from '../../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', size = 'md', icon, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center font-semibold rounded-[var(--radius-full,9999px)] transition-colors select-none';

    const variants = {
      neutral:
        'bg-[var(--surface-subtle,#F1F5F9)] text-[var(--text-secondary,#475569)] border border-[var(--border-subtle,#E2E8F0)]',
      primary:
        'bg-[var(--status-info-bg,#F0F9FF)] text-[var(--action-primary,#4F46E5)] border border-[var(--status-info-border,#BAE6FD)]',

      success:
        'bg-[var(--status-success-bg,#ECFDF5)] text-[var(--status-success,#059669)] border border-[var(--status-success-border,#A7F3D0)]',
      warning:
        'bg-[var(--status-warning-bg,#FFFBEB)] text-[var(--status-warning,#D97706)] border border-[var(--status-warning-border,#FDE68A)]',
      danger:
        'bg-[var(--status-danger-bg,#FFF1F2)] text-[var(--status-danger,#E11D48)] border border-[var(--status-danger-border,#FECDD3)]',
      info:
        'bg-[var(--status-info-bg,#F0F9FF)] text-[var(--status-info,#0284C7)] border border-[var(--status-info-border,#BAE6FD)]',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs gap-1',
      md: 'px-2.5 py-1 text-xs gap-1.5',
    };

    return (
      <span ref={ref} className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
        {icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';
