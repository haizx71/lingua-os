import {
  mapProgressToViewModel,
  mockProgressOverviewResponse,
  type ProgressSummaryViewModel,
} from '@lingua/types';

export type ProgressSummaryData = ProgressSummaryViewModel;
export type ProgressHistoryPoint = ProgressSummaryViewModel['history7d'][number];
export const defaultProgressSummary = mapProgressToViewModel(mockProgressOverviewResponse.data);
