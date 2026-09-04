'use client';

import React, { useState, useRef } from 'react';
import { Volume2, Sparkles, HelpCircle, CheckCircle2, XCircle, ArrowRight, RotateCw } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '../../utils';
import { Card } from '../Card/Card';
import { Button } from '../Button/Button';
import { ConceptChip } from '../ConceptChip/ConceptChip';
import { AudioPlayer } from '../Audio/AudioPlayer';
import { Input } from '../Input/Input';
import { type ConceptStatus } from '../../tokens/semantic';
import { componentMotionNumeric } from '../../tokens/component';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export type ReviewMode = 'self_recall' | 'multiple_choice' | 'typing' | 'cloze' | 'listening';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewCardProps {
  mode?: ReviewMode;
  term: string;
  ipa?: string;
  pos?: string;
  prompt: string;
  answer: string;
  translation_vi?: string;
  definition?: string;
  options?: string[];
  contextSentence?: string;
  contextTranslation?: string;
  audioUrl?: string;
  status?: ConceptStatus;
  isDue?: boolean;
  isRevealed?: boolean;
  onReveal?: () => void;
  onPlayAudio?: () => void;
  onRate?: (rating: ReviewRating) => void;
  onSubmitAnswer?: (userAnswer: string) => boolean | void;
  intervals?: {
    again?: string;
    hard?: string;
    good?: string;
    easy?: string;
  };
  sessionProgress?: {
    current: number;
    total: number;
  };
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  mode = 'self_recall',
  term,
  ipa,
  pos,
  prompt,
  answer,
  translation_vi,
  definition,
  options = [],
  contextSentence,
  contextTranslation,
  audioUrl,
  status = 'learning',
  isDue = true,
  isRevealed: controlledIsRevealed,
  onReveal,
  onPlayAudio,
  onRate,
  onSubmitAnswer,
  intervals = {
    again: '< 10p',
    hard: '1 ngày',
    good: '3 ngày',
    easy: '7 ngày',
  },
  sessionProgress,
  className,
}) => {
  const [uncontrolledIsRevealed, setUncontrolledIsRevealed] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const isRevealed = controlledIsRevealed !== undefined ? controlledIsRevealed : uncontrolledIsRevealed;

  // Answer reveal GSAP animation (200-250ms smooth reveal)
  useGSAP(
    () => {
      if (!isRevealed || !answerRef.current) return;

      if (prefersReducedMotion) {
        gsap.set(answerRef.current, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        answerRef.current,
        { opacity: 0, y: componentMotionNumeric.reviewCard.revealDistance },
        {
          opacity: 1,
          y: 0,
          duration: componentMotionNumeric.reviewCard.flipDuration,
          ease: componentMotionNumeric.reviewCard.flipEase,
          clearProps: 'transform',
          overwrite: 'auto',
        }
      );
    },
    { dependencies: [isRevealed, prefersReducedMotion], scope: containerRef }
  );

  // Context-safe rating button feedback (150ms scale press rebound)
  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleRatingPress = contextSafe((rating: ReviewRating, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e?.currentTarget && !prefersReducedMotion) {
      gsap.fromTo(
        e.currentTarget,
        { scale: componentMotionNumeric.reviewCard.ratingScaleActive },
        {
          scale: 1.0,
          duration: componentMotionNumeric.reviewCard.ratingDuration,
          ease: componentMotionNumeric.reviewCard.ratingEase,
          clearProps: 'transform',
          overwrite: 'auto',
        }
      );
    }

    // NON-BLOCKING: Fire rating callback immediately
    onRate?.(rating);
  });

  const handleReveal = () => {
    if (controlledIsRevealed === undefined) {
      setUncontrolledIsRevealed(true);
    }
    onReveal?.();
  };

  const handleMultipleChoiceSelect = (opt: string) => {
    if (isAnswerChecked) return;
    setSelectedOption(opt);
    const correct = opt.trim().toLowerCase() === answer.trim().toLowerCase();
    setIsCorrect(correct);
    setIsAnswerChecked(true);
    handleReveal();
    onSubmitAnswer?.(opt);
  };

  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    const correct = typedInput.trim().toLowerCase() === answer.trim().toLowerCase();
    setIsCorrect(correct);
    setIsAnswerChecked(true);
    handleReveal();
    onSubmitAnswer?.(typedInput);
  };

  const modeLabels: Record<ReviewMode, string> = {
    self_recall: 'Tự nhớ (Self-Recall)',
    multiple_choice: 'Trắc nghiệm ngữ cảnh',
    typing: 'Gõ từ vựng (Typing)',
    cloze: 'Điền vào chỗ trống (Cloze)',
    listening: 'Nhận diện âm thanh (Listening)',
  };

  return (
    <div ref={containerRef}>
      <Card
        variant="elevated"
        padding="lg"
        className={cn('space-y-6 font-sans max-w-xl mx-auto text-left relative transition-all', className)}
      >
        {/* Session / Mode Header */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted,#94A3B8)] border-b border-[var(--border-subtle,#E2E8F0)] pb-3">
          <span className="font-medium text-[var(--text-secondary,#475569)]">
            Chế độ: {modeLabels[mode]}
          </span>
          <div className="flex items-center gap-2">
            {sessionProgress && (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {sessionProgress.current} / {sessionProgress.total} thẻ
              </span>
            )}
            <ConceptChip status={status} isDue={isDue} term={term} size="sm" />
          </div>
        </div>

        {/* Main Flashcard Prompt Area */}
        <div className="space-y-4 py-2">
          {mode === 'listening' ? (
            <div className="text-center py-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Nghe và nhận diện từ vựng
              </span>
              <div className="flex justify-center">
                <AudioPlayer size="lg" onPlay={onPlayAudio} label="Phát âm từ" />
              </div>
              <p className="text-xs text-[var(--text-muted,#94A3B8)]">
                Nhấn phím Space hoặc nút loa để nghe lại
              </p>
            </div>
          ) : mode === 'cloze' ? (
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Điền từ vào chỗ trống:
              </span>
              <p className="text-lg sm:text-xl font-medium text-[var(--text-primary,#0F172A)] leading-relaxed bg-[var(--surface-subtle,#F1F5F9)] p-4 rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
                {prompt}
              </p>
              {contextTranslation && (
                <p className="text-xs text-[var(--text-secondary,#475569)]">
                  Dịch: {contextTranslation}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2 py-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {mode === 'self_recall' ? 'Từ vựng tiếng Anh' : 'Câu hỏi ôn tập'}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]">
                {prompt || term}
              </h2>
              {ipa && (
                <p className="text-sm font-mono text-[var(--text-secondary,#475569)]">
                  {ipa} {pos && `(${pos})`}
                </p>
              )}
              <div className="flex justify-center pt-1">
                <AudioPlayer size="md" onPlay={onPlayAudio} label="Phát âm từ" />
              </div>
            </div>
          )}

          {/* Interactive Mode Controls (Before Reveal) */}
          {!isRevealed && mode === 'self_recall' && (
            <div className="pt-4 flex justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleReveal}
                className="w-full sm:w-64"
              >
                Hiện đáp án (Reveal)
              </Button>
            </div>
          )}

          {!isRevealed && mode === 'multiple_choice' && options.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {options.map((opt, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleMultipleChoiceSelect(opt)}
                  className="p-3.5 text-left text-sm font-medium rounded-[var(--radius-md,0.625rem)] border border-[var(--border-default,#CBD5E1)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px]"
                >
                  <span className="inline-block w-5 text-indigo-600 font-bold">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {!isRevealed && (mode === 'typing' || mode === 'cloze') && (
            <form onSubmit={handleTypingSubmit} className="space-y-3 pt-2">
              <Input
                label="Nhập từ vựng chính xác:"
                placeholder="Gõ từ tiếng Anh..."
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                fullWidth
                autoFocus
              />
              <Button type="submit" variant="primary" className="w-full" disabled={!typedInput.trim()}>
                Kiểm tra câu trả lời
              </Button>
            </form>
          )}
        </div>

        {/* Revealed Answer & Detailed Explanation */}
        {isRevealed && (
          <div ref={answerRef} className="space-y-4 pt-4 border-t border-[var(--border-subtle,#E2E8F0)]">
            {isCorrect !== null && (
              <div
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg text-sm font-semibold',
                  isCorrect
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                )}
              >
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Chính xác! Ghi nhớ tốt.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Chưa chính xác. Đáp án đúng: <strong>{answer || term}</strong></span>
                  </>
                )}
              </div>
            )}

            {/* Meaning & Definition */}
            <div className="bg-[var(--surface-subtle,#F1F5F9)] p-4 rounded-xl border border-[var(--border-subtle,#E2E8F0)] space-y-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                  Nghĩa tiếng Việt
                </span>
                <p className="text-base font-bold text-[var(--text-primary,#0F172A)]">
                  {translation_vi || answer}
                </p>
              </div>

              {definition && (
                <p className="text-xs sm:text-sm text-[var(--text-secondary,#475569)] italic">
                  &ldquo;{definition}&rdquo;
                </p>
              )}

              {contextSentence && (
                <div className="pt-2 border-t border-[var(--border-subtle,#E2E8F0)]/60">
                  <span className="text-[11px] font-semibold text-[var(--text-muted,#94A3B8)] uppercase block">
                    Ngữ cảnh ví dụ:
                  </span>
                  <p className="text-xs sm:text-sm text-[var(--text-primary,#0F172A)] font-medium">
                    {contextSentence}
                  </p>
                  {contextTranslation && (
                    <p className="text-xs text-[var(--text-secondary,#475569)]">
                      {contextTranslation}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4 FSRS Rating Buttons with Micro-feedback */}
            <div className="space-y-3 pt-2">
              <p className="text-xs text-center text-[var(--text-secondary,#475569)]">
                Đánh giá mức độ ghi nhớ của bạn để FSRS tối ưu lịch ôn:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleRatingPress('again', e)}
                  className="flex flex-col items-center py-2.5 h-auto border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                >
                  <span className="font-bold text-xs">Quên (Again)</span>
                  {intervals.again && (
                    <span className="text-[10px] text-rose-500 font-normal">{intervals.again}</span>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleRatingPress('hard', e)}
                  className="flex flex-col items-center py-2.5 h-auto border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                >
                  <span className="font-bold text-xs">Khó (Hard)</span>
                  {intervals.hard && (
                    <span className="text-[10px] text-amber-500 font-normal">{intervals.hard}</span>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleRatingPress('good', e)}
                  className="flex flex-col items-center py-2.5 h-auto border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                >
                  <span className="font-bold text-xs">Tốt (Good)</span>
                  {intervals.good && (
                    <span className="text-[10px] text-indigo-500 font-normal">{intervals.good}</span>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleRatingPress('easy', e)}
                  className="flex flex-col items-center py-2.5 h-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <span className="font-bold text-xs">Dễ (Easy)</span>
                  {intervals.easy && (
                    <span className="text-[10px] text-emerald-500 font-normal">{intervals.easy}</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

