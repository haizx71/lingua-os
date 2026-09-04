import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { EmptyState, ErrorState } from '@lingua/ui';
import { renderWithProviders } from '../harness/test-render';
import { MockApiService } from '../harness/mock-api-service';
import { assertEmptyState, assertErrorState } from '../harness/state-helpers';
import type { ErrorCode } from '../harness/types';

describe('Tier 2: Boundary & Corner Cases - Empty Queues, Theme & Error Recovery', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  describe('Empty Queues & Collections', () => {
    it('test_empty_review_queue_renders_celebration_empty_state', async () => {
      // Clear review queue
      const queue = await apiService.getReviewQueue();
      for (const item of queue) {
        await apiService.submitReviewRating(item.id, 'good');
      }

      const emptyQueue = await apiService.getReviewQueue();
      expect(emptyQueue).toHaveLength(0);

      renderWithProviders(
        <EmptyState
          title="Đã hoàn thành toàn bộ hàng đợi ôn tập!"
          description="FSRS không ghi nhận từ nào đến hạn cần ôn ngay bây giờ."
          actionLabel="Đọc bài mới trong Reader"
          onAction={() => {}}
        />
      );

      assertEmptyState('Đã hoàn thành toàn bộ hàng đợi ôn tập!', 'Đọc bài mới trong Reader');
    });

    it('test_empty_dictionary_search_results_state', () => {
      renderWithProviders(
        <EmptyState
          title="Không tìm thấy từ vựng"
          description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn."
          actionLabel="Xóa bộ lọc"
          onAction={() => {}}
        />
      );

      assertEmptyState('Không tìm thấy từ vựng', 'Xóa bộ lọc');
    });

    it('test_zero_activity_progress_state', async () => {
      const plan = await apiService.getTodayPlan();
      expect(plan.minutes_spent).toBe(0);
      expect(plan.completed_activities_count).toBe(0);
    });
  });

  describe('Theme Tokens & Reduced Motion Ergonomics', () => {
    it('test_dark_theme_sets_dark_class_and_slate_950_background', () => {
      const { container } = renderWithProviders(
        <div data-testid="themed-wrapper">Nội dung học chế độ tối</div>,
        { theme: 'dark' }
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('dark');
      expect(wrapper.className).toContain('bg-slate-950');
      expect(wrapper.className).toContain('text-slate-100');
    });

    it('test_light_theme_sets_slate_50_background', () => {
      const { container } = renderWithProviders(
        <div data-testid="themed-wrapper">Nội dung học chế độ sáng</div>,
        { theme: 'light' }
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('bg-slate-50');
      expect(wrapper.className).toContain('text-slate-900');
    });

    it('test_reduced_motion_applies_zero_duration_styles', () => {
      const { container } = renderWithProviders(
        <div data-testid="motion-wrapper">Trợ năng giảm chuyển động</div>,
        { reducedMotion: true }
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.transitionDuration).toBe('0s');
      expect(wrapper.style.animationDuration).toBe('0s');
    });
  });

  describe('HTTP Error Status Code Handling & Retry Recovery', () => {
    const errorScenarios: Array<{ code: ErrorCode; expectedStatus: number; desc: string }> = [
      { code: 'UNAUTHENTICATED', expectedStatus: 401, desc: '401 Unauthorized' },
      { code: 'FORBIDDEN', expectedStatus: 403, desc: '403 Forbidden' },
      { code: 'NOT_FOUND', expectedStatus: 404, desc: '404 Not Found' },
      { code: 'VALIDATION_ERROR', expectedStatus: 422, desc: '422 Unprocessable Entity' },
      { code: 'INTERNAL_ERROR', expectedStatus: 500, desc: '500 Server Error' },
    ];

    errorScenarios.forEach(({ code, expectedStatus, desc }) => {
      it(`test_error_handling_for_${code}_(${desc})`, async () => {
        apiService.injectError(code);

        try {
          await apiService.getTodayPlan();
          expect.fail('Should have thrown an error');
        } catch (err: any) {
          expect(err.status).toBe(expectedStatus);
          expect(err.errorResponse.code).toBe(code);
        }

        renderWithProviders(<ErrorState code={code} onRetry={() => {}} />);
        assertErrorState(code);
      });
    });

    it('test_network_failure_and_successful_retry_recovery_workflow', async () => {
      const handleRetry = vi.fn(() => {
        apiService.clearInjectedError();
      });

      // 1. Inject server error
      apiService.injectError('INTERNAL_ERROR');

      // 2. Render ErrorState
      const { rerender } = renderWithProviders(
        <ErrorState code="INTERNAL_ERROR" onRetry={handleRetry} />,
        { apiService }
      );
      assertErrorState('INTERNAL_ERROR');

      // 3. User clicks retry
      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);

      // 4. After clearing error, verify service recovers
      const plan = await apiService.getTodayPlan();
      expect(plan).toBeDefined();
      expect(plan.target_minutes).toBe(25);

      // 5. Rerender success state
      rerender(<div data-testid="recovered-view">Đã khôi phục thành công!</div>);
      expect(screen.getByTestId('recovered-view')).toBeInTheDocument();
    });
  });
});
