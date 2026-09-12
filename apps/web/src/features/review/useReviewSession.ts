'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isLinguaActorAbortedError, MockApiClient, type ApiClient, type OperationQuery, type ReviewRating } from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import { mapReviewAnswerResultToViewModel, mapReviewQueueItemToViewModel, type ReviewSessionItemViewModel } from './adapters';
import { defaultReviewQueue, type ReviewCardItem } from '../../fixtures/reviewFixture';
import { readPendingAnswer, type PendingReviewOperation } from './pendingAnswer';
export type { PendingReviewOperation } from './pendingAnswer';

export interface UseReviewSessionOptions {
  readonly apiClient?: ApiClient;
  readonly initialQueue?: ReviewCardItem[];
  readonly query?: OperationQuery<'listReviewQueue'>;
  readonly skipInitialFetch?: boolean;
  readonly onRatingSubmit?: (cardId: string, rating: ReviewRating) => void;
  readonly onSessionComplete?: () => void;
}

export interface ReviewSessionState {
  readonly queue: readonly ReviewSessionItemViewModel[];
  readonly currentIndex: number;
  readonly currentCard: ReviewSessionItemViewModel | null;
  readonly isFinished: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly isSubmitting: boolean;
  readonly actionError: Error | null;
  readonly clearActionError: () => void;
  readonly lastFeedback: string | null;
  readonly clearFeedback: () => void;
  readonly remainingDueCount: number | null;
  readonly reviewedCount: number;
  readonly isAnswerRevealed: boolean;
  readonly setIsAnswerRevealed: (revealed: boolean | ((prev: boolean) => boolean)) => void;
  readonly submitRating: (rating: ReviewRating) => Promise<void>;
  readonly retryLastAnswer: () => Promise<void>;
  readonly pendingRetryOperation: PendingReviewOperation | null;
  readonly refetch: () => Promise<void>;
}


