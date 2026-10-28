'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { clientNavigate } from '../../lib/navigation/clientNavigate';
import { useOptionalAuth } from '../auth/AuthContext';
import { useReviewSession } from './useReviewSession';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

function buildSpellingHint(term: string, meaningVi: string, level: number): string {
  const clean = term.trim();
  if (level === 1) {
    const masked = clean
      .split('')
      .map((ch, idx) => (idx === 0 || ch === ' ' ? ch : '_'))
      .join(' ');
    return `${masked} (${clean.length} ký tự) • Nghĩa: ${meaningVi}`;
  }
  if (level >= 2) {
    const masked = clean
      .split('')
      .map((ch, idx) => (idx === 0 || idx === clean.length - 1 || ch === ' ' || /[aeiou]/i.test(ch) ? ch : '_'))
      .join(' ');
    return `${masked} • Nghĩa: ${meaningVi}`;
  }
  return '';
}

export function computeIntervalPreview(
  rating: 'again' | 'hard' | 'good' | 'easy',
  status?: string,
): string {
  const isMature = status === 'mastered' || status === 'reviewing';
  switch (rating) {
    case 'again': return '< 10 phút';
    case 'hard': return isMature ? '2 ngày' : '1 ngày';
    case 'good': return isMature ? '7 ngày' : '3 ngày';
    case 'easy': return isMature ? '14 ngày' : '6 ngày';
  }
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
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success' | undefined>(forcedState);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sprintBatchSize, setSprintBatchSize] = useState<'all' | 5 | 10 | 15>('all');
  const [blindListeningMode, setBlindListeningMode] = useState(false);

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
    submitRating: sessionSubmitRating,
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

  const submitRating = useCallback(
    (rating: ReviewRating, responseTextValue?: string) => {
      if (rating === 'good' || rating === 'easy') {
        setCorrectCount((prev) => prev + 1);
        setSessionStreak((prev) => prev + 1);
      } else {
        setSessionStreak(0);
      }
      return sessionSubmitRating(rating, responseTextValue);
    },
    [sessionSubmitRating]
  );

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
    setHintLevel(0);
  }, [currentCard?.id, currentIndex]);

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

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.focusMode = focusMode ? 'true' : 'false';
    }
    return () => {
      if (typeof document !== 'undefined') {
        delete document.documentElement.dataset.focusMode;
      }
    };
  }, [focusMode]);

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

  const needsTextResponse = currentCard?.exerciseMode === 'typing'
    || currentCard?.exerciseMode === 'cloze';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (isSubmitting || isLoading || error || pendingRetryOperation || localForcedState === 'error' || localForcedState === 'loading') return;

      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        setFocusMode(false);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsAnswerRevealed((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        void submitRating('again', needsTextResponse ? responseText : undefined);
      } else if (e.key === '2') {
        e.preventDefault();
        void submitRating('hard', needsTextResponse ? responseText : undefined);
      } else if (e.key === '3') {
        e.preventDefault();
        void submitRating('good', needsTextResponse ? responseText : undefined);
      } else if (e.key === '4') {
        e.preventDefault();
        void submitRating('easy', needsTextResponse ? responseText : undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isSubmitting,
    isLoading,
    error,
    pendingRetryOperation,
    localForcedState,
    setIsAnswerRevealed,
    submitRating,
    needsTextResponse,
    responseText,
    focusMode,
  ]);

  const canSynthesizeSpeech = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';

  const handleAudioPlay = () => {
    const audio = audioRef.current;
    if (audio) {
      const epoch = authContext?.getActorEpoch();
      const actorId = authContext?.user?.id ?? null;
      void audio.play().then(() => {
        if (audioRef.current === audio && (!authContext?.isCurrentActor || authContext.isCurrentActor(epoch ?? 0, actorId))) {
          setIsAudioPlaying(!audio.paused);
        }
      }).catch(() => { /* Playback failure does not create learner evidence. */ });
    } else if (canSynthesizeSpeech && currentCard?.term) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(currentCard.term);
        utterance.lang = 'en-US';
        setIsAudioPlaying(true);
        utterance.onend = () => setIsAudioPlaying(false);
        utterance.onerror = () => setIsAudioPlaying(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsAudioPlaying(false);
      }
    }
  };

  const handleSlowAudioPlay = () => {
    if (canSynthesizeSpeech && currentCard?.term) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(currentCard.term);
        utterance.lang = 'en-US';
        utterance.rate = 0.75;
        setIsAudioPlaying(true);
        utterance.onend = () => setIsAudioPlaying(false);
        utterance.onerror = () => setIsAudioPlaying(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsAudioPlaying(false);
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentCard?.id || !currentCard?.term) return;
    if (currentCard.exerciseMode === 'typing' || currentCard.exerciseMode === 'cloze') return;
    if (currentCard.audioUrl || !canSynthesizeSpeech) return;

    try {
      const raw = window.localStorage.getItem('lingua-user-settings-v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.audioAutoplay === true) {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(currentCard.term);
        utterance.lang = 'en-US';
        utterance.rate = parsed?.defaultSpeechRate === 0.75 ? 0.75 : 1;
        setIsAudioPlaying(true);
        utterance.onend = () => setIsAudioPlaying(false);
        utterance.onerror = () => setIsAudioPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Audio autoplay failure is non-fatal
    }
  }, [currentCard?.id, currentCard?.term, currentCard?.exerciseMode, currentCard?.audioUrl, canSynthesizeSpeech]);

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
            clientNavigate('/read');
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

  const displayDueCount = remainingDueCount;
  const totalCount = remainingDueCount !== null ? reviewedCount + remainingDueCount : queue.length;
  const progressValue = totalCount > 0 ? Math.min(100, Math.round((reviewedCount / totalCount) * 100)) : 0;
  const accuracyPercent = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 100;
  const isDifficultConcept = currentCard.status === 'forgotten' || currentCard.status === 'weak';
  const hiddenAnswerMode = currentCard.exerciseMode === 'typing'
    || currentCard.exerciseMode === 'cloze'
    || currentCard.exerciseMode === 'listening';
  const exerciseLabels: Record<ReviewExerciseMode, string> = {
    self_recall: 'Tự nhớ lại',
    multiple_choice: 'Chọn đáp án',
    typing: 'Gõ từ',
    cloze: 'Điền từ còn thiếu',
    listening: 'Nghe và nhớ từ',
  };

  return (
    <div
      aria-busy={isSubmitting}
      data-focus-mode={focusMode ? 'true' : 'false'}
      className={`mx-auto w-full max-w-3xl space-y-3 sm:space-y-5 ${
        focusMode ? 'py-4 sm:py-6 rounded-3xl bg-[var(--surface-subtle)]/40 px-2 sm:px-4 transition-all' : ''
      }`}
    >
      <header className="flex min-w-0 items-center justify-between gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="lingua-kicker text-[var(--action-primary)]">Ôn tập</div>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-2xl">Thẻ đến lượt</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              data-testid="review-pace-indicator"
              aria-label="Nhịp độ phản xạ khuyến nghị"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--text-secondary)]"
            >
              ⏱️ Nhịp chuẩn: ~8s/thẻ
            </span>
            <span
              data-testid="review-session-accuracy-badge"
              aria-label="Độ chính xác và chuỗi trả lời đúng trong buổi học"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--action-primary)]"
            >
              🎯 {accuracyPercent}%{sessionStreak > 0 ? ` · 🔥 ${sessionStreak}` : ''}
            </span>
            {displayDueCount !== null && <Badge variant="warning" size="md">{displayDueCount} còn lại</Badge>}
            <div
              data-testid="wave9-review-batch-size"
              role="group"
              aria-label="Chọn số lượng thẻ ôn tập mỗi phiên"
              className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1 text-xs"
            >
              {(['all', 5, 10, 15] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  data-batch-size={String(size)}
                  aria-pressed={sprintBatchSize === size}
                  onClick={() => setSprintBatchSize(size)}
                  className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${
                    sprintBatchSize === size
                      ? 'bg-[var(--action-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  {size === 'all' ? 'Tất cả' : `${size} thẻ`}
                </button>
              ))}
            </div>
            <Button
              variant={sprintBatchSize !== 'all' ? 'secondary' : 'ghost'}
              size="sm"
              data-testid="review-batch-selector"
              data-sprint-target={String(sprintBatchSize)}
              aria-label="Chọn quy mô phiên ôn tập nhanh"
              onClick={() =>
                setSprintBatchSize((prev) => (prev === 'all' ? 5 : prev === 5 ? 10 : prev === 10 ? 15 : 'all'))
              }
              className="hidden"
            >
              {sprintBatchSize === 'all' ? '⚡ Phiên: Tất cả' : `⚡ Phiên: ${sprintBatchSize} thẻ`}
            </Button>
            <Button
              variant={soundFeedbackEnabled ? 'secondary' : 'ghost'}
              size="sm"
              data-testid="review-audio-feedback-toggle"
              aria-label="Bật/tắt âm thanh phản hồi khi trả lời thẻ"
              aria-pressed={soundFeedbackEnabled}
              onClick={() => setSoundFeedbackEnabled((prev) => !prev)}
            >
              {soundFeedbackEnabled ? '🔔 Âm phản hồi: Bật' : '🔕 Âm phản hồi: Tắt'}
            </Button>
            <Button
              variant={blindListeningMode ? 'secondary' : 'ghost'}
              size="sm"
              data-testid="wave10-review-blind-listening-toggle"
              aria-label="Bật/tắt chế độ nghe mù không nhìn chữ"
              aria-pressed={blindListeningMode}
              onClick={() => setBlindListeningMode((prev) => !prev)}
            >
              {blindListeningMode ? '🎧 Nghe mù: Bật' : '🎧 Nghe mù: Tắt'}
            </Button>
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
      </header>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
        <Progress value={progressValue} max={100} label={`Tiến độ buổi ôn: ${reviewedCount} / ${totalCount} thẻ`} showValueText size="sm" />
      </div>

      {recoveryAlert}

      {!actionError && lastFeedback && (
        <InlineAlert variant="info" title="Hệ thống FSRS">{lastFeedback}</InlineAlert>
      )}

      <div ref={sessionCardRef}>
        <Card
          key={currentCard.id}
          data-testid="review-active-card"
          data-card-flipped={isAnswerRevealed ? 'true' : 'false'}
          padding="none"
          className={`relative overflow-hidden border-[var(--border-subtle)] shadow-[var(--shadow-card-hover)] ${
            !prefersReducedMotion ? 'transition-all duration-300' : ''
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">Thẻ {currentIndex + 1} / {queue.length}</Badge>
              <Badge variant="neutral" size="sm">{exerciseLabels[currentCard.exerciseMode]}</Badge>
            </div>
            <ConceptChip
              status={currentCard.status}
              isDue={currentCard.isDue}
              showStatusLabel
              size="sm"
            />
          </div>

          <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
            {isDifficultConcept && (
              <div
                data-testid="review-leech-indicator"
                aria-label="Khái niệm cần mẹo ghi nhớ đặc biệt"
                className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3.5 py-1 text-xs font-bold text-rose-700"
              >
                <span>⚠️ Từ cần chú ý đặc biệt · Hãy đọc to và liên tưởng hình ảnh</span>
              </div>
            )}
            <span className="lingua-kicker text-[var(--action-primary)]">
              {currentCard.pos ? 'Từ vựng tiếng Anh' : 'Khái niệm tiếng Anh'}
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--text-primary)] sm:text-5xl">
              {hiddenAnswerMode && !isAnswerRevealed ? 'Từ cần nhớ' : currentCard.term}
            </h2>
            {!hiddenAnswerMode && (currentCard.ipa || currentCard.pos) && (
              <p className="mt-2 font-mono text-sm text-[var(--text-secondary)]">
                {[currentCard.ipa, currentCard.pos ? `(${currentCard.pos})` : undefined].filter(Boolean).join(' ')}
              </p>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-2xl"
                aria-label={currentCard.exerciseMode === 'listening' ? 'Nghe từ cần nhớ' : 'Phát âm từ'}
                disabled={!currentCard.audioUrl && !canSynthesizeSpeech}
                onClick={handleAudioPlay}
              >
                <Volume2 className={`h-5 w-5 text-[var(--action-primary)] ${isAudioPlaying && !prefersReducedMotion ? 'animate-bounce' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Nghe phát âm chậm 0.75x"
                title="Nghe phát âm chậm 0.75x cho người mới"
                disabled={!canSynthesizeSpeech}
                onClick={handleSlowAudioPlay}
              >
                🐢 Nghe chậm 0.75x
              </Button>
            </div>

            {currentCard.exerciseMode !== 'self_recall' && (
              <p className="mx-auto mt-5 max-w-xl text-sm font-semibold text-[var(--text-primary)]">
                {currentCard.prompt}
              </p>
            )}

            {(currentCard.exerciseMode === 'cloze' || currentCard.exerciseMode === 'self_recall')
              && currentCard.contextSentence && (
                <div className="reader-copy mx-auto mt-6 max-w-xl rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-4 text-sm text-[var(--text-secondary)]">
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setIsAnswerRevealed(true);
                    }
                  }}
                  className="min-h-[48px] w-full rounded-xl border border-[var(--border-default)] bg-white px-4 text-base"
                />
              </label>
            )}

            {hiddenAnswerMode && !isAnswerRevealed && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="review-hint-button"
                  onClick={() => setHintLevel((prev) => Math.min(prev + 1, 2))}
                >
                  {hintLevel === 0 ? '💡 Gợi ý chữ cái (Cho người mới)' : '💡 Thêm gợi ý chữ cái'}
                </Button>
                {hintLevel > 0 && (
                  <p
                    data-testid="review-spelling-hint"
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lilac)]/60 px-4 py-2 font-mono text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Gợi ý: {buildSpellingHint(currentCard.term, currentCard.meaningVi, hintLevel)}
                  </p>
                )}
              </div>
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

          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-5 sm:px-7">
            <p className="mb-3 text-center text-xs text-[var(--text-secondary)]">Chọn mức độ ghi nhớ để cập nhật lịch ôn:</p>
            <div
              data-testid="review-interval-preview"
              className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px] font-medium text-[var(--text-muted)] sm:grid-cols-4"
            >
              <span><kbd className="mr-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1 font-mono text-[10px]">1</kbd>{computeIntervalPreview('again', currentCard.status)}</span>
              <span><kbd className="mr-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1 font-mono text-[10px]">2</kbd>{computeIntervalPreview('hard', currentCard.status)}</span>
              <span><kbd className="mr-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1 font-mono text-[10px]">3</kbd>{computeIntervalPreview('good', currentCard.status)}</span>
              <span><kbd className="mr-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1 font-mono text-[10px]">4</kbd>{computeIntervalPreview('easy', currentCard.status)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]" onClick={() => void submitRating('again', needsTextResponse ? responseText : undefined)}>Quên (Again)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-warning-border)] text-[var(--status-warning)] hover:bg-[var(--status-warning-bg)]" onClick={() => void submitRating('hard', needsTextResponse ? responseText : undefined)}>Khó (Hard)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--border-default)] text-[var(--action-primary)] hover:bg-[var(--surface-blue)]" onClick={() => void submitRating('good', needsTextResponse ? responseText : undefined)}>Tốt (Good)</Button>
              <Button variant="outline" size="sm" disabled={isSubmitting || Boolean(pendingRetryOperation)} className="min-h-[44px] border-[var(--status-success-border)] text-[var(--status-success)] hover:bg-[var(--status-success-bg)]" onClick={() => void submitRating('easy', needsTextResponse ? responseText : undefined)}>Dễ (Easy)</Button>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-[var(--text-muted)]">
              Mẹo cho người mới: Chọn <strong>Quên</strong> nếu chưa nhớ • <strong>Khó</strong> nếu cần gợi ý • <strong>Tốt</strong> nếu nhớ đúng • <strong>Dễ</strong> nếu đã thuộc lòng
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
