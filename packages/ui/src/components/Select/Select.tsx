import React, { useState, useRef, useId, useEffect } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import { cn } from '../../utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
}

export interface SelectProps {
  id?: string;
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  id: customId,
  label,
  helperText,
  error,
  options = [],
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = 'Chọn một tùy chọn...',
  disabled = false,
  fullWidth = false,
  size = 'md',
  className,
}) => {
  const generatedId = useId();
  const selectId = customId || `lingua-select-${generatedId}`;
  const listboxId = `${selectId}-listbox`;
  const helperId = helperText ? `${selectId}-helper` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentValue = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const selectedOption = options.find((o) => o.value === currentValue);

  const handleSelect = (val: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(val);
    }
    onChange?.(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const idx = options.findIndex((o) => o.value === currentValue);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) => (prev + 1) % options.length);
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            const opt = options[highlightedIndex];
            if (!opt.disabled) {
              handleSelect(opt.value);
            }
          }
        }
      }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-xs rounded-[var(--radius-sm,0.375rem)]',
    md: 'h-10 px-3.5 text-sm rounded-[var(--radius-md,0.625rem)] min-h-[44px]',
    lg: 'h-12 px-4 text-base rounded-[var(--radius-md,0.625rem)] min-h-[48px]',
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative flex flex-col gap-1.5 font-sans', fullWidth ? 'w-full' : 'inline-flex w-64', className)}
    >
      {label && (
        <label
          htmlFor={selectId}
          id={`${selectId}-label`}
          className="text-xs font-semibold text-[var(--text-primary,#0F172A)] select-none"
        >
          {label}
        </label>
      )}

      {/* Select Trigger */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={label ? `${selectId}-label ${selectId}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={!!error}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            const idx = options.findIndex((o) => o.value === currentValue);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center justify-between bg-[var(--surface,#FFFFFF)] border text-left transition-all select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)]',
          'disabled:bg-[var(--surface-subtle,#F1F5F9)] disabled:text-[var(--text-muted,#94A3B8)] disabled:cursor-not-allowed',
          error
            ? 'border-[var(--status-danger,#E11D48)]'
            : 'border-[var(--border-default,#CBD5E1)] hover:border-[var(--border-strong,#94A3B8)]',
          sizeStyles[size]
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
          <span className={selectedOption ? 'text-[var(--text-primary,#0F172A)]' : 'text-[var(--text-muted,#94A3B8)]'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          className={cn(
            'w-4 h-4 text-[var(--text-muted,#94A3B8)] transition-transform duration-200 flex-shrink-0 ml-2',
            isOpen && 'rotate-180 text-[var(--action-primary,#4F46E5)]'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label || 'Tùy chọn'}
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto',
            'bg-[var(--surface-elevated,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] rounded-[var(--radius-md,0.625rem)] shadow-xl p-1',
            'focus:outline-none'
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === currentValue;
            const isHighlighted = index === highlightedIndex;

            return (
              <li
                key={option.value}
                id={`${selectId}-option-${option.value}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) {
                    handleSelect(option.value);
                  }
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-[var(--radius-sm,0.375rem)] cursor-pointer transition-colors select-none',
                  isSelected && 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/40 dark:text-indigo-300',
                  !isSelected && isHighlighted && 'bg-[var(--surface-subtle,#F1F5F9)] text-[var(--text-primary,#0F172A)]',
                  !isSelected && !isHighlighted && 'text-[var(--text-secondary,#475569)]',
                  option.disabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-[11px] text-[var(--text-muted,#94A3B8)] font-normal">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--status-danger,#E11D48)] font-medium">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="text-xs text-[var(--text-secondary,#475569)]">
          {helperText}
        </p>
      )}
    </div>
  );
};