export function useReviewSession({
  apiClient: customApiClient, initialQueue, query, skipInitialFetch = false,
  onRatingSubmit, onSessionComplete,
}: UseReviewSessionOptions = {}): ReviewSessionState {
  const auth = useOptionalAuth();
  const authState = auth?.authState ?? 'unauthenticated';
  const actorId = auth?.user?.id ?? null;
  const configured = auth?.isConfigured ?? false;
  const getActorEpoch = auth?.getActorEpoch;
  const isCurrentActor = auth?.isCurrentActor;
  const api = customApiClient ?? getApiClient();
  const live = Boolean(customApiClient || configured);
  const canRequest = configured ? authState === 'authenticated' : Boolean(customApiClient);
  const stableQuery = useMemo(() => {
    const value: OperationQuery<'listReviewQueue'> = {
      ...(query?.languageProfileId ? { languageProfileId: query.languageProfileId } : {}),
      ...(query?.limit !== undefined ? { limit: query.limit } : {}),
      ...(query?.cursor ? { cursor: query.cursor } : {}),
    };
    return Object.keys(value).length ? value : undefined;
  }, [query?.languageProfileId, query?.limit, query?.cursor]);
  const receiptKey = actorId ? `lingua.review.pending.v1:${actorId}:${stableQuery?.languageProfileId ?? 'default'}` : null;
  const [queue, setQueue] = useState<readonly ReviewSessionItemViewModel[]>(initialQueue ?? (live ? [] : defaultReviewQueue));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [remainingDueCount, setRemainingDueCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(live && !skipInitialFetch && !initialQueue);
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [pendingRetryOperation, setPendingRetryOperation] = useState<PendingReviewOperation | null>(null);
  const sequenceRef = useRef(0);
  const queueSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const busyRef = useRef<symbol | null>(null);
  const activeOperationRef = useRef<PendingReviewOperation | null>(null);
  const cardStartTimeRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current++;
      queueSequenceRef.current++;
    };
  }, []);

  const captureGuard = useCallback(() => {
    const sequence = sequenceRef.current;
    const epoch = getActorEpoch?.() ?? 0;
    const capturedActorId = actorId;
    return () =>
      mountedRef.current &&
      sequence === sequenceRef.current &&
      (!isCurrentActor || isCurrentActor(epoch, capturedActorId)) &&
      (!api.getCurrentActorId || api.getCurrentActorId() === capturedActorId);
  }, [actorId, api, getActorEpoch, isCurrentActor]);

  const loadQueue = useCallback(async () => {
    const seq = ++queueSequenceRef.current;
    if (!canRequest) {
      if (configured) setQueue([]);
      setIsLoading(configured && authState === 'loading');
      return;
    }
    const epoch = getActorEpoch?.() ?? 0;
    const requestActorId = actorId;
    const isCurrent = () => {
      return (
        mountedRef.current &&
        seq === queueSequenceRef.current &&
        (!isCurrentActor || isCurrentActor(epoch, requestActorId)) &&
        (!api.getCurrentActorId || api.getCurrentActorId() === requestActorId)
      );
    };

    setIsLoading(true);
    setError(null);
    try {
      if (configured && !customApiClient && api instanceof MockApiClient) {
        throw new Error('Live Review transport is not configured');
      }
      const pending = receiptKey ? readPendingAnswer(receiptKey) : activeOperationRef.current;
      activeOperationRef.current = pending;
      setPendingRetryOperation(pending);
      setActionError(pending ? new Error('Pending answer recovery') : null);
      const items: ReviewSessionItemViewModel[] = [];
      const cursors = new Set<string>();
      let cursor = stableQuery?.cursor;
      if (cursor) cursors.add(cursor);
      do {
        const response = await api.listReviewQueue(cursor ? { ...stableQuery, cursor } : stableQuery);
        if (!isCurrent()) return;
        items.push(...response.data.map(mapReviewQueueItemToViewModel));
        const next = response.meta.nextCursor;
        if (response.meta.hasMore) {
          if (!next || cursors.has(next) || response.data.length === 0) throw new Error('Invalid review cursor');
          cursors.add(next);
          cursor = next;
        } else {
          if (next) throw new Error('Invalid review cursor');
          cursor = undefined;
        }
      } while (cursor);
      if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Duplicate review item');
      if (!isCurrent()) return;
      setQueue(items);
      setCurrentIndex(0);
      setRemainingDueCount(items.length);
      setIsAnswerRevealed(false);
      cardStartTimeRef.current = performance.now();
    } catch (err) {
      if (!isCurrent() || isLinguaActorAbortedError(err)) return;
      setError(err instanceof Error ? err : new Error('Review unavailable'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [
    api,
    authState,
    canRequest,
    configured,
    customApiClient,
    getActorEpoch,
    isCurrentActor,
    actorId,
    receiptKey,
    stableQuery,
  ]);

  useEffect(() => {
    sequenceRef.current++;
    queueSequenceRef.current++;
    busyRef.current = null;
    activeOperationRef.current = null;
    setQueue(initialQueue ?? (live ? [] : defaultReviewQueue));
    setCurrentIndex(0);
    setReviewedCount(0);
    setRemainingDueCount(null);
    setError(null);
    setActionError(null);
    setLastFeedback(null);
    setIsAnswerRevealed(false);
    setIsSubmitting(false);
    setPendingRetryOperation(null);
  }, [actorId, receiptKey, initialQueue, live]);

  useEffect(() => {
    if (!skipInitialFetch) void loadQueue();
    return () => {
      queueSequenceRef.current++;
    };
  }, [loadQueue, skipInitialFetch]);

  const currentCard = queue[currentIndex] ?? null;
  const isFinished = !pendingRetryOperation && queue.length > 0 && currentIndex >= queue.length;

  const executeAnswer = useCallback(async (operation: PendingReviewOperation, recovering = false) => {
    if (busyRef.current || isLoading || (live && !canRequest)) return;
    const token = Symbol('review-answer');
    busyRef.current = token;
    const current = captureGuard();
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (!live) {
        setLastFeedback('Đã ghi nhận kết quả ôn tập.');
        activeOperationRef.current = null;
        setCurrentIndex(currentIndex + 1);
        setReviewedCount(count => count + 1);
        setIsAnswerRevealed(false);
        onRatingSubmit?.(operation.reviewItemId, operation.rating);
        if (currentIndex + 1 >= queue.length) onSessionComplete?.();
        return;
      }
      // LOCAL_ONLY receipt written before dispatch; never creates a learner event.
      if (receiptKey) sessionStorage.setItem(receiptKey, JSON.stringify(operation));
      setPendingRetryOperation(operation);
      const response = await api.answerReviewItem({
        reviewItemId: operation.reviewItemId,
        body: { rating: operation.rating, responseTimeMs: operation.responseTimeMs },
        headers: { 'Idempotency-Key': operation.idempotencyKey },
      });
      if (!current()) return;
      if (response.data.reviewItemId !== operation.reviewItemId) throw new Error('Mismatched review response');
      const result = mapReviewAnswerResultToViewModel(response.data);
      if (receiptKey) sessionStorage.removeItem(receiptKey);
      activeOperationRef.current = null;
      setPendingRetryOperation(null);
      setLastFeedback(result.feedback);
      setRemainingDueCount(result.remainingDueCount);
      setIsAnswerRevealed(false);
      setReviewedCount(count => count + 1);
      cardStartTimeRef.current = performance.now();
      onRatingSubmit?.(operation.reviewItemId, operation.rating);
      if (!current()) return;
      if (recovering) {
        // A replay returns the original snapshot, not necessarily today's queue state.
        await loadQueue();
      } else if (result.remainingDueCount === 0) {
        setCurrentIndex(queue.length);
        onSessionComplete?.();
      } else if (queue[currentIndex]?.id !== operation.reviewItemId || currentIndex + 1 >= queue.length) {
        await loadQueue();
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      if (!current() || isLinguaActorAbortedError(err)) return;
      setPendingRetryOperation(operation);
      setActionError(err instanceof Error ? err : new Error('Review unavailable'));
    } finally {
      if (busyRef.current === token) {
        busyRef.current = null;
        setIsSubmitting(false);
      }
    }
  }, [api, canRequest, captureGuard, currentIndex, isLoading, live, loadQueue,
    onRatingSubmit, onSessionComplete, queue, receiptKey]);

  const submitRating = useCallback(async (rating: ReviewRating) => {
    if (!currentCard || busyRef.current || activeOperationRef.current || isLoading || error) return;
    try {
      const operation: PendingReviewOperation = {
        reviewItemId: currentCard.id, rating, idempotencyKey: crypto.randomUUID(),
        responseTimeMs: Math.min(3600000, Math.max(0, Math.round(performance.now() - cardStartTimeRef.current))),
      };
      activeOperationRef.current = operation;
      await executeAnswer(operation);
    } catch {
      setActionError(new Error('Review unavailable'));
    }
  }, [currentCard, error, executeAnswer, isLoading]);

  const retryLastAnswer = useCallback(async () => {
    if (activeOperationRef.current) await executeAnswer(activeOperationRef.current, true);
  }, [executeAnswer]);

  return {
    queue, currentIndex, currentCard, isFinished, isLoading, error, isSubmitting,
    actionError, clearActionError: () => setActionError(null),
    lastFeedback, clearFeedback: () => setLastFeedback(null),
    remainingDueCount, reviewedCount, isAnswerRevealed, setIsAnswerRevealed,
    submitRating, retryLastAnswer, pendingRetryOperation, refetch: loadQueue,
  };
}
