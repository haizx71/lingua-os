import React from 'react';
import { cn } from '../../utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const baseStyles = 'rounded-[var(--radius-lg,1rem)] transition-all';

    const variants = {
      default: 'bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] shadow-sm',
      subtle: 'bg-[var(--surface-subtle,#F1F5F9)] border border-transparent',
      elevated: 'bg-[var(--surface-elevated,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] shadow-md',
      interactive:
        'bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] shadow-sm hover:border-[var(--border-strong,#94A3B8)] hover:shadow-md cursor-pointer active:scale-[0.995]',
    };

    const paddings = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6 sm:p-8',
    };

    return (
      <div ref={ref} className={cn(baseStyles, variants[variant], paddings[padding], className)} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
