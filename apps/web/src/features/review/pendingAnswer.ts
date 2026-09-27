import type { ReviewExerciseMode, ReviewRating } from '@lingua/types';

/** LOCAL_ONLY transport receipt, not a review event or persisted learner state. */
export interface PendingReviewOperation {
  readonly reviewItemId: string;
  readonly rating: ReviewRating;
  readonly exerciseMode: ReviewExerciseMode;
  readonly correct?: boolean;
  readonly responseText?: string;
  readonly selectedOptionId?: string;
  readonly idempotencyKey: string;
  readonly responseTimeMs: number;
}

const exerciseModes: readonly ReviewExerciseMode[] = [
  'self_recall', 'multiple_choice', 'typing', 'cloze', 'listening',
];

function isExerciseMode(value: unknown): value is ReviewExerciseMode {
  return exerciseModes.includes(value as ReviewExerciseMode);
}

export function readPendingAnswer(key: string): PendingReviewOperation | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid review receipt');
  const op = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const exerciseMode = op.exerciseMode === undefined ? 'self_recall' : op.exerciseMode;
  if (typeof op.reviewItemId !== 'string' || !uuid.test(op.reviewItemId) ||
      typeof op.idempotencyKey !== 'string' || !uuid.test(op.idempotencyKey) ||
      !['again', 'hard', 'good', 'easy'].includes(String(op.rating)) ||
      !isExerciseMode(exerciseMode) ||
      (op.correct !== undefined && typeof op.correct !== 'boolean') ||
      (op.responseText !== undefined &&
        (typeof op.responseText !== 'string' || op.responseText.length > 5000)) ||
      (op.selectedOptionId !== undefined &&
        (typeof op.selectedOptionId !== 'string' || !uuid.test(op.selectedOptionId))) ||
      typeof op.responseTimeMs !== 'number' || !Number.isInteger(op.responseTimeMs) ||
      op.responseTimeMs < 0 || op.responseTimeMs > 3600000) {
    throw new Error('Invalid review receipt');
  }
  return {
    reviewItemId: op.reviewItemId, idempotencyKey: op.idempotencyKey,
    rating: op.rating as ReviewRating,
    exerciseMode,
    ...(op.correct === undefined ? {} : { correct: op.correct }),
    ...(op.responseText === undefined ? {} : { responseText: op.responseText }),
    ...(op.selectedOptionId === undefined ? {} : { selectedOptionId: op.selectedOptionId }),
    responseTimeMs: op.responseTimeMs,
  };
}
