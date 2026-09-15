import React, { useId } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '../../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  fullWidth?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id: customId,
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      clearable = false,
      onClear,
      fullWidth = false,
      inputSize = 'md',
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || `lingua-input-${generatedId}`;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const sizeStyles = {
      sm: 'h-9 rounded-xl px-3 text-xs',
      md: 'h-11 min-h-[44px] rounded-2xl px-3.5 text-sm',
      lg: 'h-12 min-h-[48px] rounded-2xl px-4 text-base',
    };

    const iconSizeClasses = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    const hasValue = value !== undefined && value !== '' && value !== null;

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth ? 'w-full' : 'inline-flex')}>
        {label && (
          <label
            htmlFor={inputId}
            className="flex select-none items-center gap-1 text-xs font-bold text-[var(--text-primary)]"
          >
            {label}
            {props.required && <span className="text-[var(--status-danger)]" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex w-full items-center">
          {leftIcon && (
            <div
              className={cn(
                'pointer-events-none absolute left-3 flex items-center justify-center text-[var(--text-muted)]',
                iconSizeClasses[inputSize]
              )}
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            value={value}
            onChange={onChange}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              'w-full border bg-[var(--surface)] font-sans text-[var(--text-primary)] shadow-sm transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-muted)]',
              'focus-visible:outline-none focus-visible:border-[var(--focus-ring)] focus-visible:ring-4 focus-visible:ring-[color:var(--surface-blue)]',
              'disabled:cursor-not-allowed disabled:border-[var(--border-subtle)] disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-muted)]',
              error
                ? 'border-[var(--status-danger)] focus-visible:border-[var(--status-danger)] focus-visible:ring-[var(--status-danger-bg)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
              leftIcon && (inputSize === 'sm' ? 'pl-8' : inputSize === 'lg' ? 'pl-11' : 'pl-10'),
              (rightIcon || (clearable && hasValue) || error) &&
                (inputSize === 'sm' ? 'pr-8' : inputSize === 'lg' ? 'pr-11' : 'pr-10'),
              sizeStyles[inputSize],
              className
            )}
            {...props}
          />

          <div className="absolute right-3 flex items-center gap-1.5 text-[var(--text-muted)]">
            {clearable && hasValue && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onClear?.();
                  if (onChange) {
                    const syntheticEvent = {
                      target: { value: '' },
                      currentTarget: { value: '' },
                    } as React.ChangeEvent<HTMLInputElement>;
                    onChange(syntheticEvent);
                  }
                }}
                aria-label="Xóa nội dung nhập"
                className="rounded-full p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {error && <AlertCircle className={cn('text-[var(--status-danger)]', iconSizeClasses[inputSize])} aria-hidden="true" />}
            {!error && rightIcon}
          </div>
        </div>

        {error && <p id={errorId} role="alert" className="text-xs font-medium text-[var(--status-danger)]">{error}</p>}
        {!error && helperText && <p id={helperId} className="text-xs leading-5 text-[var(--text-secondary)]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const TextField = Input;
