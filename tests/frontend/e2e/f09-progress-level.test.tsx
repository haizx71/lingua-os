import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ProgressPage from '@/app/progress/page';
import { renderWithProviders } from '../harness/test-render';

describe('Tier 1: Feature 09 - Progress & Level Estimation', () => {
  it('test_progress_page_renders_header_and_evidence_subhead', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByText('Learning Evidence & Trends')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Tiến độ học thực tế/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Đo lường sự tiến bộ dựa trên bằng chứng ghi nhớ thực tế/i)
    ).toBeInTheDocument();
  });

  it('test_progress_page_renders_weekly_evidence_card', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByText('Bằng chứng tuần này')).toBeInTheDocument();
  });

  it('test_progress_page_renders_new_concepts_acquired_metric', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByText('Từ mới đã tiếp nạp')).toBeInTheDocument();
    expect(screen.getByText('+14 từ')).toBeInTheDocument();
  });

  it('test_progress_page_renders_concepts_solidified_metric', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByText('Từ đã củng cố vững chắc')).toBeInTheDocument();
    expect(screen.getByText('+26 từ')).toBeInTheDocument();
  });

  it('test_progress_page_renders_active_study_days_ratio', () => {
    renderWithProviders(<ProgressPage />);

    expect(screen.getByText('Ngày học thành công')).toBeInTheDocument();
    expect(screen.getByText('5 / 7 ngày')).toBeInTheDocument();
  });
});
