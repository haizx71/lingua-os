'use client';

import React, { useRef } from 'react';
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
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '../../utils';
import { type ConceptStatus, conceptStateMetadata } from '../../tokens/semantic';
import { componentMotionNumeric } from '../../tokens/component';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ConceptNodeProps {
  id: string;
  label: string;
  cefr?: string;
  status: ConceptStatus;
  isDue?: boolean;
  stability?: number;
  difficulty?: number;
  isSelected?: boolean;
  isFaded?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
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

export const ConceptNode: React.FC<ConceptNodeProps> = ({
  id,
  label,
  cefr,
  status,
  isDue = false,
  stability,
  difficulty,
  isSelected = false,
  isFaded = false,
  size = 'md',
  onClick,
  className,
}) => {
  const nodeRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef<ConceptStatus>(status);
  const prevSelectedRef = useRef<boolean>(isSelected);
  const prefersReducedMotion = usePrefersReducedMotion();

  const meta = conceptStateMetadata[status] || conceptStateMetadata.unseen;
  const IconComponent = isDue ? Clock : statusIcons[status] || EyeOff;

  useGSAP(
    () => {
      const statusChanged = prevStatusRef.current !== status;
      const selectionChanged = !prevSelectedRef.current && isSelected;

      prevStatusRef.current = status;
      prevSelectedRef.current = isSelected;

      // Skip unprompted initial mount pulse
      if (!statusChanged && !selectionChanged) return;

      if (prefersReducedMotion) {
        gsap.set(nodeRef.current, { scale: 1, clearProps: 'transform' });
        return;
      }

      const tl = gsap.timeline({ overwrite: 'auto' });
      tl.to(nodeRef.current, {
        scale: componentMotionNumeric.conceptNode.pulseScale,
        duration: componentMotionNumeric.conceptNode.pulseDurationStep,
        ease: componentMotionNumeric.conceptNode.pulseEaseUp,
      }).to(nodeRef.current, {
        scale: 1.0,
        duration: componentMotionNumeric.conceptNode.pulseDurationStep,
        ease: componentMotionNumeric.conceptNode.pulseEaseDown,
        clearProps: 'transform',
      });
    },
    { dependencies: [status, isSelected, prefersReducedMotion], scope: nodeRef }
  );

  const roleStyles: Record<string, string> = {
    neutral: 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--text-secondary)]',
    primary: 'bg-[var(--status-info-bg)] text-[var(--action-primary)] border-[var(--status-info-border)] hover:border-[var(--action-primary)]',
    info: 'bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info-border)] hover:border-[var(--status-info)]',
    success: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)] hover:border-[var(--status-success)]',
    warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)] hover:border-[var(--status-warning)]',
    danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)] hover:border-[var(--status-danger)]',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs gap-1.5 rounded-lg min-h-[32px]',
    md: 'px-3 py-1.5 text-sm gap-2 rounded-xl min-h-[44px]',
    lg: 'px-4 py-2 text-base gap-2.5 rounded-2xl min-h-[48px]',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const borderStyleClass = meta.borderStyle === 'dashed' ? 'border-dashed' : 'border-solid';

  return (
    <button
      ref={nodeRef}
      type="button"
      onClick={onClick}
      aria-label={`${label} (${meta.labelVi}${isDue ? ', đến hạn ôn' : ''})`}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center font-medium border transition-colors select-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] will-change-transform',
        sizeStyles[size],
        borderStyleClass,
        roleStyles[isDue ? 'warning' : meta.colorRole] || roleStyles.neutral,
        isSelected && 'ring-2 ring-[var(--focus-ring)] shadow-md',
        isFaded && 'opacity-35 grayscale',
        className
      )}
    >
      <IconComponent className={cn(iconSizes[size], 'shrink-0')} aria-hidden="true" />
      <span className="font-semibold">{label}</span>
      {cefr && (
        <span className="text-[10px] font-mono opacity-80 uppercase px-1 py-0.5 rounded bg-[var(--surface-subtle)]">
          {cefr}
        </span>
      )}
    </button>
  );
};

