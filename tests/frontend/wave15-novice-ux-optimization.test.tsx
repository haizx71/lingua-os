import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import type { BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 15 Zero-English Novice UX Optimization Test Suite', () => {
  class MockSpeechSynthesisUtterance {
    text: string;
    lang = 'en-US';
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      writable: true,
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    window.localStorage.clear();
  });

  describe('1. Item #1: InteractiveReader Shadowing Label & Full-Width Beginner Hint', () => {
    it('renders respectful shadowing label and dedicated full-width beginner toolbar hint', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w15-novice',
        title: 'Making an Appointment',
        level: 'A1',
        wordCount: 8,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I have an appointment with the doctor.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I have an appointment with the doctor.',
                translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
                tokens: [
                  { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'have ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'an ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'appointment ', isTarget: true, term: 'appointment', sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'with ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'the ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'doctor.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I have an appointment with the doctor.',
            translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      // Shadowing button has polite Vietnamese label
      const shadowBtn = screen.getByTestId('reader-shadowing-button');
      expect(shadowBtn).toBeInTheDocument();
      expect(shadowBtn).toHaveTextContent('🗣️ Đọc theo mẫu (Shadowing)');
      expect(shadowBtn).toHaveAttribute('aria-label', 'Nhại lại câu 1');

      // Beginner toolbar hint spans full width
      const hint = screen.getByTestId('reader-beginner-toolbar-hint');
      expect(hint).toBeInTheDocument();
      expect(hint.className).toContain('w-full');
      expect(hint.className).toContain('basis-full');
      expect(hint).toHaveTextContent(/💡 Mẹo cho người mới: Chạm vào bất kỳ từ tiếng Anh nào/);
    });
  });

  describe('2. Item #2: InteractiveReader Word Inspector Replaces "Brain" with "Kho từ nhớ" & Groups Tips', () => {
    it('groups extended tips in container and refers to storage as Kho từ nhớ', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w15-inspector',
        title: 'Making an Appointment',
        level: 'A1',
        wordCount: 8,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I have an appointment with the doctor.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I have an appointment with the doctor.',
                translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
                tokens: [
                  { raw: 'appointment', isTarget: true, term: 'appointment', conceptId: 'c-app-1', sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I have an appointment with the doctor.',
            translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const wordButton = screen.getByRole('button', { name: 'appointment' });
      fireEvent.click(wordButton);

      // Extended tips box is grouped cleanly
      const tipsBox = screen.getByTestId('inspector-extended-tips-box');
      expect(tipsBox).toBeInTheDocument();
      expect(tipsBox).toHaveTextContent('📚 Mở rộng vốn từ & Ngữ cảnh:');

      // Contains family and contrast inside the grouped tips container
      expect(within(tipsBox).getByTestId('inspector-word-family')).toBeInTheDocument();
      expect(within(tipsBox).getByTestId('inspector-semantic-contrast')).toBeInTheDocument();

      // "Brain" jargon replaced with "Kho từ nhớ"
      expect(screen.queryByText(/lưu vào Brain/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Item #3: ReviewSession 2-Row Header (HUD vs Action Controls)', () => {
    it('organizes header into review-hud-summary-row and review-controls-row', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-1',
          term: 'coffee',
          meaningVi: 'cà phê',
          ipa: '/ˈkɒf.i/',
          partOfSpeech: 'noun',
          exampleSentence: 'I drink coffee in the morning.',
          exampleTranslation: 'Tôi uống cà phê vào buổi sáng.',
          currentIntervalDays: 1,
          stability: 2.1,
          difficulty: 4.8,
          reps: 2,
          lapses: 0,
        },
      ];

      render(<ReviewSession initialQueue={mockQueue} />);

      const hudRow = screen.getByTestId('review-hud-summary-row');
      expect(hudRow).toBeInTheDocument();
      expect(within(hudRow).getByTestId('review-remaining-encouragement')).toBeInTheDocument();
      expect(within(hudRow).getByTestId('review-shortcuts-help')).toBeInTheDocument();
      expect(within(hudRow).getByTestId('review-pace-indicator')).toBeInTheDocument();
      expect(within(hudRow).getByTestId('review-session-accuracy-badge')).toBeInTheDocument();

      const controlsRow = screen.getByTestId('review-controls-row');
      expect(controlsRow).toBeInTheDocument();
      expect(within(controlsRow).getByTestId('wave9-review-batch-size')).toBeInTheDocument();
      expect(within(controlsRow).getByTestId('review-audio-feedback-toggle')).toBeInTheDocument();
      expect(within(controlsRow).getByTestId('wave10-review-blind-listening-toggle')).toBeInTheDocument();
    });
  });

  describe('4. Item #4: TodayDashboard Action Button Guide & Duplicate Ratio Cleanup', () => {
    it('renders today-action-button-guide without duplicate visible text', () => {
      render(<TodayDashboard forcedState="success" />);

      const actionGuide = screen.getByTestId('today-action-button-guide');
      expect(actionGuide).toBeInTheDocument();
      expect(actionGuide).toHaveTextContent(/Bắt đầu.*để vào bài học.*Đánh dấu xong.*khi hoàn thành/);
    });
  });

  describe('5. Item #5: LanguageBrainCanvas Unified Filter Panel & Guide Header', () => {
    it('renders brain-unified-filter-panel with brain-filter-guide-label', () => {
      const mockNodes: BrainNodeItem[] = [
        {
          id: 'b-node-1',
          term: 'early',
          meaningVi: 'sớm',
          cefr: 'A1',
          status: 'mastered',
          encounterCount: 5,
          recallScore: 0.9,
          relatedIds: [],
        },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      const filterPanel = screen.getByTestId('brain-unified-filter-panel');
      expect(filterPanel).toBeInTheDocument();

      const guideLabel = screen.getByTestId('brain-filter-guide-label');
      expect(guideLabel).toBeInTheDocument();
      expect(guideLabel).toHaveTextContent(
        '🧭 Bộ lọc mạng lưới: Chọn cấp độ (A1–B2), mức độ thuộc từ hoặc chủ đề để thu gọn bản đồ'
      );
    });
  });

  describe('6. Item #6: DictionaryView Capabilities Caption Replaces Fake Pill Buttons', () => {
    it('renders dictionary-capabilities-caption as plain explanatory text', () => {
      render(<DictionaryView />);

      const caption = screen.getByTestId('dictionary-capabilities-caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveTextContent(/Nghĩa tiếng Việt • Phiên âm IPA & từ loại • Ví dụ ngữ cảnh/);
    });
  });

  describe('7. Item #7: LibraryView Selection Status Banner & Select All Interactivity', () => {
    it('renders library-selection-status and updates when items are selected', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'item-1',
          itemType: 'concept',
          canonicalForm: 'tea',
          meaningVi: 'trà',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
        {
          id: 'item-2',
          itemType: 'concept',
          canonicalForm: 'coffee',
          meaningVi: 'cà phê',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'learning',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const statusBanner = screen.getByTestId('library-selection-status');
      expect(statusBanner).toBeInTheDocument();
      expect(statusBanner).toHaveTextContent(/📌 Mẹo: Bạn có thể lọc theo trạng thái thuộc từ hoặc bấm "Sao chép danh sách"/);

      const selectAllBtn = screen.getByTestId('library-select-all');
      expect(selectAllBtn).toBeInTheDocument();

      fireEvent.click(selectAllBtn);
      expect(screen.getByTestId('library-selection-status')).toHaveTextContent(/📌 Đã chọn.*mục/);
    });
  });

  describe('8. Item #8: ProgressAnalytics Milestone Badges Row Without Margin-Left Misalignment', () => {
    it('wraps milestone badges inside progress-milestone-badges-row without ml-2 classes', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            wordsSolidified: 20,
          }}
        />
      );

      const badgesRow = screen.getByTestId('progress-milestone-badges-row');
      expect(badgesRow).toBeInTheDocument();

      const velocity = screen.getByTestId('progress-velocity-forecast');
      const retention = screen.getByTestId('progress-retention-status-badge');
      const solidified = screen.getByTestId('progress-solidified-ratio');

      expect(within(badgesRow).getByTestId('progress-velocity-forecast')).toBeInTheDocument();
      expect(within(badgesRow).getByTestId('progress-retention-status-badge')).toBeInTheDocument();
      expect(within(badgesRow).getByTestId('progress-solidified-ratio')).toBeInTheDocument();

      expect(velocity.className).not.toContain('ml-2');
      expect(retention.className).not.toContain('ml-2');
      expect(solidified.className).not.toContain('ml-2');
    });
  });

  describe('9. Item #9: ProfileView Confidence Translation & SettingsView FSRS Label', () => {
    it('translates medium confidence into plain Vietnamese in ProfileView', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Linh Nguyen',
            email: 'linh@example.test',
            startingLevelEstimate: 'A2',
            startingLevelConfidence: 'medium',
            totalConceptsEncountered: 15,
            totalConceptsMastered: 8,
            streakDays: 5,
          }}
        />
      );

      const badge = screen.getByTestId('profile-confidence-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Độ tin cậy ước lượng: Khá chuẩn');
      expect(badge).not.toHaveTextContent('medium');
    });

    it('translates high and low confidence appropriately in ProfileView', () => {
      const { rerender } = render(
        <ProfileView
          initialProfile={{
            name: 'Linh Nguyen',
            startingLevelConfidence: 'high',
          }}
        />
      );
      expect(screen.getByTestId('profile-confidence-badge')).toHaveTextContent('Độ tin cậy ước lượng: Cao');

      rerender(
        <ProfileView
          initialProfile={{
            name: 'Linh Nguyen',
            startingLevelConfidence: 'low',
          }}
        />
      );
      expect(screen.getByTestId('profile-confidence-badge')).toHaveTextContent('Độ tin cậy ước lượng: Cơ bản');
    });

    it('renders descriptive FSRS review cap heading in SettingsView', () => {
      render(<SettingsView />);

      const capSelector = screen.getByTestId('settings-review-cap-selector');
      expect(capSelector).toBeInTheDocument();
      expect(capSelector).toHaveTextContent(
        'Giới hạn thẻ ôn tập FSRS mỗi ngày (Nhịp nhắc thông minh vừa sức)'
      );
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Developer String Cleanup', () => {
    it('removes Today API, beginner-zero-to-one-bypass-v1, and PERSISTENCE_GAPS enum code from completion card', () => {
      render(<OnboardingDiagnostic />);

      // Click beginner bypass to jump to completion screen
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      // Clean summary meta container is present
      const cleanMeta = screen.getByTestId('onboarding-clean-summary-meta');
      expect(cleanMeta).toBeInTheDocument();

      // No internal developer jargon or raw enum strings in the document
      expect(screen.queryByText(/Today API/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/beginner-zero-to-one-bypass-v1/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/new-concept-budget-v1-gap/i)).not.toBeInTheDocument();

      // Clean Vietnamese descriptions
      expect(
        screen.getByText('Kế hoạch Hôm nay sẽ tự động cung cấp bài học phù hợp ngay khi bạn bắt đầu.')
      ).toBeInTheDocument();
      expect(screen.getAllByText('Lộ trình cơ bản cho người mất gốc').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('3–5 từ mới/ngày (vừa sức cho người mới)').length).toBeGreaterThanOrEqual(1);
    });
  });
});
