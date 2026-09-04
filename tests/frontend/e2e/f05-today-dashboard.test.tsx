import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import TodayPage from '@/app/today/page';
import { renderWithProviders } from '../harness/test-render';
import { assertTouchTargetSize, assertProgressbarA11y } from '../harness/a11y-helpers';

describe('Tier 1: Feature 05 - Today Dashboard & Study Session Queue', () => {
  it('test_today_dashboard_renders_header_with_greeting_and_target_duration', () => {
    renderWithProviders(<TodayPage />);

    expect(screen.getByText(/Kế hoạch hôm nay/i)).toBeInTheDocument();
    expect(screen.getByText('25 phút')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Chào buổi sáng/i })).toBeInTheDocument();
    expect(
      screen.getByText(/LINGUA OS đã chọn 4 hoạt động tối ưu nhất/i)
    ).toBeInTheDocument();
  });

  it('test_today_dashboard_renders_primary_start_study_cta_button', () => {
    renderWithProviders(<TodayPage />);

    const startBtn = screen.getByRole('button', { name: /Bắt đầu học ngay/i });
    expect(startBtn).toBeInTheDocument();
    assertTouchTargetSize(startBtn, 48);
  });

  it('test_today_dashboard_renders_daily_progress_bar', () => {
    renderWithProviders(<TodayPage />);

    expect(screen.getAllByText(/Tiến độ học hôm nay: 0 \/ 25 phút/i).length).toBeGreaterThan(0);
    const progressbar = screen.getByRole('progressbar');
    assertProgressbarA11y(progressbar, 0, 100);
  });

  it('test_today_dashboard_renders_recommended_activities_with_reasons_and_badges', () => {
    renderWithProviders(<TodayPage />);

    // Activity 1: FSRS Review
    expect(screen.getByText('1. Ôn tập thông minh (FSRS)')).toBeInTheDocument();
    expect(screen.getByText('23 từ đến hạn')).toBeInTheDocument();
    expect(screen.getByText(/Lý do: Thuật toán FSRS phát hiện 23 từ/i)).toBeInTheDocument();

    // Activity 2: Reader
    expect(screen.getByText('2. Đọc bài: An Unexpected Morning')).toBeInTheDocument();
    expect(screen.getByText('Nội dung phù hợp')).toBeInTheDocument();

    // Activity 3: Listening Reflex
    expect(screen.getByText('3. Luyện phản xạ nghe câu')).toBeInTheDocument();
    expect(screen.getByText('Củng cố nghe')).toBeInTheDocument();
  });

  it('test_today_dashboard_renders_language_brain_snapshot_with_concept_chips', () => {
    renderWithProviders(<TodayPage />);

    expect(screen.getByText('Trạng thái Language Brain')).toBeInTheDocument();
    expect(screen.getByText('Sức khỏe trí nhớ: 87%')).toBeInTheDocument();

    const chips = screen.getAllByRole('status');
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('perseverance')).toBeInTheDocument();
    expect(screen.getByText('resilience')).toBeInTheDocument();
    expect(screen.getByText('effortless')).toBeInTheDocument();
    expect(screen.getByText('meticulous')).toBeInTheDocument();
  });
});
