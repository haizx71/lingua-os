import React from 'react';
import { cn } from '../../utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const baseStyles =
      'rounded-[var(--radius-xl,1.5rem)] transition-[transform,box-shadow,border-color,background-color] duration-200';

    const variants = {
      default:
        'bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E9E6DE)] shadow-[var(--shadow-card)]',
      subtle:
        'bg-[var(--surface-subtle,#F4F2EC)] border border-[var(--border-subtle,#E9E6DE)] shadow-none',
      elevated:
        'bg-[var(--surface-elevated,#FFFFFF)] border border-[var(--border-subtle,#E9E6DE)] shadow-[var(--shadow-card-hover)]',
      interactive:
        'bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E9E6DE)] shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-[var(--border-default,#DDD9D0)] hover:shadow-[var(--shadow-card-hover)] cursor-pointer active:translate-y-0 active:scale-[0.995]',
    };

    const paddings = {
      none: 'p-0',
      sm: 'p-3.5',
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
