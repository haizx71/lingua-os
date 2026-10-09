import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import ProfilePage from '@/app/profile/page';
import { ProfileView } from '@/features/profile/ProfileView';
import { renderWithProviders } from '../harness/test-render';

describe('Tier 1: Feature 11 - Settings & Profile Views', () => {
  it('shows the settings page and daily learning controls', () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Mục tiêu học mỗi ngày' })).toBeInTheDocument();
    expect(screen.getByText('Thời lượng học mỗi ngày')).toBeInTheDocument();
    expect(screen.getByText('25 phút / ngày')).toBeInTheDocument();
    expect(screen.getByText('Ngân sách từ mới mỗi ngày')).toBeInTheDocument();
    expect(screen.getByText('4 từ mới / ngày')).toBeInTheDocument();
    expect(screen.getByText(/chưa được lưu lâu dài/i)).toBeInTheDocument();
  });

  it('does not present unprovided profile metrics or level estimates as learner data', () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByRole('heading', { name: 'Chưa thể hiển thị hồ sơ' })).toBeInTheDocument();
    expect(screen.queryByText('A2')).not.toBeInTheDocument();
    expect(screen.queryByText('582')).not.toBeInTheDocument();
    expect(screen.queryByText('483')).not.toBeInTheDocument();
    expect(screen.queryByText(/ước lượng khởi điểm/i)).not.toBeInTheDocument();
  });

  it('uses a neutral identity when the supplied profile omits name and email', () => {
    renderWithProviders(
      <ProfileView initialProfile={{ name: null, email: null, timeZone: null }} />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Người học' })).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('renders profile summaries only from the supplied profile values', () => {
    renderWithProviders(
      <ProfileView initialProfile={{
        name: 'Học viên',
        email: 'learner@example.test',
        timeZone: 'Asia/Ho_Chi_Minh',
        startingLevelEstimate: 'A2',
        targetGoal: 'Đọc tốt hơn',
        totalConceptsEncountered: 12,
        totalConceptsMastered: 3,
        streakDays: 2,
      }} />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Học viên' })).toBeInTheDocument();
    expect(screen.getByText('learner@example.test')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('3 trên 12 khái niệm đã gặp được ghi nhận là đã củng cố.')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('2 ngày')).toBeInTheDocument();
  });
});
