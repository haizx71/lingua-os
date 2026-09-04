import React, { useId, useState, useRef } from 'react';
import { cn } from '../../utils';

export interface SliderProps {
  id?: string;
  label?: string;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  unit?: string;
  showValue?: boolean;
  disabled?: boolean;
  marks?: Array<{ value: number; label?: string }>;
  variant?: 'primary' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  id: customId,
  label,
  helperText,
  min = 0,
  max = 100,
  step = 1,
  value: controlledValue,
  defaultValue,
  onChange,
  unit = '',
  showValue = true,
  disabled = false,
  marks,
  variant = 'primary',
  size = 'md',
  className,
}) => {
  const generatedId = useId();
  const sliderId = customId || `lingua-slider-${generatedId}`;
  const initialValue = controlledValue ?? defaultValue ?? min;
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);

  const currentValue = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const percentage = Math.min(Math.max(((currentValue - min) / (max - min)) * 100, 0), 100);

  const handleChange = (newVal: number) => {
    const clamped = Math.min(Math.max(newVal, min), max);
    if (controlledValue === undefined) {
      setUncontrolledValue(clamped);
    }
    onChange?.(clamped);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    let nextValue = currentValue;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      nextValue = Math.min(currentValue + step, max);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      nextValue = Math.max(currentValue - step, min);
    } else if (e.key === 'PageUp') {
      nextValue = Math.min(currentValue + step * 5, max);
    } else if (e.key === 'PageDown') {
      nextValue = Math.max(currentValue - step * 5, min);
    } else if (e.key === 'Home') {
      nextValue = min;
    } else if (e.key === 'End') {
      nextValue = max;
    }

    if (nextValue !== currentValue) {
      e.preventDefault();
      handleChange(nextValue);
    }
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  const thumbSizeClasses = {
    sm: 'w-4 h-4 -mt-[5px]',
    md: 'w-5 h-5 -mt-[5px]',
  };

  return (
    <div className={cn('w-full flex flex-col gap-2 font-sans select-none', className)}>
      {/* Header with Label and Value Counter */}
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={sliderId}
              className="text-xs sm:text-sm font-semibold text-[var(--text-primary,#0F172A)] flex items-center gap-1"
            >
              {label}
            </label>
          )}

          {showValue && (
            <span className="text-xs sm:text-sm font-bold text-[var(--action-primary,#4F46E5)] bg-[var(--surface-subtle,#F1F5F9)] px-2 py-0.5 rounded-[var(--radius-sm,0.375rem)] border border-[var(--border-subtle,#E2E8F0)]">
              {currentValue} {unit}
            </span>
          )}
        </div>
      )}

      {/* Slider Track Container */}
      <div className="relative flex items-center w-full py-2">
        <div
          className={cn(
            'w-full bg-[var(--border-default,#CBD5E1)] rounded-full overflow-hidden relative',
            sizeClasses[size]
          )}
        >
          {/* Active Fill Track */}
          <div
            className={cn(
              'h-full transition-all duration-75',
              disabled
                ? 'bg-[var(--text-muted,#94A3B8)]'
                : variant === 'primary'
                ? 'bg-[var(--action-primary,#4F46E5)]'
                : 'bg-[var(--text-primary,#0F172A)]'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Native Range Input for Touch/Mouse & Accessibility */}
        <input
          id={sliderId}
          type="range"
          role="slider"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          aria-valuenow={currentValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${currentValue} ${unit}`}
          aria-label={label || 'Điều chỉnh giá trị'}
          onChange={(e) => handleChange(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          className={cn(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed',
            'focus-visible:outline-none'
          )}
        />

        {/* Visual Thumb Follower */}
        <div
          className={cn(
            'absolute pointer-events-none rounded-full bg-[var(--surface,#FFFFFF)] border-2 shadow-md transition-all duration-75',
            disabled
              ? 'border-[var(--text-muted,#94A3B8)] bg-slate-200'
              : 'border-[var(--action-primary,#4F46E5)]',
            thumbSizeClasses[size]
          )}
          style={{
            left: `calc(${percentage}% - ${size === 'sm' ? 8 : 10}px)`,
          }}
        />
      </div>

      {/* Marks / Scale values */}
      {marks && marks.length > 0 && (
        <div className="flex justify-between text-[11px] text-[var(--text-muted,#94A3B8)] px-0.5">
          {marks.map((m) => (
            <span key={m.value} className="text-center">
              {m.label || `${m.value}${unit ? ` ${unit}` : ''}`}
            </span>
          ))}
        </div>
      )}

      {/* Helper text */}
      {helperText && (
        <p className="text-xs text-[var(--text-secondary,#475569)] mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
};
