import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import type { BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';

describe('Wave 11 Enterprise Language Platform Upgrades Test Suite', () => {
  let speakSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;
  let clipboardSpy: ReturnType<typeof vi.fn>;

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
    speakSpy = vi.fn();
    cancelSpy = vi.fn();
    clipboardSpy = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        speak: speakSpy,
        cancel: cancelSpy,
      },
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      writable: true,
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });

    window.localStorage.clear();
  });

  describe('1. Item #1: InteractiveReader Estimated Reading Time Pill', () => {
    it('renders estimated reading time pill calculated from passage sentences', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w11-time',
        title: 'Morning Routine',
        level: 'A1',
        wordCount: 10,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I drink tea. Coffee is nice too.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I drink tea.',
                translationVi: 'Tôi uống trà.',
                tokens: [
                  { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'drink', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'tea', isTarget: true, conceptId: 'c-tea', status: 'mastered', sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
              {
                id: 'sent-2',
                order: 1,
                text: 'Coffee is nice too.',
                translationVi: 'Cà phê cũng ngon.',
                tokens: [
                  { raw: 'Coffee', isTarget: true, conceptId: 'c-coffee', status: 'learning', sentenceId: 'sent-2', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I drink tea.',
            translationVi: 'Tôi uống trà.',
            tokens: [
              { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'drink', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'tea', isTarget: true, conceptId: 'c-tea', status: 'mastered', sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
          {
            id: 'sent-2',
            order: 1,
            text: 'Coffee is nice too.',
            translationVi: 'Cà phê cũng ngon.',
            tokens: [
              { raw: 'Coffee', isTarget: true, conceptId: 'c-coffee', status: 'learning', sentenceId: 'sent-2', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const estimatedTimePill = screen.getByTestId('reader-estimated-time');
      expect(estimatedTimePill).toBeInTheDocument();
      expect(estimatedTimePill).toHaveAttribute('aria-label', 'Thời gian đọc ước tính');
      expect(estimatedTimePill).toHaveTextContent(/⏱️ ~1 phút đọc/);
    });
  });

  describe('2. Item #2: InteractiveReader Grammar Tips Visibility Switch', () => {
    it('renders grammar tips visibility switch and toggles tips display', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w11-grammar',
        title: 'Grammar Study',
        level: 'A2',
        wordCount: 6,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-g1',
            order: 0,
            segmentType: 'paragraph',
            text: 'She has arrived at the station.',
            sentences: [
              {
                id: 'sent-g1',
                order: 0,
                text: 'She has arrived at the station.',
                translationVi: 'Cô ấy đã đến ga.',
                tokens: [
                  { raw: 'She', isTarget: false, sentenceId: 'sent-g1', segmentId: 'seg-g1' },
                  { raw: 'has', isTarget: true, conceptId: 'c-has', status: 'learning', sentenceId: 'sent-g1', segmentId: 'seg-g1' },
                  { raw: 'arrived', isTarget: true, conceptId: 'c-arrived', status: 'learning', sentenceId: 'sent-g1', segmentId: 'seg-g1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-g1',
            order: 0,
            text: 'She has arrived at the station.',
            translationVi: 'Cô ấy đã đến ga.',
            tokens: [
              { raw: 'She', isTarget: false, sentenceId: 'sent-g1', segmentId: 'seg-g1' },
              { raw: 'has', isTarget: true, conceptId: 'c-has', status: 'learning', sentenceId: 'sent-g1', segmentId: 'seg-g1' },
              { raw: 'arrived', isTarget: true, conceptId: 'c-arrived', status: 'learning', sentenceId: 'sent-g1', segmentId: 'seg-g1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const toggleBtn = screen.getByTestId('reader-grammar-tips-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
      expect(toggleBtn).toHaveTextContent('💡 Ngữ pháp: Hiện');

      // Toggle off
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
      expect(toggleBtn).toHaveTextContent('💡 Ngữ pháp: Ẩn');

      // Toggle back on
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
      expect(toggleBtn).toHaveTextContent('💡 Ngữ pháp: Hiện');
    });
  });

  describe('3. Item #3: ReviewSession Keyboard Shortcuts Quick Reference Pill', () => {
    it('renders keyboard shortcuts quick reference guide pill in ReviewSession header', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-w11',
          term: 'perseverance',
          targetForm: 'perseverance',
          meaningVi: 'sự kiên trì',
          posVi: 'Danh từ',
          cefrLevel: 'B2',
          status: 'learning',
          dueTime: '2026-10-28T00:00:00Z',
          isDue: true,
          scheduledDays: 1,
          elapsedDays: 0,
          reps: 1,
          lapses: 0,
          exerciseMode: 'self_recall',
        },
      ];

      render(<ReviewSession initialQueue={mockQueue} />);

      const shortcutsPill = screen.getByTestId('review-shortcuts-help');
      expect(shortcutsPill).toBeInTheDocument();
      expect(shortcutsPill).toHaveAttribute('aria-label', 'Hướng dẫn phím tắt bàn phím');
      expect(shortcutsPill).toHaveTextContent(/⌨️ Phím tắt: Space \(Lật\) · 1–4 \(Chấm\)/);
    });
  });

  describe('4. Item #4: Language Brain Due Review Counter Badge', () => {
    it('renders due for review count badge calculated from nodes needing review', () => {
      const mockNodes: BrainNodeItem[] = [
        {
          id: 'n-weak',
          term: 'diligent',
          meaningVi: 'chăm chỉ',
          cefr: 'B1',
          status: 'weak',
          encounterCount: 4,
          recallScore: 0.3,
          relatedIds: [],
        },
        {
          id: 'n-forgotten',
          term: 'persevere',
          meaningVi: 'kiên trì',
          cefr: 'B2',
          status: 'forgotten',
          encounterCount: 2,
          recallScore: 0.1,
          relatedIds: [],
        },
        {
          id: 'n-mastered',
          term: 'tea',
          meaningVi: 'trà',
          cefr: 'A1',
          status: 'mastered',
          encounterCount: 10,
          recallScore: 0.95,
          relatedIds: [],
        },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      const dueBadge = screen.getByTestId('brain-due-count-badge');
      expect(dueBadge).toBeInTheDocument();
      expect(dueBadge).toHaveAttribute('aria-label', 'Số lượng khái niệm cần ôn tập ngay');
      expect(dueBadge).toHaveTextContent('🔔 Cần ôn ngay: 2 khái niệm');
    });
  });

  describe('5. Item #5: Dictionary Word Complexity Tag', () => {
    it('renders complexity tag indicating morphological difficulty for dictionary concepts', () => {
      render(<DictionaryView />);

      const complexityTags = screen.getAllByTestId('dictionary-complexity-tag');
      expect(complexityTags.length).toBeGreaterThan(0);

      const firstTag = complexityTags[0];
      expect(firstTag).toBeInTheDocument();
      expect(firstTag).toHaveAttribute('aria-label', 'Độ phức tạp cấu tạo từ');
      expect(
        firstTag.textContent === 'Ngắn · Dễ nhớ' ||
          firstTag.textContent === 'Độ dài vừa' ||
          firstTag.textContent === 'Đa âm tiết'
      ).toBe(true);
    });
  });

  describe('6. Item #6: Library Density Toggle', () => {
    it('renders density toggle and toggles data-density between comfortable and compact', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'c1',
          itemType: 'concept',
          canonicalForm: 'tea',
          meaningVi: 'trà',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const densityToggle = screen.getByTestId('library-density-toggle');
      expect(densityToggle).toBeInTheDocument();
      expect(densityToggle).toHaveAttribute('data-density', 'comfortable');
      expect(densityToggle).toHaveTextContent('📐 Hiển thị: Thoáng');

      const listContainer = screen.getByRole('list');
      expect(listContainer).toHaveAttribute('data-view-density', 'comfortable');

      // Click to toggle to compact
      fireEvent.click(densityToggle);
      expect(densityToggle).toHaveAttribute('data-density', 'compact');
      expect(densityToggle).toHaveTextContent('📐 Hiển thị: Thu gọn');
      expect(listContainer).toHaveAttribute('data-view-density', 'compact');

      // Click again to toggle back to comfortable
      fireEvent.click(densityToggle);
      expect(densityToggle).toHaveAttribute('data-density', 'comfortable');
      expect(densityToggle).toHaveTextContent('📐 Hiển thị: Thoáng');
      expect(listContainer).toHaveAttribute('data-view-density', 'comfortable');
    });
  });

  describe('7. Item #7: Today Goal Completion Percentage Badge', () => {
    it('renders goal completion percentage badge in TodayDashboard goal card', () => {
      render(<TodayDashboard forcedState="success" />);

      const percentBadge = screen.getByTestId('today-completion-percent-badge');
      expect(percentBadge).toBeInTheDocument();
      expect(percentBadge).toHaveAttribute('aria-label', 'Phần trăm hoàn thành mục tiêu ngày');
      expect(percentBadge).toHaveTextContent(/📊 Hoàn thành \d+% mục tiêu ngày/);
    });
  });

  describe('8. Item #8: ProgressAnalytics Average Session Cadence Insight', () => {
    it('renders average session cadence insight badge in ProgressAnalytics', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            activeDaysCount: 4,
            weeklyTargetDays: 7,
            totalStudyMinutes: 120,
            newWordsAcquired: 15,
            history7d: [
              { dayLabel: 'T2', minutesSpent: 20, wordsLearned: 3, retentionPercent: 90 },
              { dayLabel: 'T3', minutesSpent: 40, wordsLearned: 4, retentionPercent: 88 },
              { dayLabel: 'T4', minutesSpent: 30, wordsLearned: 5, retentionPercent: 92 },
              { dayLabel: 'T5', minutesSpent: 30, wordsLearned: 3, retentionPercent: 89 },
            ],
            retentionScore: 90,
            wordsSolidified: 25,
          }}
        />
      );

      const cadenceInsight = screen.getByTestId('progress-cadence-insight');
      expect(cadenceInsight).toBeInTheDocument();
      expect(cadenceInsight).toHaveAttribute('aria-label', 'Thời lượng trung bình mỗi buổi có học');
      expect(cadenceInsight).toHaveTextContent('⚡ TB buổi học: 30 phút/buổi');
    });
  });

  describe('9. Item #9: Profile Next Achievement Progress Hint', () => {
    it('renders next achievement progress hint inside profile achievements grid', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Taylor Swift',
            email: 'taylor@lingua.app',
            startingLevelEstimate: 'B2',
            totalConceptsEncountered: 55,
            totalConceptsMastered: 12,
            streakDays: 4,
          }}
        />
      );

      const hint = screen.getByTestId('profile-next-achievement-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveAttribute('aria-label', 'Tiến độ mở khóa huy hiệu học tập');
      // With 55 encountered, 12 mastered, streak 4: all 4 achievements are unlocked!
      expect(hint).toHaveTextContent('🏅 Đã mở khóa 4/4 huy hiệu');
    });

    it('accurately counts partial unlocked achievements', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Beginner Learner',
            email: 'newbie@lingua.app',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 5, // < 10
            totalConceptsMastered: 0,    // < 10
            streakDays: 1,               // < 3
          }}
        />
      );

      const hint = screen.getByTestId('profile-next-achievement-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('🏅 Đã mở khóa 0/4 huy hiệu');
    });
  });

  describe('10. Item #10: Settings Daily Review Session Cap Selector & Persistence', () => {
    it('renders review cap selector, switches cap, and conditionally persists to localStorage only when non-default', () => {
      const onSave = vi.fn();
      render(<SettingsView onSaveSettings={onSave} />);

      const capSelector = screen.getByTestId('settings-review-cap-selector');
      expect(capSelector).toBeInTheDocument();
      expect(capSelector).toHaveAttribute('aria-label', 'Giới hạn số thẻ ôn tập tối đa mỗi ngày');

      const cap20Btn = screen.getByTestId('settings-review-cap-20');
      const cap50Btn = screen.getByTestId('settings-review-cap-50');
      const cap100Btn = screen.getByTestId('settings-review-cap-100');

      expect(cap20Btn).toHaveAttribute('aria-pressed', 'false');
      expect(cap50Btn).toHaveAttribute('aria-pressed', 'true'); // default 50
      expect(cap100Btn).toHaveAttribute('aria-pressed', 'false');

      // Click 100 cards/day
      fireEvent.click(cap100Btn);
      expect(cap100Btn).toHaveAttribute('aria-pressed', 'true');
      expect(cap50Btn).toHaveAttribute('aria-pressed', 'false');

      // Click Save settings
      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveBtn);

      const storedJson = window.localStorage.getItem('lingua-user-settings-v1');
      expect(storedJson).toBeTruthy();
      const parsed = JSON.parse(storedJson!);
      expect(parsed.dailyReviewCap).toBe(100);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyReviewCap: 100,
        })
      );
    });

    it('does NOT write dailyReviewCap to localStorage when default 50 is kept', () => {
      render(<SettingsView />);

      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveBtn);

      const storedJson = window.localStorage.getItem('lingua-user-settings-v1');
      expect(storedJson).toBeTruthy();
      const parsed = JSON.parse(storedJson!);
      expect(parsed).not.toHaveProperty('dailyReviewCap');
    });
  });
});
