import type { ReviewRating } from '@lingua/types';

/** LOCAL_ONLY transport receipt, not a review event or persisted learner state. */
export interface PendingReviewOperation {
  readonly reviewItemId: string;
  readonly rating: ReviewRating;
  readonly idempotencyKey: string;
  readonly responseTimeMs: number;
}

export function readPendingAnswer(key: string): PendingReviewOperation | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid review receipt');
  const op = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof op.reviewItemId !== 'string' || !uuid.test(op.reviewItemId) ||
      typeof op.idempotencyKey !== 'string' || !uuid.test(op.idempotencyKey) ||
      !['again', 'hard', 'good', 'easy'].includes(String(op.rating)) ||
      typeof op.responseTimeMs !== 'number' || !Number.isInteger(op.responseTimeMs) ||
      op.responseTimeMs < 0 || op.responseTimeMs > 3600000) {
    throw new Error('Invalid review receipt');
  }
  return {
    reviewItemId: op.reviewItemId, idempotencyKey: op.idempotencyKey,
    rating: op.rating as ReviewRating, responseTimeMs: op.responseTimeMs,
  };
}
