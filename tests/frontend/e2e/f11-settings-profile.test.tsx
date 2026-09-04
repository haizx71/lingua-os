import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import ProfilePage from '@/app/profile/page';
import { ProfileView } from '@/features/profile/ProfileView';
import { renderWithProviders } from '../harness/test-render';

describe('Tier 1: Feature 11 - Settings & Profile Views', () => {
  it('test_settings_page_renders_header_and_learning_goal_section', () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText('Preferences & Account')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Cài đặt hệ thống/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Mục tiêu học tập hàng ngày/i })).toBeInTheDocument();
  });

  it('test_settings_page_renders_daily_target_minutes_and_new_words_budget', () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText('Thời lượng học mỗi ngày')).toBeInTheDocument();
    expect(screen.getByText('25 phút / ngày')).toBeInTheDocument();

    expect(screen.getByText('Ngân sách từ mới mỗi ngày')).toBeInTheDocument();
    expect(screen.getByText('4 từ mới / ngày')).toBeInTheDocument();
  });

  it('test_profile_page_renders_user_account_header_with_avatar_badge', () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText('User Account')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Hồ sơ người học/i })).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Learner Account/i })).toBeInTheDocument();
  });

  it('test_profile_page_displays_starting_level_estimate_and_confidence', () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText(/Ước lượng khởi điểm:/i)).toBeInTheDocument();
    expect(screen.getByText(/A2 Elementary/i)).toBeInTheDocument();
    expect(screen.getByText(/Độ tin cậy: Vừa/i)).toBeInTheDocument();
  });

  it('test_profile_view_renders_neutral_identity_when_name_and_email_are_absent', () => {
    renderWithProviders(
      <ProfileView initialProfile={{ name: null, email: null, timeZone: null }} />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Chưa cung cấp' })).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('test_profile_page_renders_total_stats_and_streak', () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText('Tổng từ đã gặp')).toBeInTheDocument();
    expect(screen.getByText('582 từ')).toBeInTheDocument();

    expect(screen.getByText('Đã nắm vững')).toBeInTheDocument();
    expect(screen.getByText('483 từ')).toBeInTheDocument();

    expect(screen.getByText('Số ngày học liên tục')).toBeInTheDocument();
    expect(screen.getByText('5 ngày')).toBeInTheDocument();
  });
});
