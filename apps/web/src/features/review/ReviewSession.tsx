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
  componentMotionNumeric,
  usePrefersReducedMotion,
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
import { defaultReviewQueue, type ReviewCardItem } from '../../fixtures/reviewFixture';


if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

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
  const prefersReducedMotion = usePrefersReducedMotion();

  const currentCard = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;

  // Lateral slide progression between queue cards (150ms slide distance, opacity: 0 -> 1)
  useGSAP(
    () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (!sessionCardRef.current || isFinished) return;

      if (prefersReducedMotion) {
        gsap.set(sessionCardRef.current, { x: 0, opacity: 1, clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        sessionCardRef.current,
        { x: componentMotionNumeric.reviewSession.slideDistance, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: componentMotionNumeric.reviewSession.slideDuration,
          ease: componentMotionNumeric.reviewSession.slideEase,
          clearProps: 'transform',
          overwrite: 'auto',
        }
      );
    },
    { dependencies: [currentIndex, prefersReducedMotion], scope: sessionCardRef }
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
              {currentCard.pos ? 'Từ vựng tiếng Anh' : 'Khái niệm tiếng Anh'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {currentCard.term}
            </h2>
            {(currentCard.ipa || currentCard.pos) && (
              <p className="text-sm text-[var(--text-secondary)] font-mono">
                {[currentCard.ipa, currentCard.pos ? `(${currentCard.pos})` : undefined]
                  .filter(Boolean)
                  .join(' ')}
              </p>
            )}

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
            <p className="text-xs text-[var(--text-secondary)]">
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
