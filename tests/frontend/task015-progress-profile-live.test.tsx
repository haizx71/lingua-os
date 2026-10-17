import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  MockApiClient,
  mockBrainSummaryResponse,
  mockMeResponse,
  mockProgressOverviewResponse,
  type ApiClient,
} from '@lingua/types';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';

describe('TASK-015: Live Progress & Learner Profile Integration', () => {
  it('loads live progress overview from ApiClient and supports window switching', async () => {
    const getProgressOverview = vi.fn().mockResolvedValue(mockProgressOverviewResponse);
    const client: ApiClient = Object.assign(new MockApiClient(), {
      transportKind: 'http' as const,
      getProgressOverview,
    });

    render(<ProgressAnalytics apiClient={client} />);
    expect(screen.getByText('Đang tải tiến độ học tập...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('115')).toBeInTheDocument();
    });
    expect(screen.getByText('26 từ')).toBeInTheDocument();
    expect(getProgressOverview).toHaveBeenCalledWith({ window: 'week' });

    const monthButton = screen.getByRole('button', { name: '30 ngày' });
    fireEvent.click(monthButton);

    await waitFor(() => {
      expect(getProgressOverview).toHaveBeenCalledWith({ window: 'month' });
    });
  });

  it('loads live learner profile by combining getMe, getBrainSummary, and getProgressOverview', async () => {
    const getMe = vi.fn().mockResolvedValue(mockMeResponse);
    const getBrainSummary = vi.fn().mockResolvedValue(mockBrainSummaryResponse);
    const getProgressOverview = vi.fn().mockResolvedValue(mockProgressOverviewResponse);
    const client: ApiClient = Object.assign(new MockApiClient(), {
      transportKind: 'http' as const,
      getMe,
      getBrainSummary,
      getProgressOverview,
    });

    render(<ProfileView apiClient={client} />);
    expect(screen.getByText('Đang tải hồ sơ người học...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Learner Account' })).toBeInTheDocument();
    });
    expect(screen.getByText('learner@lingua-os.dev')).toBeInTheDocument();
    expect(screen.getByText('483 trên 582 khái niệm đã gặp được ghi nhận là đã củng cố.')).toBeInTheDocument();
    expect(screen.getByText('5 ngày')).toBeInTheDocument();
  });
});
