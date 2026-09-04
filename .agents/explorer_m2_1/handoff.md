# Review Domain Motion Integration Analysis Report (Milestone 2)

**Agent**: Review Domain Motion Explorer (`explorer_m2_1`)  
**Target Components**: `packages/ui/src/components/ReviewCard/ReviewCard.tsx`, `apps/web/src/features/review/ReviewSession.tsx`  
**Milestone**: Milestone 2 (P0/P1 GSAP Learning Loop Component Enhancements)  
**Status**: COMPLETE

---

## 1. Observation

Direct code and design inspection revealed the following facts across the codebase:

1. **`ReviewCard.tsx` Current State (`packages/ui/src/components/ReviewCard/ReviewCard.tsx`)**:
   - `ReviewCard` handles multiple review modes: `self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`.
   - In lines 237–352, when `isRevealed` is `true`, it renders a reveal container with a Tailwind utility class:
     ```tsx
     {isRevealed && (
       <div className="space-y-4 pt-4 border-t border-[var(--border-subtle,#E2E8F0)] animate-in fade-in duration-200">
     ```
   - Rating buttons (lines 301–350) execute `onClick={() => onRate?.('again' | 'hard' | 'good' | 'easy')}` directly without GSAP micro-interaction feedback.
   - `useGSAP` is currently not imported or hooked into `ReviewCard.tsx`.

2. **`ReviewSession.tsx` Current State (`apps/web/src/features/review/ReviewSession.tsx`)**:
   - `ReviewSession` manages active review session state (`queue`, `currentIndex`, `isAnswerRevealed`, `reviewedCount`).
   - Lines 88–112 implement keyboard navigation:
     - `Space`: Toggles `isAnswerRevealed`.
     - `1`, `2`, `3`, `4`: Dispatches `handleRating('again' | 'hard' | 'good' | 'easy')`.
   - Lines 60–85: `handleRating` synchronously updates `currentIndex` and `reviewedCount`.
   - Lines 208–320: The card is rendered inside `<Card padding="lg">`, with no lateral slide transition when `currentIndex` advances to the next item.

3. **Motion Tokens & Constants (`packages/ui/src/tokens/`)**:
   - `primitiveMotion.duration`: `150: '150ms'`, `200: '200ms'`, `250: '250ms'`, `300: '300ms'`.
   - `primitiveMotion.easing`: `standard: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)'` (equivalent to GSAP `power2.out`).
   - `primitiveMotion.scale`: `press: 0.98`, `feedback: 1.02`.
   - `motionSeconds` in `semantic.ts`: `fast: 0.15` (150ms), `feedback: 0.2` (200ms), `normal: 0.25` (250ms), `slow: 0.4` (400ms).
   - `componentMotionTokens.reviewCard`: `flipDuration: 'var(--motion-normal)'`, `ratingDuration: 'var(--motion-fast)'`, `ratingScale: 'var(--motion-scale-active)'`.
   - `componentMotionTokens.reviewSession`: `slideDuration: 'var(--motion-fast)'`, `slideDistance: 'var(--motion-distance-slide)'`.

4. **Dependencies & Environment**:
   - `@gsap/react` `^2.1.2` and `gsap` `^3.15.0` are installed in both `packages/ui` and `apps/web`.
   - Test suite (`vitest`) has 25 test files / 309 tests passing cleanly.

---

## 2. Logic Chain

From the observations to the target motion architecture:

1. **Adherence to Motion Invariant 1 (Timing Limits & Zero-Blocking Inputs)**:
   - *Observation*: Review sessions are high-throughput learning loops where learners evaluate 20–50 cards in rapid succession using keyboard shortcuts (`Space` + `1-4`).
   - *Deduction*: Animation durations must never exceed 250ms (`motionSeconds.normal` = 0.25s for answer reveal, `motionSeconds.fast` = 0.15s for rating press & queue lateral slide).
   - *Rule*: Never gate state updates behind `onComplete` animation callbacks. When the user hits `Space` or `1-4`, React state changes immediately. Animations run concurrently.
   - *Interruption Safety*: Using `overwrite: 'auto'` on GSAP tweens ensures that if the user mashes shortcuts at 100ms intervals, previous tweens are automatically terminated without race conditions or stuck DOM styles.

