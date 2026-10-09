import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import ProgressPage from '@/app/progress/page';
import { ProgressAnalytics } from '@/features/progress/ProgressAnalytics';
import { defaultProgressSummary } from '@/fixtures/progressFixture';
import { renderWithProviders } from '../harness/test-render';

describe('Tier 1: Feature 09 - Progress & Level Estimation', () => {
  it('shows a truthful unavailable state instead of fixture progress numbers', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tiến độ học' })).toBeInTheDocument();
    expect(screen.getByText('Chưa thể hiển thị tiến độ')).toBeInTheDocument();
    expect(screen.getByText('Chưa thể hiển thị thống kê tại đây. Bạn có thể tiếp tục bài học ở Hôm nay.')).toBeInTheDocument();
    expect(screen.queryByText('115')).not.toBeInTheDocument();
    expect(screen.queryByText('14')).not.toBeInTheDocument();
    expect(screen.queryByText('26')).not.toBeInTheDocument();
    expect(screen.queryByText('87%')).not.toBeInTheDocument();
  });

  it('renders supplied progress data without deriving or changing the server values', () => {
    renderWithProviders(<ProgressAnalytics initialData={defaultProgressSummary} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tiến độ học' })).toBeInTheDocument();
    expect(screen.getByText('115')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('26 từ')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.replace(/\s/g, '') === '87%')).toBeInTheDocument();

    const history = screen.getByRole('list', { name: 'Thời gian học theo ngày' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(defaultProgressSummary.history7d.length);
  });
});
