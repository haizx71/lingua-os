import React from 'react';
import {
  EyeOff,
  Sparkles,
  BookOpen,
  Check,
  Zap,
  Award,
  AlertTriangle,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { cn } from '../../utils';
import { type ConceptStatus, conceptStateMetadata, duePresentationDescriptor } from '../../tokens/semantic';

export interface ConceptChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ConceptStatus;
  isDue?: boolean;
  term?: string;
  showStatusLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusIcons: Record<ConceptStatus, React.ComponentType<{ className?: string }>> = {
  unseen: EyeOff,
  discovered: Sparkles,
  learning: BookOpen,
  familiar: Check,
  active: Zap,
  mastered: Award,
  weak: AlertTriangle,
  forgotten: RotateCcw,
};

export const ConceptChip = React.forwardRef<HTMLSpanElement, ConceptChipProps>(
  ({ className, status, isDue = false, term, showStatusLabel = true, size = 'md', ...props }, ref) => {
    const meta = isDue ? duePresentationDescriptor : (conceptStateMetadata[status] || conceptStateMetadata.unseen);
    const IconComponent = isDue ? Clock : (statusIcons[status] || EyeOff);

    const roleStyles: Record<string, string> = {
      neutral:
        'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]',
      primary:
        'bg-[var(--surface-subtle)] text-[var(--action-primary)] border-[var(--border-default)]',
      info:
        'bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info-border)]',
      success:
        'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)] font-medium',
      warning:
        'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)] font-medium',
      danger:
        'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)] font-medium',
    };

    const borderStyleClass = meta.borderStyle === 'dashed' ? 'border-dashed' : 'border-solid';

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs gap-1 rounded-[var(--radius-sm)]',
      md: 'px-2.5 py-1 text-xs sm:text-sm gap-1.5 rounded-[var(--radius-sm)]',
      lg: 'px-3 py-1.5 text-sm sm:text-base gap-2 rounded-[var(--radius-md)]',
    };

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`${term ? `${term}: ` : ''}${meta.labelVi} (${meta.descriptionVi})`}
        className={cn(
          'inline-flex items-center border font-sans select-none transition-colors',
          roleStyles[meta.colorRole],
          borderStyleClass,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <IconComponent className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        {term && <span className="font-semibold text-[var(--text-primary)]">{term}</span>}
        {term && showStatusLabel && <span className="opacity-40" aria-hidden="true">•</span>}
        {showStatusLabel && <span className="text-xs">{meta.labelVi}</span>}
      </span>
    );
  }
);

ConceptChip.displayName = 'ConceptChip';