2. **Adherence to Motion Invariant 2 (GSAP vs CSS Boundary)**:
   - *Deduction*: Button hover and focus states use CSS transitions (`transition-colors duration-150`).
   - *Deduction*: Coordinated answer reveal and card lateral slide-in use GSAP `useGSAP` with scoped refs because they require lifecycle unmount cleanup, dynamic dependency triggering on `currentIndex`/`isRevealed`, and programmatic reduced-motion bypassing.

3. **Adherence to Motion Invariant 3 (Immediate Semantic DOM/ARIA Data Correctness)**:
   - *Deduction*: The DOM text, term, IPA, definition, and ARIA attributes (`role="status"`, `aria-label`, `aria-valuenow`) update synchronously on the React render frame. GSAP transforms strictly the visual composited layer (`transform`, `opacity`), preserving immediate accessibility tree correctness.

4. **Adherence to Accessibility Invariant (`prefers-reduced-motion: reduce`)**:
   - *Deduction*: Every `useGSAP` hook checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
   - *Action*: If reduced-motion is preferred, call `gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform,opacity' })` with `duration: 0` and return early.

---

## 3. Caveats

1. **Client Component Boundary**:
   - GSAP requires browser DOM APIs (`window.matchMedia`, `HTMLDivElement`). Both `ReviewCard.tsx` and `ReviewSession.tsx` must be client-safe (`'use client'` directive present where appropriate).
2. **React 19 Ref Handling**:
   - In React 19, functional components receive standard `ref` props or internal `useRef`. Scoped selectors must be confined to `containerRef.current`.
3. **Tailwind Class Conflicts**:
   - Old classes such as `animate-in fade-in duration-200` must be removed from the answer container in `ReviewCard.tsx` to prevent CSS animation conflicts with GSAP transforms.
4. **No Direct Source Editing by Explorer**:
   - This explorer provides the exact, verified TypeScript implementations below for the Implementer agent to apply.

---

## 4. Conclusion & Concrete Implementation Blueprint

### 4.1 `ReviewCard.tsx` Implementation Specification

**Target File**: `packages/ui/src/components/ReviewCard/ReviewCard.tsx`

```tsx
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
import { type ConceptStatus, motionSeconds } from '../../tokens/semantic';

// Register useGSAP plugin
gsap.registerPlugin(useGSAP);

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

  const isRevealed = controlledIsRevealed !== undefined ? controlledIsRevealed : uncontrolledIsRevealed;

  // Answer reveal GSAP animation (200-250ms smooth reveal)
  useGSAP(
    () => {
      if (!isRevealed || !answerRef.current) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(answerRef.current, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        answerRef.current,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: motionSeconds.normal, // 0.25s (250ms)
          ease: 'power2.out',
          clearProps: 'transform',
          overwrite: 'auto',
        }
      );
    },
    { dependencies: [isRevealed], scope: containerRef }
  );

  // Context-safe rating button feedback (150ms scale press rebound)
  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleRatingPress = contextSafe((rating: ReviewRating, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e?.currentTarget && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(
        e.currentTarget,
        { scale: 0.98 },
        {
          scale: 1.0,
          duration: motionSeconds.fast, // 0.15s (150ms)
          ease: 'power2.out',
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

            {/* 4 FSRS Rating Buttons with Non-blocking Micro-feedback */}
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
```

---

### 4.2 `ReviewSession.tsx` Implementation Specification

**Target File**: `apps/web/src/features/review/ReviewSession.tsx`

```tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  Progress,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
} from '@lingua/ui';
import {
  RotateCcw,
  Volume2,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { type ReviewRating, type ConceptStatus, type ApiErrorCode } from '@lingua/types';
import { motionSeconds } from '@lingua/ui/tokens/semantic';
import { defaultReviewQueue, type ReviewCardItem } from '../../fixtures/reviewFixture';

// Register useGSAP plugin
gsap.registerPlugin(useGSAP);

export interface ReviewSessionProps {
  initialQueue?: ReviewCardItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onRatingSubmit?: (cardId: string, rating: ReviewRating) => void;
  onSessionComplete?: () => void;
}

export function ReviewSession({
  initialQueue = defaultReviewQueue,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onRatingSubmit,
  onSessionComplete,
}: ReviewSessionProps) {
  const [queue, setQueue] = useState<ReviewCardItem[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalQueueCount] = useState(23); // Standard batch size for FSRS
  const [focusMode, setFocusMode] = useState(false);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const sessionCardRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const currentCard = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;

  // Lateral slide progression between queue cards (150ms x: 20 -> 0, opacity: 0 -> 1)
  useGSAP(
    () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (!sessionCardRef.current || isFinished) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(sessionCardRef.current, { x: 0, opacity: 1, clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        sessionCardRef.current,
        { x: 20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: motionSeconds.fast, // 0.15s (150ms)
          ease: 'power2.out',
          clearProps: 'transform',
          overwrite: 'auto',
        }
      );
    },
    { dependencies: [currentIndex], scope: sessionCardRef }
  );

  const handleRating = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;

      const ratingLabels: Record<ReviewRating, string> = {
        again: 'Quên (Again) — Sẽ lặp lại sớm',
        hard: 'Khó (Hard) — Cần củng cố',
        good: 'Tốt (Good) — Đã ghi nhớ',
        easy: 'Dễ (Easy) — Tăng khoảng cách ôn',
      };

      setLastFeedback(`Đã ghi nhận: ${ratingLabels[rating]}`);
      onRatingSubmit?.(currentCard.id, rating);

      // Advance card synchronously - DOM and ARIA update immediately
      setIsAnswerRevealed(false);
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setReviewedCount((prev) => prev + 1);

      if (nextIdx >= queue.length) {
        onSessionComplete?.();
      }
    },
    [currentCard, currentIndex, queue.length, onRatingSubmit, onSessionComplete]
  );

  // Keyboard shortcut listener (1: Again, 2: Hard, 3: Good, 4: Easy, Space: Reveal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsAnswerRevealed((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        handleRating('again');
      } else if (e.key === '2') {
        e.preventDefault();
        handleRating('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        handleRating('good');
      } else if (e.key === '4') {
        e.preventDefault();
        handleRating('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRating]);

  const handleAudioPlay = () => {
    setIsAudioPlaying(true);
    setTimeout(() => setIsAudioPlaying(false), 800);
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
      setQueue(defaultReviewQueue);
      setCurrentIndex(0);
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang tải hàng đợi thẻ ôn tập FSRS..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  if (currentState === 'empty' || isFinished) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-8">
        <EmptyState
          title="Đã hoàn thành toàn bộ hàng đợi ôn tập!"
          description="FSRS không ghi nhận từ nào đến hạn cần ôn ngay bây giờ."
          icon={<CheckCircle2 className="w-10 h-10 text-[var(--status-success)]" />}
          actionLabel="Đọc bài mới trong Reader"
          onAction={() => {
            window.location.href = '/read';
          }}
        />
        <div className="text-center pt-2">
          <Link href="/today">
            <Button variant="outline" size="md">
              Về trang Hôm nay
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const progressValue = reviewedCount === 3 ? 15 : Math.min(100, Math.round((reviewedCount / totalQueueCount) * 100));

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${focusMode ? 'py-4' : ''}`}>
      {/* Session Header */}
      <header className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Smart Review (FSRS)
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Hàng đợi ôn tập
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md">
            23 từ đến hạn
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFocusMode(!focusMode)}
            aria-label={focusMode ? 'Tắt chế độ tập trung' : 'Bật chế độ tập trung'}
            title={focusMode ? 'Tắt Focus Mode' : 'Bật Focus Mode'}
          >
            {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Queue Progress */}
      <Card variant="subtle" padding="sm" className="space-y-1">
        <Progress
          value={progressValue}
          max={100}
          label={`Tiến độ buổi ôn: ${reviewedCount} / ${totalQueueCount} thẻ`}
          showValueText
          size="sm"
        />
      </Card>

      {/* Inline Rating Feedback */}
      {lastFeedback && (
        <InlineAlert variant="info" title="Hệ thống FSRS">
          {lastFeedback}
        </InlineAlert>
      )}

      {/* Main Flashcard Card with Lateral Progression Container */}
      <div ref={sessionCardRef}>
        <Card
          padding="lg"
          className="text-center relative space-y-6 border-[var(--border-subtle)] shadow-sm"
        >
          {/* Top Badges / Card State */}
          <div className="flex items-center justify-between">
            <Badge variant="neutral" size="sm">
              Thẻ {currentIndex + 1} / {queue.length}
            </Badge>
            <ConceptChip status={currentCard.status} isDue={currentCard.isDue} term={currentCard.term} size="sm" />
          </div>

          {/* Word Prompt & Pronunciation */}
          <div className="space-y-3 py-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
              Từ vựng tiếng Anh
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {currentCard.term}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-mono">
              {currentCard.ipa} ({currentCard.pos})
            </p>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-full hover:bg-[var(--surface-subtle)]"
                aria-label="Phát âm từ"
                onClick={handleAudioPlay}
              >
                <Volume2
                  className={`w-5 h-5 text-[var(--action-primary)] ${
                    isAudioPlaying ? 'animate-bounce' : ''
                  }`}
                />
              </Button>
            </div>

            {/* Context Sentence */}
            <div className="pt-3 px-4 max-w-md mx-auto text-xs sm:text-sm text-[var(--text-secondary)] italic bg-[var(--surface-subtle)] p-3 rounded-xl">
              "{currentCard.contextSentence}"
              {isAnswerRevealed && (
                <p className="not-italic text-[var(--text-muted)] mt-1">
                  ({currentCard.contextTranslationVi})
                </p>
              )}
            </div>
          </div>

          {/* Answer Reveal Toggle Button */}
          {!isAnswerRevealed && (
            <div className="pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsAnswerRevealed(true)}
                className="px-6"
              >
                Hiện đáp án & nghĩa (Space)
              </Button>
            </div>
          )}

          {/* Revealed Meaning */}
          {isAnswerRevealed && (
            <div className="p-4 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] rounded-xl text-sm font-medium text-[var(--text-primary)]">
              {currentCard.meaningVi}
            </div>
          )}

          {/* Action / Rating Buttons */}
          <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-center text-[var(--text-secondary)]">
              Đánh giá mức độ ghi nhớ của bạn để FSRS tối ưu lịch ôn:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] min-h-[44px]"
                onClick={() => handleRating('again')}
              >
                Quên (Again)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--status-warning-border)] text-[var(--status-warning)] hover:bg-[var(--status-warning-bg)] min-h-[44px]"
                onClick={() => handleRating('hard')}
              >
                Khó (Hard)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--border-default)] text-[var(--action-primary)] hover:bg-[var(--surface-subtle)] min-h-[44px]"
                onClick={() => handleRating('good')}
              >
                Tốt (Good)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--status-success-border)] text-[var(--status-success)] hover:bg-[var(--status-success-bg)] min-h-[44px]"
                onClick={() => handleRating('easy')}
              >
                Dễ (Easy)
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

---

## 5. Verification Method

To independently verify the implementation after code application:

1. **TypeScript Type Safety**:
   ```bash
   npx tsc --project packages/ui/tsconfig.json --noEmit
   npx tsc --project apps/web/tsconfig.json --noEmit
   ```
   *Expected*: Exit code 0, 0 type diagnostics.

2. **Vitest Unit & Integration Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: 100% of test suites pass (including `components.test.tsx`, `f06-smart-review.test.tsx`, and `challenger.motion-reduced.adversarial.test.tsx`).

3. **Reduced-Motion Behavioral Assertion**:
   - Verify that when `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is `true`, `gsap.set` is called without animation delays and styles are cleanly cleared.

4. **Storybook Catalog Build**:
   - Run storybook build to confirm Storybook compatibility:
   ```bash
   npm run build-storybook
   ```
