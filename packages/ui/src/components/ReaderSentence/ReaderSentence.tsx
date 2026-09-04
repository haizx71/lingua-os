import React, { useState } from 'react';
import { Volume2, Languages, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '../../utils';
import { ConceptChip } from '../ConceptChip/ConceptChip';
import { AudioPlayer } from '../Audio/AudioPlayer';
import { type ConceptStatus, conceptStateMetadata } from '../../tokens/semantic';

export interface SentenceToken {
  raw: string;
  lemma: string;
  concept_id?: string;
  conceptId?: string;
  status?: ConceptStatus;
}

export interface ReaderSentenceProps {
  sentenceId?: string;
  text: string;
  tokens?: SentenceToken[];
  translation?: string;
  showTranslationDefault?: boolean;
  audioUrl?: string;
  onPlayAudio?: () => void;
  onWordClick?: (token: SentenceToken, index: number) => void;
  selectedTokenIndex?: number;
  targetWords?: Array<{ term: string; status: ConceptStatus }>;
  className?: string;
}

export const ReaderSentence: React.FC<ReaderSentenceProps> = ({
  sentenceId,
  text,
  tokens = [],
  translation,
  showTranslationDefault = false,
  audioUrl,
  onPlayAudio,
  onWordClick,
  selectedTokenIndex,
  targetWords = [],
  className,
}) => {
  const [showTranslation, setShowTranslation] = useState(showTranslationDefault);

  const tokenStatusStyles: Record<ConceptStatus, string> = {
    unseen: 'border-b-2 border-dashed border-[var(--border-default)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)]',
    discovered: 'border-b-2 border-[var(--border-default)] hover:bg-[var(--surface-subtle)] font-medium',
    learning: 'border-b-2 border-[var(--status-info)] bg-[var(--status-info-bg)] hover:bg-[var(--surface-subtle)] font-semibold text-[var(--status-info)]',
    familiar: 'border-b-2 border-[var(--status-info-border)] hover:bg-[var(--surface-subtle)] text-[var(--status-info)]',
    active: 'border-b-2 border-[var(--action-primary)] bg-[var(--status-info-bg)] hover:bg-[var(--surface-subtle)] font-semibold text-[var(--action-primary)]',
    mastered: 'border-b border-[var(--status-success)] text-[var(--status-success)] font-medium hover:bg-[var(--surface-subtle)]',
    weak: 'border-b-2 border-[var(--status-warning)] bg-[var(--status-warning-bg)] hover:bg-[var(--status-warning-bg)] font-semibold text-[var(--status-warning)]',
    forgotten: 'border-b-2 border-[var(--status-danger)] bg-[var(--status-danger-bg)] hover:bg-[var(--status-danger-bg)] font-semibold text-[var(--status-danger)]',
  };

  // Extract target words from tokens if not explicitly passed
  const derivedTargetWords =
    targetWords.length > 0
      ? targetWords
      : tokens
          .filter((t) => t.status && t.status !== 'unseen')
          .map((t) => ({ term: t.raw.replace(/[^a-zA-Z]/g, ''), status: t.status! }));

  return (
    <div
      id={sentenceId}
      className={cn(
        'group relative p-4 rounded-xl transition-all font-sans',
        'bg-[var(--surface,#FFFFFF)] border border-[var(--border-subtle,#E2E8F0)] hover:border-[var(--border-default,#CBD5E1)] shadow-sm',
        className
      )}
    >
      {/* Sentence Content with interactive clickable tokens */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-lg sm:text-xl leading-[1.7] text-[var(--text-primary,#0F172A)] font-normal">
          {tokens.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {tokens.map((token, idx) => {
                const isSelected = selectedTokenIndex === idx;
                const statusStyle = token.status ? tokenStatusStyles[token.status] : '';

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onWordClick?.(token, idx)}
                    className={cn(
                      'px-1 py-0.5 rounded cursor-pointer transition-all select-text text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                      statusStyle || 'hover:bg-[var(--surface-subtle,#F1F5F9)]',
                      isSelected && 'ring-2 ring-[var(--focus-ring)] bg-[var(--status-info-bg)] text-[var(--action-primary)] font-semibold'
                    )}
                  >
                    {token.raw}
                  </button>
                );
              })}
            </div>
          ) : (
            <p>{text}</p>
          )}
        </div>

        {/* Action controls: Audio & Translation Toggle */}
        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
          <AudioPlayer size="sm" onPlay={onPlayAudio} label="Nghe phát âm cả câu" />
          {translation && (
            <button
              type="button"
              onClick={() => setShowTranslation(!showTranslation)}
              aria-label={showTranslation ? 'Ẩn bản dịch tiếng Việt' : 'Hiện bản dịch tiếng Việt'}
              className={cn(
                'p-1.5 rounded-full transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                showTranslation
                  ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)] border border-[var(--status-info-border)]'
                  : 'text-[var(--text-muted,#94A3B8)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--surface-subtle,#F1F5F9)]'
              )}
            >
              <Languages className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

      </div>

      {/* Collapsible Vietnamese Translation */}
      {translation && showTranslation && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle,#E2E8F0)] animate-in fade-in duration-150">
          <p className="text-sm text-[var(--text-secondary,#475569)] font-medium leading-relaxed">
            {translation}
          </p>
        </div>
      )}

      {/* Target Concept Chips for the sentence */}
      {derivedTargetWords.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle,#E2E8F0)]/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text-secondary,#475569)]">
            Từ vựng mục tiêu trong câu:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {derivedTargetWords.map((tw, index) => (
              <ConceptChip
                key={index}
                status={tw.status}
                term={tw.term}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
