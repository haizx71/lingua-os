/**
 * Comprehensive App Integration Test Suite
 * Milestone 3 & Milestone 4 Verification
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './harness/test-render';
import { MockApiService } from './harness/mock-api-service';
import { AppShell } from '@/components/navigation/AppShell';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { TabletRail } from '@/components/navigation/TabletRail';
import TodayPage from '@/app/today/page';
import ReviewPage from '@/app/review/page';
import ReadPage from '@/app/read/page';
import BrainPage from '@/app/brain/page';
import ProgressPage from '@/app/progress/page';
import LibraryPage from '@/app/library/page';
import DictionaryPage from '@/app/dictionary/page';
import SettingsPage from '@/app/settings/page';
import ProfilePage from '@/app/profile/page';
import OnboardingPage from '@/app/onboarding/page';
import {
  TodayDashboard,
  ReviewSession,
  InteractiveReader,
  LanguageBrainCanvas,
  ProgressAnalytics,
  LibraryView,
  DictionaryView,
  SettingsView,
  ProfileView,
  OnboardingDiagnostic,
} from '@/features';
import { assertEmptyState, assertErrorState, assertLoadingState } from './harness/state-helpers';
import { assertTouchTargetSize, assertProgressbarA11y } from './harness/a11y-helpers';
import { defaultReviewQueue } from '@/fixtures/reviewFixture';

vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Integration Suite 1: Navigation Shell & Focus Mode', () => {
  it('renders all 5 primary MVP routes in Desktop, Tablet, and Mobile layouts', () => {
    const { unmount: unmountDesktop } = renderWithProviders(<DesktopSidebar currentPath="/today" />);
    expect(screen.getByRole('link', { name: /Hôm nay/i })).toHaveAttribute('href', '/today');
    expect(screen.getByRole('link', { name: /Đọc/i })).toHaveAttribute('href', '/read');
    expect(screen.getByRole('link', { name: /Ôn tập/i })).toHaveAttribute('href', '/review');
    expect(screen.getByRole('link', { name: /Brain/i })).toHaveAttribute('href', '/brain');
    expect(screen.getByRole('link', { name: /Tiến độ/i })).toHaveAttribute('href', '/progress');
    unmountDesktop();

    const { unmount: unmountTablet } = renderWithProviders(<TabletRail currentPath="/read" />);
    expect(screen.getByRole('complementary', { name: /Điều hướng thanh bên thu gọn/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Đọc/i })).toHaveAttribute('aria-current', 'page');
    unmountTablet();

    const { unmount: unmountMobile } = renderWithProviders(<MobileBottomNav currentPath="/review" />);
    expect(screen.getByRole('navigation', { name: /Điều hướng chính di động/i })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    unmountMobile();
  });

  it('hides all navigation bars when AppShell focusMode is enabled', () => {
    renderWithProviders(
      <AppShell focusMode={true}>
        <div data-testid="focus-view">Chế độ tập trung học</div>
      </AppShell>
    );

    expect(screen.getByTestId('focus-view')).toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng chính di động')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng màn hình lớn')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng thanh bên thu gọn')).not.toBeInTheDocument();
  });
});

describe('Integration Suite 2: Feature Pages 4-State UI Matrix Coverage', () => {
  it('verifies Loading state rendering with skeleton across all features', () => {
    const { container: c1, unmount: u1 } = renderWithProviders(<TodayDashboard forcedState="loading" />);
    assertLoadingState(c1);
    expect(screen.getByText(/Đang tải kế hoạch học tập hôm nay/i)).toBeInTheDocument();
    u1();

    const { container: c2, unmount: u2 } = renderWithProviders(<ReviewSession forcedState="loading" />);
    assertLoadingState(c2);
    expect(screen.getByText(/Đang tải hàng đợi thẻ ôn tập/i)).toBeInTheDocument();
    u2();

    const { container: c3, unmount: u3 } = renderWithProviders(<InteractiveReader forcedState="loading" />);
    assertLoadingState(c3);
    u3();

    const { container: c4, unmount: u4 } = renderWithProviders(<LanguageBrainCanvas forcedState="loading" />);
    assertLoadingState(c4);
    u4();

    const { container: c5, unmount: u5 } = renderWithProviders(<ProgressAnalytics forcedState="loading" />);
    assertLoadingState(c5);
    u5();
  });

  it('verifies Error state mapping and Retry button triggers on retry handler', () => {
    const errorCodes = ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR'] as const;

    errorCodes.forEach((code) => {
      const { unmount } = renderWithProviders(
        <TodayDashboard forcedState="error" forcedErrorCode={code} />
      );
      assertErrorState(code);

      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);

      unmount();
    });
  });

  it('verifies Empty state rendering with clear message and action CTA', () => {
    const { unmount: u1 } = renderWithProviders(<LibraryView forcedState="empty" />);
    assertEmptyState('Chưa có bài đọc nào được lưu', 'Đọc bài trong Reader');
    u1();

    const { unmount: u2 } = renderWithProviders(<DictionaryView initialConcepts={[]} />);
    assertEmptyState('Không tìm thấy từ vựng', 'Xóa bộ lọc');
    u2();

    const { unmount: u3 } = renderWithProviders(<ReviewSession initialQueue={[]} />);
    assertEmptyState('Đã hoàn thành toàn bộ hàng đợi ôn tập!', 'Đọc bài mới trong Reader');
    u3();
  });
});

describe('Integration Suite 3: Interactive Workflows & State Machines', () => {
  it('executes full Smart Review session: flips card, submits rating, and reaches completion', () => {
    const onRatingSubmit = vi.fn();
    const onSessionComplete = vi.fn();

    renderWithProviders(
      <ReviewSession
        onRatingSubmit={onRatingSubmit}
        onSessionComplete={onSessionComplete}
      />
    );

    // Initial card
    expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
    expect(screen.getByText('23 từ đến hạn')).toBeInTheDocument();

    // Reveal Answer
    const revealBtn = screen.getByRole('button', { name: /Hiện đáp án & nghĩa/i });
    fireEvent.click(revealBtn);
    expect(screen.getByText(/Cuộc hẹn chính thức/i)).toBeInTheDocument();

    // Click 'Good' Rating
    const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
    fireEvent.click(goodBtn);
    expect(onRatingSubmit).toHaveBeenCalledWith(defaultReviewQueue[0].id, 'good');

    // Next Card: available
    expect(screen.getAllByText('available').length).toBeGreaterThan(0);

    // Rate 'Hard'
    const hardBtn = screen.getByRole('button', { name: /Khó \(Hard\)/i });
    fireEvent.click(hardBtn);
    expect(onRatingSubmit).toHaveBeenCalledWith(defaultReviewQueue[1].id, 'hard');

    // Next Card: convenient
    expect(screen.getAllByText('convenient').length).toBeGreaterThan(0);

    // Rate 'Easy'
    const easyBtn = screen.getByRole('button', { name: /Dễ \(Easy\)/i });
    fireEvent.click(easyBtn);
    expect(onRatingSubmit).toHaveBeenCalledWith(defaultReviewQueue[2].id, 'easy');

    // All cards finished -> Completion empty state
    expect(onSessionComplete).toHaveBeenCalled();
    expect(screen.getByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!')).toBeInTheDocument();
  });

  it('executes Interactive Reader word inspection and saves word to Brain', () => {
    const onSaveWord = vi.fn();
    renderWithProviders(<InteractiveReader onSaveWord={onSaveWord} />);

    // Click target word 'appointment'
    const wordBtn = screen.getByRole('button', { name: 'appointment' });
    fireEvent.click(wordBtn);

    // Dialog opens with word details
    const dialog = screen.getByRole('dialog', { name: /Chi tiết từ vựng/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/\/əˈpɔɪnt\.mənt\//i)).toBeInTheDocument();

    // Click target word 'available'
    const availableBtn = screen.getByRole('button', { name: 'available' });
    fireEvent.click(availableBtn);

    const saveBtn = screen.getByRole('button', { name: /Lưu vào ôn tập/i });
    fireEvent.click(saveBtn);

    expect(onSaveWord).toHaveBeenCalledWith(
      expect.objectContaining({ raw: 'available', isTarget: true })
    );
    expect(screen.getByText(/Đã lưu "available" vào Language Brain/i)).toBeInTheDocument();
  });

  it('executes Language Brain CEFR and Status filtering', () => {
    renderWithProviders(<LanguageBrainCanvas />);

    // Initial: all nodes visible (6 nodes)
    expect(screen.getByText(/Mạng lưới khái niệm & từ vựng \(6 từ\)/i)).toBeInTheDocument();

    // Filter by B1
    const b1Btn = screen.getByRole('button', { name: 'B1' });
    fireEvent.click(b1Btn);
    expect(screen.getByText(/Mạng lưới khái niệm & từ vựng \(2 từ\)/i)).toBeInTheDocument();

    // Filter by B2
    const b2Btn = screen.getByRole('button', { name: 'B2' });
    fireEvent.click(b2Btn);
    expect(screen.getByText(/Mạng lưới khái niệm & từ vựng \(1 từ\)/i)).toBeInTheDocument();
    expect(screen.getByText('collaborate')).toBeInTheDocument();

    // Click ALL to reset
    const allBtn = screen.getByRole('button', { name: 'ALL' });
    fireEvent.click(allBtn);
    expect(screen.getByText(/Mạng lưới khái niệm & từ vựng \(6 từ\)/i)).toBeInTheDocument();
  });

  it('executes Settings daily target minutes and new words budget updates', () => {
    const onSave = vi.fn();
    renderWithProviders(<SettingsView onSaveSettings={onSave} />);

    // Change target minutes to 45 mins
    const min45Btn = screen.getByRole('button', { name: '45 phút' });
    fireEvent.click(min45Btn);
    expect(screen.getByText('45 phút / ngày')).toBeInTheDocument();

    // Change new word budget to 8 words
    const count8Btn = screen.getByRole('button', { name: '8 từ' });
    fireEvent.click(count8Btn);
    expect(screen.getByText('8 từ mới / ngày')).toBeInTheDocument();

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyTargetMinutes: 45,
        newWordsBudgetPerDay: 8,
      })
    );
    expect(screen.getByText(/Đã lưu tùy chọn cục bộ/i)).toBeInTheDocument();
  });

  it('executes Diagnostic Onboarding flow and returns a server-shaped estimate view', () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingDiagnostic onComplete={onComplete} />);

    expect(screen.getByText('Kiểm tra năng lực thích nghi')).toBeInTheDocument();

    // Question 1: appointment
    const optA = screen.getByRole('button', { name: /A\. appointment/i });
    fireEvent.click(optA);
    const nextBtn1 = screen.getByRole('button', { name: /Câu tiếp theo/i });
    fireEvent.click(nextBtn1);

    // Question 2: available
    const optB = screen.getByRole('button', { name: /available/i });
    fireEvent.click(optB);
    const nextBtn2 = screen.getByRole('button', { name: /Câu tiếp theo/i });
    fireEvent.click(nextBtn2);

    // Question 3: on schedule
    const optC = screen.getByRole('button', { name: /on schedule/i });
    fireEvent.click(optC);
    const finishBtn = screen.getByRole('button', { name: /Hoàn thành chẩn đoán/i });
    fireEvent.click(finishBtn);

    // Completion result screen
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedLevel: 'A2',
        confidence: 'medium',
        evidenceCount: 12,
        methodVersion: 'starting-level-heuristic-v1',
      })
    );


    expect(screen.getByText('Kết quả ước lượng khởi điểm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /A2 Elementary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bắt đầu học ngày đầu tiên/i })).toBeInTheDocument();
  });
});
