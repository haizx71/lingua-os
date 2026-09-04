import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { LoadingState, EmptyState, ErrorState, InlineAlert } from '@lingua/ui';
import { renderWithProviders } from '../harness/test-render';
import { assertLoadingState, assertEmptyState, assertErrorState } from '../harness/state-helpers';
import type { ErrorCode } from '../harness/types';

describe('Tier 1: Feature 12 - Mandatory 4-State UI Coverage', () => {
  it('test_loading_state_renders_accessible_skeletons_and_message', () => {
    const { container } = renderWithProviders(<LoadingState message="Đang tải dữ liệu học tập..." count={3} />);

    assertLoadingState(container);
    expect(screen.getByText('Đang tải dữ liệu học tập...')).toBeInTheDocument();
  });

  it('test_empty_state_renders_title_description_and_fires_action_callback', () => {
    const handleAction = vi.fn();
    renderWithProviders(
      <EmptyState
        title="Chưa có từ vựng cần ôn"
        description="Bạn đã hoàn thành tất cả các mục ôn tập hôm nay."
        actionLabel="Đọc bài mới"
        onAction={handleAction}
      />
    );

    assertEmptyState('Chưa có từ vựng cần ôn', 'Đọc bài mới');

    const actionBtn = screen.getByRole('button', { name: /Đọc bài mới/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('test_error_state_maps_all_5_semantic_error_codes_with_actionable_guidance', () => {
    const errorCodes: ErrorCode[] = [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ];

    errorCodes.forEach((code) => {
      const { unmount } = renderWithProviders(<ErrorState code={code} onRetry={() => {}} />);
      assertErrorState(code);
      unmount();
    });
  });

  it('test_error_state_retry_button_triggers_on_retry_handler', () => {
    const handleRetry = vi.fn();
    renderWithProviders(<ErrorState code="INTERNAL_ERROR" onRetry={handleRetry} />);

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('test_inline_alert_renders_all_variants_with_accessible_alert_role', () => {
    const { rerender } = renderWithProviders(
      <InlineAlert variant="info" title="Thông tin">
        Hệ thống đã cập nhật kế hoạch hôm nay.
      </InlineAlert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Thông tin')).toBeInTheDocument();

    rerender(
      <InlineAlert variant="warning" title="Cảnh báo">
        Từ vựng sắp quên.
      </InlineAlert>
    );
    expect(screen.getByText('Cảnh báo')).toBeInTheDocument();

    rerender(
      <InlineAlert variant="success" title="Thành công">
        Đã lưu từ vựng vào Brain.
      </InlineAlert>
    );
    expect(screen.getByText('Thành công')).toBeInTheDocument();
  });
});
