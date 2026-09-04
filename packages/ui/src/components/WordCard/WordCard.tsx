import React from 'react';
import { Volume2, Bookmark, ExternalLink } from 'lucide-react';
import { cn } from '../../utils';
import { Card } from '../Card/Card';
import { Badge } from '../Badge/Badge';
import { ConceptChip } from '../ConceptChip/ConceptChip';
import { AudioPlayer } from '../Audio/AudioPlayer';
import { type ConceptStatus } from '../../tokens/semantic';

export interface ExampleSentence {
  source: string;
  target: string;
}

export interface WordCardProps {
  term: string;
  ipa?: string;
  pos?: string;
  translation_vi: string;
  definition?: string;
  status?: ConceptStatus;
  cefrLevel?: string;
  examples?: ExampleSentence[];
  audioUrl?: string;
  onPlayAudio?: () => void;
  onStatusChange?: (status: ConceptStatus) => void;
  actionSlot?: React.ReactNode;
  variant?: 'default' | 'compact' | 'expanded';
  className?: string;
}

export const WordCard: React.FC<WordCardProps> = ({
  term,
  ipa,
  pos,
  translation_vi,
  definition,
  status = 'discovered',
  cefrLevel,
  examples = [],
  audioUrl,
  onPlayAudio,
  onStatusChange,
  actionSlot,
  variant = 'default',
  className,
}) => {
  if (variant === 'compact') {
    return (
      <Card
        variant="interactive"
        padding="sm"
        className={cn('flex items-center justify-between gap-3', className)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <AudioPlayer size="sm" onPlay={onPlayAudio} label={`Phát âm ${term}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[var(--text-primary,#0F172A)] truncate">{term}</span>
              {cefrLevel && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[var(--status-info-bg)] text-[var(--action-primary)] border border-[var(--status-info-border)] rounded">
                  {cefrLevel}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary,#475569)] truncate">{translation_vi}</p>
          </div>
        </div>
        <ConceptChip status={status} size="sm" />
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      padding="md"
      className={cn('space-y-4 font-sans', className)}
    >
      {/* Header with Term, IPA, CEFR, Status Chip and Audio */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle,#E2E8F0)] pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]">
              {term}
            </h3>
            {cefrLevel && (
              <Badge variant="primary" size="sm">
                CEFR {cefrLevel}
              </Badge>
            )}
            {pos && (
              <span className="text-xs font-mono font-medium text-[var(--text-muted,#94A3B8)]">
                ({pos})
              </span>
            )}
          </div>

          {ipa && (
            <p className="text-xs sm:text-sm font-mono text-[var(--text-secondary,#475569)]">
              {ipa}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AudioPlayer size="md" onPlay={onPlayAudio} label={`Phát âm ${term}`} />
          <ConceptChip status={status} size="md" />
        </div>
      </div>

      {/* Primary Translation & Definition */}
      <div className="space-y-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)] block mb-0.5">
            Nghĩa tiếng Việt
          </span>
          <p className="text-base font-semibold text-[var(--text-primary,#0F172A)]">
            {translation_vi}
          </p>
        </div>


        {definition && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted,#94A3B8)] block mb-0.5">
              Định nghĩa Anh - Anh
            </span>
            <p className="text-sm text-[var(--text-secondary,#475569)] italic leading-relaxed">
              &ldquo;{definition}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Example Sentences */}
      {examples.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle,#E2E8F0)]">
          <span className="text-xs font-semibold text-[var(--text-secondary,#475569)] block">
            Ví dụ ngữ cảnh thực tế:
          </span>
          <div className="space-y-2">
            {examples.map((ex, index) => (
              <div
                key={index}
                className="bg-[var(--surface-subtle,#F1F5F9)] p-3 rounded-[var(--radius-md,0.625rem)] text-xs sm:text-sm space-y-1 border border-[var(--border-subtle,#E2E8F0)]"
              >
                <p className="font-medium text-[var(--text-primary,#0F172A)]">
                  {ex.source}
                </p>
                <p className="text-[var(--text-secondary,#475569)]">
                  {ex.target}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional action slot (e.g. Save, Dictionary detail link) */}
      {actionSlot && (
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-subtle,#E2E8F0)]">
          {actionSlot}
        </div>
      )}
    </Card>
  );
};
