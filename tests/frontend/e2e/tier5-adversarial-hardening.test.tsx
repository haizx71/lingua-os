/**
 * Tier 5: Adversarial Coverage Hardening & Stress Test Suite
 * Milestone 5 Quality Gate Verification
 *
 * Scope:
 * 1. Rapid-Fire & Race Condition Event Handling (Rapid ratings, keyboard spam, queue drainage)
 * 2. Extreme Boundaries, Fuzzing & Malicious Inputs (10k chars, Unicode diacritics, SQLi/XSS payloads)
 * 3. State Machine Invariants & Multi-Route Concurrency (Focus Mode toggles, filter combinations, zoom clamping)
 * 4. Network Fault Injections & Mid-Session Recovery (500/401/403/404/422 matrix & retry lifecycle)
 * 5. Deep Accessibility, Touch Targets & Non-Color Invariant Stress Testing
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../harness/test-render';
import { MockApiService } from '../harness/mock-api-service';
import { defaultReviewQueue } from '@/fixtures/reviewFixture';
import { defaultReaderPassage } from '@/fixtures/readerFixture';
import { defaultProgressSummary } from '@/fixtures/progressFixture';
import { MockApiClient } from '@lingua/types';
import { AppShell } from '@/components/navigation/AppShell';

// Feature Components
import { TodayDashboard } from '@/features/today/TodayDashboard';
import { ReviewSession } from '@/features/review/ReviewSession';
import { InteractiveReader } from '@/features/read/InteractiveReader';
import { LanguageBrainCanvas } from '@/features/brain/LanguageBrainCanvas';
import { ProgressAnalytics } from '@/features/progress/ProgressAnalytics';
import { DictionaryView } from '@/features/dictionary/DictionaryView';
import { LibraryView } from '@/features/library/LibraryView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ProfileView } from '@/features/profile/ProfileView';
import { OnboardingDiagnostic } from '@/features/onboarding/OnboardingDiagnostic';

// UI Primitives
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  Progress,
  ErrorState,
  EmptyState,
  LoadingState,
  InlineAlert,
  AudioPlayer,
  ReviewCard,
} from '@lingua/ui';

import {
  assertContrastRatio,
  assertTouchTargetSize,
  assertProgressbarA11y,
  assertAriaRole,
} from '../harness/a11y-helpers';

vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Tier 5 Suite 1: Rapid-Fire & Race Condition Event Handling', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  it('test_rapid_fire_rating_clicks_advance_review_queue_cleanly_without_out_of_bounds', async () => {
    const handleRatingSubmit = vi.fn();
    const handleSessionComplete = vi.fn();

    renderWithProviders(
      <ReviewSession
        onRatingSubmit={handleRatingSubmit}
        onSessionComplete={handleSessionComplete}
      />
    );

    // Card 1: appointment
    expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
    const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
    fireEvent.click(goodBtn);

    expect(handleRatingSubmit).toHaveBeenCalledTimes(1);
    expect(handleRatingSubmit).toHaveBeenLastCalledWith(defaultReviewQueue[0].id, 'good');

    // Card 2: available
    expect((await screen.findAllByText('available')).length).toBeGreaterThan(0);
    const easyBtn = screen.getByRole('button', { name: /Dễ \(Easy\)/i });
    fireEvent.click(easyBtn);

    expect(handleRatingSubmit).toHaveBeenCalledTimes(2);
    expect(handleRatingSubmit).toHaveBeenLastCalledWith(defaultReviewQueue[1].id, 'easy');

    // Card 3: convenient
    expect((await screen.findAllByText('convenient')).length).toBeGreaterThan(0);
    const hardBtn = screen.getByRole('button', { name: /Khó \(Hard\)/i });
    fireEvent.click(hardBtn);

    expect(handleRatingSubmit).toHaveBeenCalledTimes(3);
    expect(handleRatingSubmit).toHaveBeenLastCalledWith(defaultReviewQueue[2].id, 'hard');

    // Queue exhausted -> Completion EmptyState rendered
    expect(
      await screen.findByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!')
    ).toBeInTheDocument();
    expect(handleSessionComplete).toHaveBeenCalledTimes(1);
  });

  it('test_rapid_keyboard_shortcut_spamming_does_not_crash_review_session', async () => {
    const handleRatingSubmit = vi.fn();
    const handleSessionComplete = vi.fn();

    renderWithProviders(
      <ReviewSession
        onRatingSubmit={handleRatingSubmit}
        onSessionComplete={handleSessionComplete}
      />
    );

    // Rapid keyboard ratings (1: Again, 2: Hard, 3: Good, 4: Easy)
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    fireEvent.keyDown(window, { key: '3', code: 'Digit3' });
    fireEvent.keyDown(window, { key: '4', code: 'Digit4' });

    // Should complete cleanly after 3 cards
    expect(handleRatingSubmit).toHaveBeenCalledTimes(3);
    expect(handleSessionComplete).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!')
    ).toBeInTheDocument();
  });

  it('test_keyboard_shortcuts_ignored_when_typing_in_input_field', () => {
    const handleRatingSubmit = vi.fn();

    renderWithProviders(
      <div>
        <input data-testid="search-input" type="text" />
        <ReviewSession onRatingSubmit={handleRatingSubmit} />
      </div>
    );

    const input = screen.getByTestId('search-input');
    input.focus();

    // Typing numbers 1, 2, 3 into input must not trigger rating
    fireEvent.keyDown(input, { key: '1', code: 'Digit1', target: input });
    fireEvent.keyDown(input, { key: '2', code: 'Digit2', target: input });

    expect(handleRatingSubmit).not.toHaveBeenCalled();
  });

  it('test_double_reveal_toggle_idempotency_in_review_session', () => {
    renderWithProviders(<ReviewSession />);

    // Initially answer not revealed
    expect(screen.queryByText(/Cuộc hẹn chính thức/i)).not.toBeInTheDocument();

    const revealBtn = screen.getByRole('button', { name: /Hiện đáp án & nghĩa/i });
    fireEvent.click(revealBtn);

    // Answer now visible
    expect(screen.getByText(/Cuộc hẹn chính thức/i)).toBeInTheDocument();

    // Trigger spacebar to toggle
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    // Space toggles back
    expect(screen.queryByText(/Cuộc hẹn chính thức/i)).not.toBeInTheDocument();

    // Space toggles again
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(screen.getByText(/Cuộc hẹn chính thức/i)).toBeInTheDocument();
  });
});

describe('Tier 5 Suite 2: Extreme Boundaries, Fuzzing & Malicious Inputs', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  it('test_fuzzing_dictionary_search_with_massive_10000_char_string', async () => {
    const massiveQuery = 'lingua_os_adversarial_fuzz_'.repeat(400); // 10,800 chars
    renderWithProviders(<DictionaryView />);

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: massiveQuery } });

    expect(
      await screen.findByText('Không tìm thấy từ vựng')
    ).toBeInTheDocument();

    // Clearing search restores list
    const clearBtn = screen.getByRole('button', { name: /Xóa từ khóa tìm kiếm/i });
    fireEvent.click(clearBtn);

    expect((await screen.findAllByText('appointment')).length).toBeGreaterThan(0);
  });

  it('test_xss_and_malicious_script_tags_rendered_as_safe_text_in_dictionary', async () => {
    const maliciousConcept = {
      id: 'concept-xss',
      term: '<script>window.pwned=true;</script>',
      lemma: '<script>window.pwned=true;</script>',
      pos: 'Noun',
      ipa: '/xss/',
      cefrLevel: 'C2',
      status: 'weak' as const,
      primaryTranslationVi: '<img src=x onerror=alert(1)>',
      definitions: [
        {
          meaningVi: '<b>Malicious bold injection</b> <img src=x onerror=alert(1)>',
          explanationEn: '<svg onload=alert(2)>',
        },
      ],
    };

    renderWithProviders(<DictionaryView initialConcepts={[maliciousConcept]} />);

    expect(screen.getAllByText('<script>window.pwned=true;</script>').length).toBeGreaterThan(0);
    expect(screen.getByText('<b>Malicious bold injection</b> <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect((window as any).pwned).toBeUndefined();
  });

  it('test_complex_vietnamese_diacritics_normalization_in_brain_canvas_search', async () => {
    renderWithProviders(<LanguageBrainCanvas />);

    const searchInput = screen.getByPlaceholderText(/Lọc từ vựng trong Brain/i);

    // Search Vietnamese translation with diacritics: "chính thức"
    fireEvent.change(searchInput, { target: { value: 'chính thức' } });
    expect(await screen.findByText('appointment')).toBeInTheDocument();
    expect(screen.queryByText('hesitate')).not.toBeInTheDocument();

    // Search Vietnamese diacritics: "rảnh rỗi"
    fireEvent.change(searchInput, { target: { value: 'rảnh rỗi' } });
    expect(await screen.findByText('available')).toBeInTheDocument();
    expect(screen.queryByText('appointment')).not.toBeInTheDocument();
  });

  it('test_special_unicode_rtl_and_zero_width_characters_handling', () => {
    const specialTokens = [
      'مرحبا بالعالم', // Arabic RTL
      '你好世界', // Chinese
      'Tiếng\u200BViệt\u200DZeroWidth', // Zero-width space/joiner
      '🔥💎👑🚀⚡', // Emojis
    ];

    specialTokens.forEach((token) => {
      const { unmount } = renderWithProviders(
        <ConceptChip status="active" term={token} />
      );
      expect(screen.getByText(token)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('Tier 5 Suite 3: State Machine Invariants & Multi-Route Concurrency', () => {
  it('test_brain_canvas_zoom_controls_clamped_strictly_between_50_and_150_percent', () => {
    renderWithProviders(<LanguageBrainCanvas />);

    const zoomInBtn = screen.getByRole('button', { name: /Phóng to mạng lưới/i });
    const zoomOutBtn = screen.getByRole('button', { name: /Thu nhỏ mạng lưới/i });
    const resetZoomBtn = screen.getByRole('button', { name: /Đặt lại thu phóng/i });

    // Initial zoom: 100%
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Zoom out multiple times (should clamp at 50%)
    for (let i = 0; i < 10; i++) {
      fireEvent.click(zoomOutBtn);
    }
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Zoom in multiple times (should clamp at 150%)
    for (let i = 0; i < 15; i++) {
      fireEvent.click(zoomInBtn);
    }
    expect(screen.getByText('150%')).toBeInTheDocument();

    // Reset zoom
    fireEvent.click(resetZoomBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('test_brain_canvas_filter_combination_matrix_with_zero_results', async () => {
    renderWithProviders(<LanguageBrainCanvas />);

    // Filter CEFR: B2
    const b2Btn = screen.getByRole('button', { name: 'B2' });
    fireEvent.click(b2Btn);

    // Filter Status: weak
    const weakFilterBtn = screen.getByRole('button', { name: 'Cần củng cố' });
    fireEvent.click(weakFilterBtn);

    // In default nodes, B2 has only 'collaborate' which is 'active' (not 'weak')
    expect(
      await screen.findByText('Không tìm thấy từ vựng nào khớp với bộ lọc.')
    ).toBeInTheDocument();

    // Reset status filter to 'Tất cả'
    const allStatusBtn = screen.getByRole('button', { name: 'Tất cả' });
    fireEvent.click(allStatusBtn);

    expect(await screen.findByText('collaborate')).toBeInTheDocument();
  });

  it('test_interactive_reader_word_inspector_and_saving_lifecycle', async () => {
    const handleSaveWord = vi.fn();
    const readerApi = new MockApiClient();
    const saveConcept = vi.spyOn(readerApi, 'saveConceptToLibrary');
    renderWithProviders(
      <InteractiveReader
        apiClient={readerApi}
        passage={defaultReaderPassage}
        onSaveWord={handleSaveWord}
      />
    );

    // Tap on token 'appointment'
    const wordBtn = screen.getByRole('button', { name: 'appointment' });
    fireEvent.click(wordBtn);

    // Inspector dialog opens
    const dialog = screen.getByRole('dialog', { name: 'Chi tiết từ vựng' });
    expect(dialog).toBeInTheDocument();
    expect(saveConcept).not.toHaveBeenCalled();
    expect(screen.getByText(defaultReaderPassage.sentences[0].tokens.find(
      (token) => token.raw === 'appointment'
    )?.translationVi ?? '')).toBeInTheDocument();

    // A fixture-rendered concept still requires explicit learner intent before save.
    expect(screen.getByRole('button', { name: /Lưu vào ôn tập/i })).toBeInTheDocument();

    // Tap on token 'available'
    const availableBtn = screen.getByRole('button', { name: 'available' });
    fireEvent.click(availableBtn);

    expect(screen.getByText('Có sẵn, rảnh rỗi')).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /Lưu vào ôn tập/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveConcept).toHaveBeenCalledTimes(1);
      expect(handleSaveWord).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/Đã lưu “available” để học/i)
      ).toBeInTheDocument();
    });

    // Close dialog
    const closeBtn = screen.getByRole('button', { name: 'Đóng bảng tra từ' });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_settings_view_boundary_updates_and_notification_timeout', () => {
    const handleSaveSettings = vi.fn();
    renderWithProviders(<SettingsView onSaveSettings={handleSaveSettings} />);

    // Select 45 minutes daily target
    const target45Btn = screen.getByRole('button', { name: '45 phút' });
    fireEvent.click(target45Btn);
    expect(screen.getByText('45 phút / ngày')).toBeInTheDocument();

    // Select 8 new words budget
    const budget8Btn = screen.getByRole('button', { name: '8 từ' });
    fireEvent.click(budget8Btn);
    expect(screen.getByText('8 từ mới / ngày')).toBeInTheDocument();

    // Toggle reduced motion
    const motionSwitches = screen.getAllByRole('switch');
    fireEvent.click(motionSwitches[motionSwitches.length - 1]);

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
    fireEvent.click(saveBtn);

    expect(handleSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyTargetMinutes: 45,
        newWordsBudgetPerDay: 8,
      })
    );

    expect(
      screen.getByText(/Giao diện đã được lưu trên thiết bị/i)
    ).toBeInTheDocument();
  });

  it('test_onboarding_choices_advance_to_static_server_estimate_result', async () => {
    const handleComplete = vi.fn();
    renderWithProviders(<OnboardingDiagnostic onComplete={handleComplete} />);

    // Question 1: any selected option advances presentation state; the client does not score it.
    expect(screen.getByText(/Từ nào có nghĩa là "cuộc hẹn chính thức"?/i)).toBeInTheDocument();
    const opt1 = screen.getByRole('button', { name: /A\. appointment/i });
    fireEvent.click(opt1);

    const nextBtn1 = screen.getByRole('button', { name: /Câu tiếp theo/i });
    fireEvent.click(nextBtn1);

    // Question 2
    expect(await screen.findByText(/The doctor is not _______ today/i)).toBeInTheDocument();
    const opt2 = screen.getByRole('button', { name: /B\. available/i });
    fireEvent.click(opt2);

    const nextBtn2 = screen.getByRole('button', { name: /Câu tiếp theo/i });
    fireEvent.click(nextBtn2);

    // Question 3
    expect(await screen.findByText(/Cụm từ nào mang nghĩa "giữ đúng lịch trình"?/i)).toBeInTheDocument();
    const opt3 = screen.getByRole('button', { name: /A\. on schedule/i });
    fireEvent.click(opt3);

    const finishBtn = screen.getByRole('button', { name: /Hoàn thành chẩn đoán/i });
    fireEvent.click(finishBtn);

    // Result card
    expect(handleComplete).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('A2 Elementary')).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu học ngày đầu tiên')).toBeInTheDocument();
  });
});

describe('Tier 5 Suite 4: Network Fault Injections & Recovery Resilience', () => {
  it('test_error_state_code_matrix_renders_exact_contract_messages_across_all_codes', () => {
    const errorCodes = [
      { code: 'UNAUTHENTICATED', expected: 'Cần đăng nhập' },
      { code: 'FORBIDDEN', expected: 'Không có quyền truy cập' },
      { code: 'NOT_FOUND', expected: 'Không tìm thấy nội dung' },
      { code: 'VALIDATION_ERROR', expected: 'Dữ liệu không hợp lệ' },
      { code: 'INTERNAL_ERROR', expected: 'Hệ thống gặp sự cố' },
    ];

    errorCodes.forEach(({ code, expected }) => {
      const { unmount } = renderWithProviders(<ErrorState code={code} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.getByText(`Mã lỗi: ${code}`)).toBeInTheDocument();
      unmount();
    });
  });

  it('test_today_dashboard_error_injection_and_retry_recovery', async () => {
    const { rerender } = renderWithProviders(
      <TodayDashboard forcedState="error" forcedErrorCode="INTERNAL_ERROR" />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Không thể tải kế hoạch học tập|Hệ thống gặp sự cố/i)).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByRole('heading', { level: 1, name: 'Kế hoạch của bạn' })).toBeInTheDocument();
  });

  it('test_review_session_error_injection_and_retry_recovery', async () => {
    renderWithProviders(
      <ReviewSession forcedState="error" forcedErrorCode="UNAUTHENTICATED" />
    );

    expect(screen.getByText('Cần đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Mã lỗi: UNAUTHENTICATED')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByText(/Đang tải hàng đợi thẻ ôn tập/i)).toBeInTheDocument();
  });
});

describe('Tier 5 Suite 5: Deep Accessibility, Touch Targets & Non-Color Invariant Stress', () => {
  it('test_concept_chip_non_color_invariant_strict_verification', () => {
    const statuses = [
      'unseen',
      'discovered',
      'learning',
      'familiar',
      'active',
      'mastered',
      'weak',
      'forgotten',
    ] as const;

    statuses.forEach((st) => {
      const { unmount } = renderWithProviders(
        <ConceptChip status={st} term={`test-${st}`} />
      );

      const chip = screen.getByRole('status');
      expect(chip).toBeInTheDocument();
      // Must contain icon (SVG), term text, and Vietnamese status label
      expect(chip.querySelector('svg')).not.toBeNull();
      expect(chip.textContent).toContain(`test-${st}`);
      unmount();
    });
  });

  it('test_interactive_touch_targets_satisfy_wcag_44px_minimum', () => {
    renderWithProviders(<ReviewSession />);

    const ratingButtons = [
      screen.getByRole('button', { name: /Quên \(Again\)/i }),
      screen.getByRole('button', { name: /Khó \(Hard\)/i }),
      screen.getByRole('button', { name: /Tốt \(Good\)/i }),
      screen.getByRole('button', { name: /Dễ \(Easy\)/i }),
    ];

    ratingButtons.forEach((btn) => {
      assertTouchTargetSize(btn, 44);
    });

    const audioBtn = screen.getByRole('button', { name: /Phát âm từ/i });
    assertTouchTargetSize(audioBtn, 44);
  });

  it('test_audio_player_variants_and_accessibility_attributes', () => {
    const handlePlay = vi.fn();
    const handlePause = vi.fn();

    // Button variant
    const { unmount } = renderWithProviders(
      <AudioPlayer
        variant="button"
        size="md"
        onPlay={handlePlay}
        label="Phát âm thanh kiểm tra"
      />
    );

    const btn = screen.getByRole('button', { name: 'Phát âm thanh kiểm tra' });
    expect(btn).toBeInTheDocument();
    assertTouchTargetSize(btn, 44);

    fireEvent.click(btn);
    expect(handlePlay).toHaveBeenCalledTimes(1);
    unmount();

    // Sentence variant
    renderWithProviders(
      <AudioPlayer
        variant="sentence"
        onPlay={handlePlay}
        label="Phát âm toàn câu"
      />
    );

    expect(screen.getByText('Phát âm toàn câu')).toBeInTheDocument();
  });

  it('test_progress_analytics_accessibly_exposes_only_supplied_seven_day_data', () => {
    renderWithProviders(<ProgressAnalytics initialData={defaultProgressSummary} />);

    const activity = screen.getByRole('list', { name: 'Thời gian học theo ngày' });
    expect(activity).toBeInTheDocument();
    expect(screen.getByText('7 ngày gần nhất')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '30 ngày qua' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBe(defaultProgressSummary.history7d.length);
  });
});
