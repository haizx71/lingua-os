import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import TodayPage from '@/app/today/page';
import { renderWithProviders } from '../harness/test-render';
import { assertTouchTargetSize, assertProgressbarA11y } from '../harness/a11y-helpers';

describe('Tier 1: Feature 05 - Today Dashboard & Study Session Queue', () => {
  it('shows the current plan summary and target without inventing a personal greeting', () => {
    renderWithProviders(<TodayPage />);

    expect(within(screen.getByRole('region', { name: 'Kế hoạch học tập hôm nay' })).getByText('Kế hoạch hôm nay', { exact: true })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.replace(/\s/g, '') === '25phút')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Kế hoạch của bạn' })).toBeInTheDocument();
    expect(screen.getByText('Xem hoạt động được lên lịch và chọn điều muốn bắt đầu.')).toBeInTheDocument();
    expect(screen.queryByText(/LINGUA OS đã chọn/i)).not.toBeInTheDocument();
  });

  it('offers the next scheduled activity as the primary action', () => {
    renderWithProviders(<TodayPage />);

    const startBtn = screen.getAllByRole('button', { name: 'Bắt đầu ôn tập' })[0];
    expect(startBtn).toBeDefined();
    expect(startBtn).toBeInTheDocument();
    assertTouchTargetSize(startBtn, 44);
    expect(startBtn.closest('a')).toHaveAttribute('href', '/review');
  });

  it('exposes server plan completion in an accessible progress bar', () => {
    renderWithProviders(<TodayPage />);

    expect(screen.getByText(/0 trên 25 phút đã hoàn thành hôm nay/i)).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    assertProgressbarA11y(progressbar, 0, 100);
    expect(progressbar).toHaveAccessibleName('Tiến độ hôm nay: 0 / 25 phút');
  });

  it('preserves the ordered activities and their server-provided explanations', () => {
    renderWithProviders(<TodayPage />);

    const rows = screen.getAllByRole('article');
    expect(rows.map((row) => within(row).getByRole('heading', { level: 3 }).textContent)).toEqual([
      '1. Ôn tập thông minh (FSRS)',
      '2. Đọc bài: An Unexpected Morning',
      '3. Luyện phản xạ nghe câu',
      '4. Khám phá 4 từ mới',
    ]);
    expect(rows[0]).toHaveTextContent(/FSRS phát hiện 23 từ/);
    expect(rows[1]).toHaveTextContent(/96% từ vựng quen thuộc/);
    expect(rows[2]).toHaveTextContent(/Tín hiệu nghe hiện còn yếu hơn nhận diện khi đọc/);
  });

  it('keeps secondary brain metrics out of the primary Today plan', () => {
    renderWithProviders(<TodayPage />);

    expect(screen.queryByText('Trạng thái Language Brain')).not.toBeInTheDocument();
    expect(screen.queryByText('Sức khỏe trí nhớ: 87%')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Kế hoạch học tập hôm nay' })).getByRole('heading', { level: 2, name: 'Bắt đầu từ một bước nhỏ.' })).toBeInTheDocument();
  });
});
