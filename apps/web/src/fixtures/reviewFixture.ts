import {
  mapReviewItemToViewModel,
  mockReviewQueueResponse,
  type ReviewCardViewModel,
} from '@lingua/types';

export type ReviewCardItem = ReviewCardViewModel;
export const defaultReviewQueue: ReviewCardItem[] =
  mockReviewQueueResponse.data.map(mapReviewItemToViewModel);
