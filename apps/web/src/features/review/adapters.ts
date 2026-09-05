/**
 * Presentation-only adapters for the Review feature.
 * Strictly DTO-to-view-model mapping; preserves server authority, item IDs, and exact item order.
 * Zero client-side FSRS calculations, due date computations, or competence math.
 */

import {
  type ReviewQueueItemDto,
  type ReviewAnswerResponseDto,
  type ReviewCardViewModel,
  mapReviewItemToViewModel as baseMapReviewItemToViewModel,
} from '@lingua/types';

export interface ReviewSessionItemViewModel extends ReviewCardViewModel {
  readonly audioUrl?: string;
}

export interface ReviewAnswerViewModel {
  readonly reviewItemId: string;
  readonly remainingDueCount: number;
  readonly feedback: string;
  readonly memoryState: ReviewAnswerResponseDto['data']['memory']['state'];
  readonly isDue: boolean;
}

export function mapReviewQueueItemToViewModel(item: ReviewQueueItemDto): ReviewSessionItemViewModel {
  const base = baseMapReviewItemToViewModel(item);
  return {
    ...base,
    ...(item.prompt.audioUrl ? { audioUrl: item.prompt.audioUrl } : {}),
  };
}

export function mapReviewAnswerResultToViewModel(
  result: ReviewAnswerResponseDto['data']
): ReviewAnswerViewModel {
  const feedback = result.feedback || 'Đã ghi nhận kết quả ôn tập.';
  return {
    reviewItemId: result.reviewItemId,
    remainingDueCount: result.remainingDueCount,
    feedback,
    memoryState: result.memory.state,
    isDue: result.memory.isDue,
  };
}
