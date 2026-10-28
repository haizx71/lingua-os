import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { FALSE_FRIENDS_TRAPS, getFalseFriendTrap } from '../../apps/web/src/features/read/beginnerLexicon';
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

describe('Wave 9 Enterprise Language Platform Upgrades Test Suite', () => {
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

  describe('1. Item #1: InteractiveReader Reading Theme Toggle (Default / Sepia / Dark)', () => {
    it('cycles reading theme on click without persisting to localStorage on mount', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w9',
        title: 'Afternoon Tea',
        level: 'A1',
        wordCount: 3,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I drink tea.',
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
        ],
      };

      render(<InteractiveReader passage={passage} />);

      // Invariant READ-LIVE-08: no localStorage write on mount
      expect(window.localStorage.getItem('lingua-reader-theme')).toBeNull();

      const themeToggle = screen.getByTestId('wave9-reader-reading-theme-toggle');
      expect(themeToggle).toBeInTheDocument();
      expect(themeToggle).toHaveAttribute('aria-label', 'Chuyển chế độ nền đọc: Mặc định, Sepia ấm áp hoặc Đêm');

      const segment = screen.getByTestId('reader-segment');
      expect(segment).toHaveAttribute('data-reading-theme', 'default');

      // Click 1: Sepia
      fireEvent.click(themeToggle);
      expect(screen.getByTestId('reader-segment')).toHaveAttribute('data-reading-theme', 'sepia');

      // Click 2: Dark
      fireEvent.click(themeToggle);
      expect(screen.getByTestId('reader-segment')).toHaveAttribute('data-reading-theme', 'dark');

      // Click 3: Back to default
      fireEvent.click(themeToggle);
      expect(screen.getByTestId('reader-segment')).toHaveAttribute('data-reading-theme', 'default');
    });
  });

  describe('2. Item #2: False Friends & Pronunciation Traps in Beginner Lexicon', () => {
    it('provides false friends traps and renders warning callout in Word Inspector', () => {
      expect(FALSE_FRIENDS_TRAPS.actually).toBeDefined();
      expect(FALSE_FRIENDS_TRAPS.eventually).toBeDefined();
      expect(getFalseFriendTrap('actually')).toContain('thực ra / thực sự');
      expect(getFalseFriendTrap('tea')).toContain('đồng âm với chữ cái');

      const passage: ReaderPassageViewModel = {
        id: 'passage-traps',
        title: 'Traps Pilot',
        level: 'A2',
        wordCount: 2,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-trap',
            order: 0,
            segmentType: 'paragraph',
            text: 'Drink tea.',
            sentences: [
              {
                id: 'sent-trap',
                order: 0,
                text: 'Drink tea.',
                translationVi: 'Uống trà.',
                tokens: [
                  { raw: 'Drink', isTarget: false, sentenceId: 'sent-trap', segmentId: 'seg-trap' },
                  { raw: 'tea', isTarget: true, conceptId: 'c-tea-trap', status: 'learning', sentenceId: 'sent-trap', segmentId: 'seg-trap' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-trap',
            order: 0,
            text: 'Drink tea.',
            translationVi: 'Uống trà.',
            tokens: [
              { raw: 'Drink', isTarget: false, sentenceId: 'sent-trap', segmentId: 'seg-trap' },
              { raw: 'tea', isTarget: true, conceptId: 'c-tea-trap', status: 'learning', sentenceId: 'sent-trap', segmentId: 'seg-trap' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const teaBtn = screen.getByRole('button', { name: 'tea' });
      fireEvent.click(teaBtn);

      const warningCallout = screen.getByTestId('wave9-false-friend-warning');
      expect(warningCallout).toBeInTheDocument();
      expect(warningCallout).toHaveTextContent(/đồng âm với chữ cái "T"/);
    });
  });

  describe('3. Item #3: ReviewSession FSRS Batch Size Selector', () => {
    it('renders segmented batch size selector and updates batch size on click', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-1',
          term: 'diligent',
          targetForm: 'diligent',
          meaningVi: 'chăm chỉ',
          posVi: 'Tính từ',
          cefrLevel: 'B1',
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

      const batchGroup = screen.getByTestId('wave9-review-batch-size');
      expect(batchGroup).toBeInTheDocument();
      expect(batchGroup).toHaveAttribute('aria-label', 'Chọn số lượng thẻ ôn tập mỗi phiên');

      const btn5 = screen.getByRole('button', { name: '5 thẻ' });
      const btn10 = screen.getByRole('button', { name: '10 thẻ' });
      const btn15 = screen.getByRole('button', { name: '15 thẻ' });
      const btnAll = screen.getByRole('button', { name: 'Tất cả' });

      expect(btnAll).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(btn5);
      expect(btn5).toHaveAttribute('aria-pressed', 'true');
      expect(btnAll).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(btn15);
      expect(btn15).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('4. Item #4: Language Brain CEFR Breakdown Pill', () => {
    it('renders CEFR distribution breakdown in canvas header', () => {
      const mockNodes: BrainNodeItem[] = [
        { id: 'n1', term: 'cat', meaningVi: 'con mèo', cefr: 'A1', status: 'mastered', encounterCount: 5, recallScore: 1, relatedIds: [] },
        { id: 'n2', term: 'apple', meaningVi: 'quả táo', cefr: 'A1', status: 'mastered', encounterCount: 4, recallScore: 0.9, relatedIds: [] },
        { id: 'n3', term: 'travel', meaningVi: 'du lịch', cefr: 'A2', status: 'learning', encounterCount: 3, recallScore: 0.7, relatedIds: [] },
        { id: 'n4', term: 'achieve', meaningVi: 'đạt được', cefr: 'B1', status: 'learning', encounterCount: 2, recallScore: 0.6, relatedIds: [] },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      const breakdown = screen.getByTestId('wave9-brain-cefr-breakdown');
      expect(breakdown).toBeInTheDocument();
      expect(breakdown).toHaveAttribute('aria-label', 'Phân bổ cấp độ CEFR của các từ trong Brain');
      expect(breakdown).toHaveTextContent(/A1:\s*2/);
      expect(breakdown).toHaveTextContent(/A2:\s*1/);
      expect(breakdown).toHaveTextContent(/B1:\s*1/);
      expect(breakdown).toHaveTextContent(/B2:\s*0/);
    });
  });

  describe('5. Item #5: Ultra-Slow 0.5x Audio Pronunciation in DictionaryView', () => {
    it('renders 0.5x audio button and speaks with rate 0.5', () => {
      render(<DictionaryView />);

      const superSlowBtns = screen.getAllByTestId('wave9-dict-super-slow-audio');
      expect(superSlowBtns.length).toBeGreaterThan(0);
      expect(superSlowBtns[0]).toHaveAttribute('aria-label', expect.stringContaining('Nghe siêu chậm 0.5x'));

      fireEvent.click(superSlowBtns[0]);
      expect(speakSpy).toHaveBeenCalled();
      const lastCall = speakSpy.mock.calls[speakSpy.mock.calls.length - 1][0] as MockSpeechSynthesisUtterance;
      expect(lastCall.rate).toBe(0.5);
    });
  });

  describe('6. Item #6: Library Mastery Filter Bar in LibraryView', () => {
    it('renders mastery status filter and filters items by learning/mastered/weak', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'c1',
          itemType: 'concept',
          canonicalForm: 'serendipity',
          meaningVi: 'sự may mắn tình cờ',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
        {
          id: 'c2',
          itemType: 'concept',
          canonicalForm: 'ephemeral',
          meaningVi: 'phù du',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'learning',
        },
        {
          id: 'c3',
          itemType: 'concept',
          canonicalForm: 'struggle',
          meaningVi: 'vật lộn',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'weak',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const filterBar = screen.getByTestId('wave9-library-mastery-filter');
      expect(filterBar).toBeInTheDocument();
      expect(filterBar).toHaveAttribute('aria-label', 'Lọc thư viện theo trạng thái ghi nhớ');

      expect(screen.getByText('serendipity')).toBeInTheDocument();
      expect(screen.getByText('ephemeral')).toBeInTheDocument();
      expect(screen.getByText('struggle')).toBeInTheDocument();

      // Click "Đã vững"
      const masteredBtn = screen.getByRole('button', { name: 'Đã vững' });
      fireEvent.click(masteredBtn);

      expect(screen.getByText('serendipity')).toBeInTheDocument();
      expect(screen.queryByText('ephemeral')).not.toBeInTheDocument();
      expect(screen.queryByText('struggle')).not.toBeInTheDocument();

      // Click "Cần củng cố"
      const weakBtn = screen.getByRole('button', { name: 'Cần củng cố' });
      fireEvent.click(weakBtn);

      expect(screen.queryByText('serendipity')).not.toBeInTheDocument();
      expect(screen.queryByText('ephemeral')).not.toBeInTheDocument();
      expect(screen.getByText('struggle')).toBeInTheDocument();
    });
  });

  describe('7. Item #7: Today Dashboard Daily Skill Focus & Learning Intention', () => {
    it('renders daily focus skill badge in Today Dashboard header', () => {
      render(<TodayDashboard forcedState="success" />);

      const focusBadge = screen.getByTestId('wave9-today-skill-focus');
      expect(focusBadge).toBeInTheDocument();
      expect(focusBadge).toHaveAttribute('aria-label', 'Kỹ năng trọng tâm của kế hoạch hôm nay');
      expect(focusBadge).toHaveTextContent(/Trọng tâm hôm nay:/);
    });
  });

  describe('8. Item #8: ProgressAnalytics Streak Freeze Protection Indicator', () => {
    it('renders streak shield status pill in ProgressAnalytics', () => {
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
              { dayLabel: 'T3', minutesSpent: 25, wordsLearned: 4, retentionPercent: 88 },
              { dayLabel: 'T4', minutesSpent: 30, wordsLearned: 5, retentionPercent: 92 },
              { dayLabel: 'T5', minutesSpent: 20, wordsLearned: 3, retentionPercent: 89 },
            ],
            retentionScore: 90,
            wordsSolidified: 25,
          }}
        />
      );

      const freezeIndicator = screen.getByTestId('wave9-progress-streak-freeze');
      expect(freezeIndicator).toBeInTheDocument();
      expect(freezeIndicator).toHaveAttribute('aria-label', 'Trạng thái lá chắn bảo vệ chuỗi học tập');
      expect(freezeIndicator).toHaveTextContent(/Lá chắn bảo vệ chuỗi/);
      expect(freezeIndicator).toHaveTextContent(/1 lượt an toàn/);
    });
  });

  describe('9. Item #9: ProfileView Learning Pace Selector', () => {
    it('renders weekly commitment pace selector and allows selecting pace', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Alex Rivera',
            email: 'alex@lingua.app',
            startingLevelEstimate: 'B1',
            totalConceptsEncountered: 45,
            totalConceptsMastered: 18,
            streakDays: 5,
          }}
        />
      );

      const paceSelector = screen.getByTestId('wave9-profile-pace-selector');
      expect(paceSelector).toBeInTheDocument();
      expect(paceSelector).toHaveAttribute('aria-label', 'Nhịp độ học tập cam kết hàng tuần');

      const regularBtn = screen.getByRole('button', { name: 'Đều đặn: 20p' });
      const intensiveBtn = screen.getByRole('button', { name: 'Tập trung: 45p' });

      expect(regularBtn).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(intensiveBtn);
      expect(intensiveBtn).toHaveAttribute('aria-pressed', 'true');
      expect(regularBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('10. Item #10: SettingsView Accent Voice Preference & Conditional Persistence', () => {
    it('renders accent voice selector and conditionally persists preferredAccent when changed', () => {
      const onSave = vi.fn();
      render(<SettingsView onSaveSettings={onSave} />);

      const accentSelector = screen.getByTestId('wave9-settings-accent-selector');
      expect(accentSelector).toBeInTheDocument();
      expect(accentSelector).toHaveAttribute('aria-label', 'Chọn giọng phát âm mẫu: Anh-Mỹ hoặc Anh-Anh');

      const ukBtn = screen.getByRole('button', { name: /Anh - Anh \(en-GB\)/i });
      fireEvent.click(ukBtn);

      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveBtn);

      const storedJson = window.localStorage.getItem('lingua-user-settings-v1');
      expect(storedJson).toBeTruthy();
      const parsed = JSON.parse(storedJson!);
      expect(parsed.preferredAccent).toBe('en-GB');

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredAccent: 'en-GB',
        })
      );
    });
  });
});
