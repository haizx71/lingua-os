import {
  mapTodayActivityToViewModel,
  mockTodayPlanResponse,
  type TodayActivityViewModel,
} from '@lingua/types';

export type TodayActivityItem = TodayActivityViewModel;
export const defaultTodayActivities: TodayActivityItem[] =
  mockTodayPlanResponse.data.activities.map(mapTodayActivityToViewModel);
