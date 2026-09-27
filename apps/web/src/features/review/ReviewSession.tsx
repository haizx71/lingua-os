'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  isApiErrorCode,
  mapApiErrorToUi,
  type ApiClient,
  type ReviewRating,
  type ReviewExerciseMode,
  type ApiErrorCode,
} from '@lingua/types';
import type { ReviewCardItem } from '../../fixtures/reviewFixture';
import { useOptionalAuth } from '../auth/AuthContext';
import { useReviewSession } from './useReviewSession';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ReviewSessionProps {
  initialQueue?: ReviewCardItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  apiClient?: ApiClient;
  languageProfileId?: string;
  onRatingSubmit?: (cardId: string, rating: ReviewRating) => void;
  onSessionComplete?: () => void;
}

export function ReviewSession({
  initialQueue,
  forcedState,
  forcedErrorCode,
  apiClient,
  languageProfileId,
  onRatingSubmit,
  onSessionComplete,
}: ReviewSessionProps) {
  const [focusMode, setFocusMode] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success' | undefined>(forcedState);

  useEffect(() => {
    setLocalForcedState(forcedState);
  }, [forcedState]);

  const {
    queue,
    currentIndex,
    currentCard,
    isFinished,
    isLoading,
    error,
    isSubmitting,
    actionError,
    lastFeedback,
    remainingDueCount,
    reviewedCount,
    isAnswerRevealed,
    setIsAnswerRevealed,
    submitRating,
    retryLastAnswer,
    pendingRetryOperation,
    refetch,
  } = useReviewSession({
    apiClient,
    initialQueue,
    query: languageProfileId ? { languageProfileId } : undefined,
    onRatingSubmit,
    onSessionComplete,
  });

  const sessionCardRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const prefersReducedMotion = usePrefersReducedMotion();
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const authContext = useOptionalAuth();
  const getAudioEpoch = authContext?.getActorEpoch;
  const isAudioActorCurrent = authContext?.isCurrentActor;
  const audioActorId = authContext?.user?.id ?? null;

  useEffect(() => {
    setResponseText('');
  }, [currentCard?.id]);

  useEffect(() => {
    setIsAudioPlaying(false);
    if (!currentCard?.audioUrl) return;
    const audio = new Audio(currentCard.audioUrl);
    audio.preload = 'none';
    audioRef.current = audio;
    const epoch = getAudioEpoch?.();
    const current = () => audioRef.current === audio &&
      (!isAudioActorCurrent || isAudioActorCurrent(epoch ?? 0, audioActorId));
    audio.onended = audio.onerror = () => { if (current()) setIsAudioPlaying(false); };
    return () => {
      audioRef.current = null;
      audio.onended = audio.onerror = null;
      audio.pause();
    };
  }, [currentCard?.id, currentCard?.audioUrl, authContext?.actorEpoch, audioActorId,
    getAudioEpoch, isAudioActorCurrent]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (isSubmitting || isLoading || error || pendingRetryOperation || localForcedState === 'error' || localForcedState === 'loading') return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsAnswerRevealed((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        void submitRating('again');
      } else if (e.key === '2') {
        e.preventDefault();
        void submitRating('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        void submitRating('good');
      } else if (e.key === '4') {
        e.preventDefault();
        void submitRating('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, isLoading, error, pendingRetryOperation, localForcedState, setIsAnswerRevealed, submitRating]);

  const handleAudioPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const epoch = authContext?.getActorEpoch();
    const actorId = authContext?.user?.id ?? null;
    void audio.play().then(() => {
      if (audioRef.current === audio && (!authContext?.isCurrentActor || authContext.isCurrentActor(epoch ?? 0, actorId))) {
        setIsAudioPlaying(!audio.paused);
      }
    }).catch(() => { /* Playback failure does not create learner evidence. */ });
  };

  const isConfiguredMode = Boolean(apiClient || (authContext?.isConfigured && authContext?.authState === 'authenticated'));

  const handleRetry = () => {
    if (localForcedState === 'error') {
      setLocalForcedState('loading');
    }
    if (isConfiguredMode) {
      setLocalForcedState(undefined);
      void refetch();
    } else {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        setLocalForcedState('success');
      }, 300);
    }
  };

  if (localForcedState === 'loading' || (isLoading && !localForcedState)) {
    return <LoadingState message="Đang tải hàng đợi thẻ ôn tập FSRS..." count={3} />;
  }

  if (localForcedState === 'error' || (error && !localForcedState)) {
    const code: ApiErrorCode =
      forcedErrorCode ??
      (error && 'code' in error && isApiErrorCode(error.code) ? error.code : 'INTERNAL_ERROR');
    return <ErrorState code={code} onRetry={handleRetry} />;
  }

  const recoveryAlert = (actionError || (pendingRetryOperation && !isSubmitting)) && (
    <InlineAlert variant="danger" title="Lỗi gửi kết quả ôn tập">
      <p>{actionError ? mapApiErrorToUi(actionError).message : 'Kết quả đang chờ xác nhận.'}</p>
      <p>Câu trả lời được giữ trên thiết bị này để xác nhận lại, không gửi câu trả lời mới.</p>
      <Button variant="outline" size="sm" disabled={isSubmitting || isLoading}
        onClick={() => void retryLastAnswer()}>Thử lại</Button>
    </InlineAlert>
  );

  if (!currentCard && pendingRetryOperation) {
    return <div aria-busy={isSubmitting}>{recoveryAlert}</div>;
  }

  if (localForcedState === 'empty' || isFinished || (!isLoading && queue.length === 0)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <EmptyState
          title="Đã hoàn thành toàn bộ hàng đợi ôn tập!"
          description="FSRS không ghi nhận từ nào đến hạn cần ôn ngay bây giờ."
          icon={<CheckCircle2 className="h-10 w-10 text-[var(--status-success)]" />}
          actionLabel="Đọc bài mới trong Reader"
          onAction={() => {
            window.location.href = '/read';
          }}
        />
        <div className="pt-2 text-center">
          <Link href="/today">
            <Button variant="outline" size="md">Về trang Hôm nay</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  const displayDueCount = remainingDueCount !== null ? remainingDueCount : 23;
  const totalCount = remainingDueCount !== null ? reviewedCount + remainingDueCount : 23;
  const progressValue = totalCount > 0 ? Math.min(100, Math.round((reviewedCount / totalCount) * 100)) : 0;
  const hiddenAnswerMode = currentCard.exerciseMode === 'typing'
    || currentCard.exerciseMode === 'cloze'
    || currentCard.exerciseMode === 'listening';
  const needsTextResponse = currentCard.exerciseMode === 'typing'
    || currentCard.exerciseMode === 'cloze';
  const exerciseLabels: Record<ReviewExerciseMode, string> = {
    self_recall: 'Tự nhớ lại',
    multiple_choice: 'Chọn đáp án',
    typing: 'Gõ từ',
    cloze: 'Điền từ còn thiếu',
    listening: 'Nghe và nhớ từ',
  };

  return (
    <div aria-busy={isSubmitting} className={`mx-auto w-full max-w-3xl space-y-5 sm:space-y-6 ${focusMode ? 'py-3' : ''}`}>
      <header className="relative overflow-hidden rounded-[28px] border border-[#dfe7f4] bg-gradient-to-br from-[var(--surface-blue)] via-white to-[var(--surface-lilac)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/70" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="lingua-kicker text-[var(--action-primary)]">Smart Review (FSRS)</span>
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-teal)]" />
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)]">Hàng đợi ôn tập</h1>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Tập trung vào một khái niệm mỗi lần; lịch ôn vẫn do FSRS quyết định.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="warning" size="md">{displayDueCount} từ đến hạn</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFocusMode(!focusMode)}
              aria-label={focusMode ? 'Tắt chế độ tập trung' : 'Bật chế độ tập trung'}
              title={focusMode ? 'Tắt Focus Mode' : 'Bật Focus Mode'}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <Card variant="subtle" padding="sm" className="rounded-2xl bg-white/75">
        <Progress value={progressValue} max={100} label={`Tiến độ buổi ôn: ${reviewedCount} / ${totalCount} thẻ`} showValueText size="sm" />
      </Card>

      {recoveryAlert}

      {!actionError && lastFeedback && (
        <InlineAlert variant="info" title="Hệ thống FSRS">{lastFeedback}</InlineAlert>
      )}

      <div ref={sessionCardRef}>
        <Card padding="none" className="relative overflow-hidden border-[var(--border-subtle)] shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-warm)]/55 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">Thẻ {currentIndex + 1} / {queue.length}</Badge>
              <Badge variant="neutral" size="sm">{exerciseLabels[currentCard.exerciseMode]}</Badge>
            </div>
            <ConceptChip
              status={currentCard.status}
              isDue={currentCard.isDue}
              term={hiddenAnswerMode && !isAnswerRevealed ? 'Từ cần nhớ' : currentCard.term}
              size="sm"
            />
          </div>

          <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
            <span className="lingua-kicker text-[var(--accent-teal-strong)]">
              {currentCard.pos ? 'Từ vựng tiếng Anh' : 'Khái niệm tiếng Anh'}
            </span>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.055em] text-[var(--text-primary)] sm:text-5xl">
              {hiddenAnswerMode && !isAnswerRevealed ? 'Từ cần nhớ' : currentCard.term}
            </h2>
            {!hiddenAnswerMode && (currentCard.ipa || currentCard.pos) && (
              <p className="mt-2 font-mono text-sm text-[var(--text-secondary)]">
                {[currentCard.ipa, currentCard.pos ? `(${currentCard.pos})` : undefined].filter(Boolean).join(' ')}
              </p>
            )}

            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-2xl"
                aria-label={currentCard.exerciseMode === 'listening' ? 'Nghe từ cần nhớ' : 'Phát âm từ'}
                disabled={!currentCard.audioUrl}
                onClick={handleAudioPlay}
              >
                <Volume2 className={`h-5 w-5 text-[var(--action-primary)] ${isAudioPlaying && !prefersReducedMotion ? 'animate-bounce' : ''}`} />
              </Button>
            </div>

            {currentCard.exerciseMode !== 'self_recall' && (
              <p className="mx-auto mt-5 max-w-xl text-sm font-semibold text-[var(--text-primary)]">
                {currentCard.prompt}
              </p>
            )}

            {(currentCard.exerciseMode === 'cloze' || currentCard.exerciseMode === 'self_recall')
              && currentCard.contextSentence && (
                <div className="mx-auto mt-6 max-w-xl rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 px-5 py-4 text-sm italic leading-6 text-[var(--text-secondary)]">
                  “{currentCard.contextSentence}”
                  {isAnswerRevealed && currentCard.contextTranslationVi && (
                    <p className="mt-2 not-italic text-[var(--text-muted)]">
                      ({currentCard.contextTranslationVi})
                    </p>
                  )}
                </div>
              )}

            {needsTextResponse && !isAnswerRevealed && (
              <label className="mx-auto mt-6 block max-w-xl text-left text-sm font-semibold text-[var(--text-primary)]">
                <span className="mb-2 block">Câu trả lời</span>
                <input
                  type="text"
                  aria-label="Câu trả lời"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={responseText}
                  onChange={(event) => setResponseText(event.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-[var(--border-default)] bg-white px-4 text-base"
                />
              </label>
            )}

            {!isAnswerRevealed && (
              <div className="mt-7">
                <Button variant="primary" size="md" onClick={() => setIsAnswerRevealed(true)} className="px-6">
                  {hiddenAnswerMode ? 'Hiện đáp án (Space)' : 'Hiện đáp án & nghĩa (Space)'}
                </Button>
              </div>
            )}

            {isAnswerRevealed && (
              <div className="mx-auto mt-6 max-w-xl rounded-[20px] border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-5 py-4 text-sm font-bold leading-6 text-[var(--text-primary)]">
                {hiddenAnswerMode ? `Đáp án: ${currentCard.term}` : currentCard.meaningVi}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] bg-white px-5 py-5 sm:px-7">
            <p className="mb-3 text-center text-xs text-[var(--text-secondary)]">Đánh giá mức độ ghi nhớ để FSRS tối ưu lịch ôn:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]" onClick={() => void submitRating('again', needsTextResponse ? responseText : undefined)}>Quên (Again)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-warning-border)] text-[var(--status-warning)] hover:bg-[var(--status-warning-bg)]" onClick={() => void submitRating('hard', needsTextResponse ? responseText : undefined)}>Khó (Hard)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--border-default)] text-[var(--action-primary)] hover:bg-[var(--surface-blue)]" onClick={() => void submitRating('good', needsTextResponse ? responseText : undefined)}>Tốt (Good)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-success-border)] text-[var(--status-success)] hover:bg-[var(--status-success-bg)]" onClick={() => void submitRating('easy', needsTextResponse ? responseText : undefined)}>Dễ (Easy)</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
