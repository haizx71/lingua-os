import React, { useState } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '../../utils';

export interface AudioPlayerProps {
  src?: string;
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
  isLoading?: boolean;
  label?: string;
  variant?: 'button' | 'compact' | 'sentence';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  onPlay,
  onPause,
  isPlaying: controlledIsPlaying,
  isLoading = false,
  label = 'Phát âm thanh',
  variant = 'button',
  size = 'md',
  disabled = false,
  className,
}) => {
  const [uncontrolledIsPlaying, setUncontrolledIsPlaying] = useState(false);
  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : uncontrolledIsPlaying;

  const togglePlay = () => {
    if (disabled || isLoading) return;

    if (isPlaying) {
      if (controlledIsPlaying === undefined) setUncontrolledIsPlaying(false);
      onPause?.();
    } else {
      if (controlledIsPlaying === undefined) {
        setUncontrolledIsPlaying(true);
        // Auto reset after 2.5s simulation if uncontrolled
        setTimeout(() => setUncontrolledIsPlaying(false), 2500);
      }
      onPlay?.();
    }
  };

  const buttonSizeStyles = {
    sm: 'h-8 w-8 min-h-[32px] min-w-[32px] p-1.5',
    md: 'h-10 w-10 min-h-[44px] min-w-[44px] p-2',
    lg: 'h-12 w-12 min-h-[48px] min-w-[48px] p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-busy={isLoading}
        onClick={togglePlay}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-all select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isPlaying
            ? 'bg-[var(--action-primary,#4F46E5)] text-white shadow-md scale-105'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60',
          buttonSizeStyles[size],
          className
        )}
      >
        {isLoading ? (
          <Loader2 className={cn('animate-spin', iconSizes[size])} aria-hidden="true" />
        ) : isPlaying ? (
          <Volume2 className={cn('animate-pulse', iconSizes[size])} aria-hidden="true" />
        ) : (
          <Volume2 className={iconSizes[size]} aria-hidden="true" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--surface-subtle,#F1F5F9)] border border-[var(--border-subtle,#E2E8F0)]',
          className
        )}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-[var(--action-primary,#4F46E5)] text-white hover:bg-[var(--action-primary-hover,#4338CA)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)] min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
          )}
        </button>
        <span className="text-xs font-medium text-[var(--text-primary,#0F172A)]">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 rounded-[var(--radius-md,0.625rem)] bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          onClick={togglePlay}
          className="p-2.5 rounded-full bg-[var(--action-primary,#4F46E5)] text-white hover:bg-[var(--action-primary-hover,#4338CA)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)] min-h-[44px] min-w-[44px] flex items-center justify-center transition-transform active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />
          )}
        </button>
        <div>
          <span className="text-xs font-semibold text-[var(--text-primary,#0F172A)] block">{label}</span>
          <span className="text-[11px] text-[var(--text-secondary,#475569)] block">
            {isPlaying ? 'Đang phát âm thanh mẫu...' : 'Nhấn để nghe phát âm ngữ cảnh'}
          </span>
        </div>
      </div>
    </div>
  );
};
