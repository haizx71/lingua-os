import {
  mapProfileToViewModel,
  mockBrainSummaryResponse,
  mockMeResponse,
  mockProgressOverviewResponse,
  type UserProfileViewModel,
} from '@lingua/types';

export type UserProfileData = UserProfileViewModel;
export const defaultProfileData = mapProfileToViewModel(
  mockMeResponse.data,
  mockBrainSummaryResponse.data,
  mockProgressOverviewResponse.data
);
