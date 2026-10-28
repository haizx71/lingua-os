import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReaderPassageViewModel } from '@lingua/types';
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

describe('Wave 13 Enterprise Language Platform Upgrades Test Suite', () => {
  let speakSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;
  let clipboardSpy: ReturnType<typeof vi.fn>;
  let navEvents: Array<{ path: string }> = [];

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
    navEvents = [];

    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      if (customEvent.detail) {
        navEvents.push(customEvent.detail);
      }
    };
    window.addEventListener('lingua:navigate', handleNav);

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

    return () => {
      window.removeEventListener('lingua:navigate', handleNav);
    };
  });

  describe('1. Item #1: InteractiveReader 1-Click Copy Sentence & Translation Button', () => {
    it('renders copy sentence button, copies sentence with translation to clipboard, and shows feedback', async () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w13-copy-sentence',
        title: 'Morning Walk',
        level: 'A1',
        wordCount: 4,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I wake up early.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I wake up early.',
                translationVi: 'Tôi thức dậy sớm.',
                tokens: [
                  { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'wake ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'up ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'early.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I wake up early.',
            translationVi: 'Tôi thức dậy sớm.',
            tokens: [
              { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'wake ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'up ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'early.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const copyBtn = screen.getByTestId('reader-copy-sentence');
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveTextContent('📋 Chép câu');

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(clipboardSpy).toHaveBeenCalledWith('I wake up early. — Tôi thức dậy sớm.');
      await vi.waitFor(() => {
        expect(copyBtn).toHaveTextContent('Đã chép câu');
      });
    });
  });

  describe('2. Item #2: InteractiveReader Word Inspector Quick Jump to Dictionary', () => {
    it('renders open dictionary link in Word Inspector and navigates to /dictionary', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w13-dict-jump',
        title: 'Vocabulary Reading',
        level: 'A1',
        wordCount: 4,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I drink morning tea.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I drink morning tea.',
                translationVi: 'Tôi uống trà sáng.',
                tokens: [
                  { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'drink', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'tea', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I drink morning tea.',
            translationVi: 'Tôi uống trà sáng.',
            tokens: [
              { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'drink', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'tea', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const tokenBtn = screen.getByRole('button', { name: /morning/i });
      fireEvent.click(tokenBtn);

      const dictLink = screen.getByTestId('inspector-open-dictionary-link');
      expect(dictLink).toBeInTheDocument();
      expect(dictLink).toHaveAttribute('aria-label', 'Mở từ này trong Từ điển để xem chi tiết');
      expect(dictLink).toHaveTextContent('🔎 Mở Từ điển');

      fireEvent.click(dictLink);
      expect(navEvents).toContainEqual({ path: '/dictionary' });
    });
  });

  describe('3. Item #3: ReviewSession Remaining Queue Encouragement Pill', () => {
    it('renders remaining queue encouragement pill with correct remaining card count', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-1',
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
        {
          id: 'card-2',
          term: 'resilience',
          targetForm: 'resilience',
          meaningVi: 'khả năng phục hồi',
          posVi: 'Danh từ',
          cefrLevel: 'C1',
          status: 'learning',
          dueTime: '2026-10-28T00:00:00Z',
          isDue: true,
          scheduledDays: 2,
          elapsedDays: 1,
          reps: 2,
          lapses: 0,
          exerciseMode: 'self_recall',
        },
      ];

      render(<ReviewSession initialQueue={mockQueue} />);

      const encouragementPill = screen.getByTestId('review-remaining-encouragement');
      expect(encouragementPill).toBeInTheDocument();
      expect(encouragementPill).toHaveAttribute('aria-label', 'Số thẻ còn lại trong phiên ôn tập');
      expect(encouragementPill).toHaveTextContent('💪 Còn 2 thẻ trong phiên');
    });
  });

  describe('4. Item #4: LanguageBrainCanvas 1-Click Filter & Search Reset Button', () => {
    it('shows reset button when search or filter is active, and clicking resets all filters', () => {
      const mockNodes: BrainNodeItem[] = [
        {
          id: 'b-node-1',
          term: 'diligent',
          meaningVi: 'chăm chỉ',
          cefr: 'B1',
          status: 'mastered',
          encounterCount: 6,
          recallScore: 0.92,
          relatedIds: [],
        },
        {
          id: 'b-node-2',
          term: 'early',
          meaningVi: 'sớm',
          cefr: 'A1',
          status: 'learning',
          encounterCount: 3,
          recallScore: 0.5,
          relatedIds: [],
        },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      // Initially no reset button
      expect(screen.queryByTestId('brain-reset-filters')).not.toBeInTheDocument();

      // Enter search query
      const searchInput = screen.getByPlaceholderText(/Tìm nhanh từ vựng trong Brain/i);
      fireEvent.change(searchInput, { target: { value: 'early' } });

      // Reset button appears
      const resetBtn = screen.getByTestId('brain-reset-filters');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveTextContent('Đặt lại bộ lọc mạng lưới');

      // Click reset button
      fireEvent.click(resetBtn);

      // Search input is cleared and reset button disappears
      expect(searchInput).toHaveValue('');
      expect(screen.queryByTestId('brain-reset-filters')).not.toBeInTheDocument();
    });
  });

  describe('5. Item #5: DictionaryView Saved Concepts Counter Badge', () => {
    it('renders saved concepts counter in header with total count', () => {
      render(<DictionaryView />);

      const counter = screen.getByTestId('dictionary-saved-counter');
      expect(counter).toBeInTheDocument();
      expect(counter).toHaveAttribute('aria-label', 'Tổng số khái niệm đã lưu vào kho cá nhân');
      expect(counter).toHaveTextContent(/⭐ Đã lưu \d+ khái niệm/);
    });
  });

  describe('6. Item #6: LibraryView Quick Jump to Smart Review', () => {
    it('renders start review link in header and triggers navigation to /review', () => {
      render(<LibraryView />);

      const reviewLink = screen.getByTestId('library-start-review-link');
      expect(reviewLink).toBeInTheDocument();
      expect(reviewLink).toHaveAttribute('aria-label', 'Bắt đầu ôn tập thông minh các từ đã lưu');
      expect(reviewLink).toHaveTextContent('⚡ Ôn tập từ đã lưu');

      fireEvent.click(reviewLink);
      expect(navEvents).toContainEqual({ path: '/review' });
    });
  });

  describe('7. Item #7: TodayDashboard Daily Consistency Tip Callout', () => {
    it('renders daily consistency tip in goal card aside', () => {
      render(<TodayDashboard forcedState="success" />);

      const tip = screen.getByTestId('today-consistency-tip');
      expect(tip).toBeInTheDocument();
      expect(tip).toHaveAttribute('aria-label', 'Mẹo duy trì thói quen học tập');
      expect(tip).toHaveTextContent('💡 Mẹo duy trì: Học đều 15 phút mỗi ngày hiệu quả gấp 3 lần học dồn cuối tuần.');
    });
  });

  describe('8. Item #8: ProgressAnalytics 1-Click Copy Progress Report Summary', () => {
    it('renders copy report button, writes progress summary to clipboard, and displays feedback', async () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 6,
            activeDaysCount: 5,
            weeklyTargetDays: 7,
            totalStudyMinutes: 180,
            newWordsAcquired: 25,
            history7d: [
              { dayLabel: 'T2', minutesSpent: 30, wordsLearned: 5, retentionPercent: 92 },
              { dayLabel: 'T3', minutesSpent: 35, wordsLearned: 5, retentionPercent: 94 },
              { dayLabel: 'T4', minutesSpent: 40, wordsLearned: 5, retentionPercent: 90 },
              { dayLabel: 'T5', minutesSpent: 35, wordsLearned: 5, retentionPercent: 95 },
              { dayLabel: 'T6', minutesSpent: 40, wordsLearned: 5, retentionPercent: 93 },
            ],
            retentionScore: 93,
            wordsSolidified: 50,
          }}
        />
      );

      const copyBtn = screen.getByTestId('progress-copy-report');
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveTextContent('📋 Sao chép báo cáo tiến độ');

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(clipboardSpy).toHaveBeenCalled();
      const callArgs = clipboardSpy.mock.calls[0][0];
      expect(callArgs).toContain('LINGUA OS Tiến độ');
      expect(callArgs).toContain('Đã củng cố: 50 từ');
      await vi.waitFor(() => {
        expect(copyBtn).toHaveTextContent('Đã sao chép báo cáo');
      });
    });
  });

  describe('9. Item #9: ProfileView Active Learner Account Status Badge', () => {
    it('renders active account status badge in learner profile header card', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Alex Johnson',
            email: 'alex@lingua.app',
            startingLevelEstimate: 'B1',
            totalConceptsEncountered: 40,
            totalConceptsMastered: 24,
            streakDays: 7,
          }}
        />
      );

      const badge = screen.getByTestId('profile-account-status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'Trạng thái duy trì tài khoản học tập');
      expect(badge).toHaveTextContent('🟢 Trạng thái: Đang hoạt động tích cực');
    });
  });

  describe('10. Item #10: SettingsView Reset Local Preferences to Default Button', () => {
    it('renders reset defaults button and resets customized preferences back to default values', () => {
      render(
        <SettingsView
          initialSettings={{
            defaultSpeechRate: 0.75,
            preferredAccent: 'en-GB',
            dailyReviewCap: 100,
            reducedMotion: true,
            audioAutoplay: false,
            preferredReminderTime: '20:00',
          }}
        />
      );

      // Verify custom values are active
      expect(screen.getByTestId('settings-accent-en-GB')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('settings-review-cap-100')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('settings-reminder-20:00')).toHaveAttribute('aria-pressed', 'true');

      const resetBtn = screen.getByTestId('settings-reset-defaults');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveAttribute('aria-label', 'Khôi phục tùy chọn thiết bị về mặc định');
      expect(resetBtn).toHaveTextContent('Khôi phục mặc định');

      // Click reset defaults
      fireEvent.click(resetBtn);

      // Verify preferences reverted to defaults
      expect(screen.getByTestId('settings-accent-en-US')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('settings-accent-en-GB')).toHaveAttribute('aria-pressed', 'false');

      expect(screen.getByTestId('settings-review-cap-50')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('settings-review-cap-100')).toHaveAttribute('aria-pressed', 'false');

      expect(screen.getByTestId('settings-reminder-off')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('settings-reminder-20:00')).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
