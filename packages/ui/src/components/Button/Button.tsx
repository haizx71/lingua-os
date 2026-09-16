import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center font-semibold tracking-[-0.01em] transition-[transform,box-shadow,background-color,border-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 select-none';

    const variants = {
      primary:
        'bg-[var(--action-primary)] text-[var(--action-primary-text)] shadow-[0_8px_20px_rgba(66,103,217,0.18)] hover:-translate-y-0.5 hover:bg-[var(--action-primary-hover)] hover:shadow-[0_11px_26px_rgba(66,103,217,0.24)] active:translate-y-0 active:scale-[0.985] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
      secondary:
        'bg-[var(--action-secondary)] text-[var(--action-secondary-text)] border border-transparent hover:-translate-y-0.5 hover:bg-[var(--action-secondary-hover)] active:translate-y-0 active:scale-[0.985] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
      outline:
        'border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] active:translate-y-0 active:scale-[0.985] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
      ghost:
        'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] active:scale-[0.99] motion-reduce:active:scale-100',
      danger:
        'bg-[var(--status-danger)] text-white shadow-sm hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 active:scale-[0.985] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
    };

    const sizes = {
      sm: 'h-9 min-h-[36px] max-sm:min-h-[44px] gap-1.5 rounded-xl px-3.5 text-xs',
      md: 'h-11 min-h-[44px] gap-2 rounded-2xl px-5 text-sm',
      lg: 'h-12 min-h-[48px] gap-2.5 rounded-2xl px-6 text-sm sm:text-base',
      icon: 'h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-2xl p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {!isLoading && leftIcon}
        <span className="min-w-0">{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
