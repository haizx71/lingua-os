import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';

describe('Wave 7 Enterprise Language Platform Upgrades Test Suite', () => {
  let speakSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;

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
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    window.localStorage.clear();
  });

  describe('1. Items #1 & #2: InteractiveReader Font Scale Toggle & Lexical Distribution', () => {
    it('cycles typography scale without writing to localStorage and displays passage lexical distribution', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w7',
        title: 'Morning Tea',
        level: 'A1',
        wordCount: 4,
        familiarityRate: 75,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'Mina drinks hot tea.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'Mina drinks hot tea.',
                translationVi: 'Mina uống trà nóng.',
                tokens: [
                  { raw: 'Mina', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'drinks', isTarget: true, conceptId: 'c-drink', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'hot', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
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
            text: 'Mina drinks hot tea.',
            translationVi: 'Mina uống trà nóng.',
            tokens: [
              { raw: 'Mina', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'drinks', isTarget: true, conceptId: 'c-drink', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'hot', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'tea', isTarget: true, conceptId: 'c-tea', status: 'mastered', sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const distribution = screen.getByTestId('reader-lexical-distribution');
      expect(distribution).toBeInTheDocument();
      expect(distribution.textContent).toContain('1 từ vững');
      expect(distribution.textContent).toContain('1 đang học');

      const fontBtn = screen.getByTestId('reader-font-size-toggle');
      expect(fontBtn.textContent).toContain('Aa Cỡ chữ: Chuẩn');

      fireEvent.click(fontBtn);
      expect(fontBtn.textContent).toContain('Aa Cỡ chữ: Lớn');
      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('2. Items #3 & #4: ReviewSession Auditory Feedback Toggle & FSRS Leech Indicator', () => {
    it('renders sound feedback toggle and displays leech indicator when card status is forgotten', () => {
      const leechQueue: ReviewCardItem[] = [
        {
          id: 'rev-w7-1',
          term: 'appointment',
          meaningVi: 'cuộc hẹn',
          pos: 'noun',
          status: 'forgotten',
          exerciseMode: 'self_recall',
          isDue: true,
        },
      ];

      render(<ReviewSession initialQueue={leechQueue} />);

      const soundToggle = screen.getByTestId('review-audio-feedback-toggle');
      expect(soundToggle).toBeInTheDocument();
      expect(soundToggle.textContent).toContain('🔔 Âm phản hồi: Bật');

      fireEvent.click(soundToggle);
      expect(soundToggle.textContent).toContain('🔕 Âm phản hồi: Tắt');

      const leechIndicator = screen.getByTestId('review-leech-indicator');
      expect(leechIndicator).toBeInTheDocument();
      expect(leechIndicator.textContent).toContain('Từ cần chú ý đặc biệt');
    });
  });

  describe('3. Items #5 & #6: LanguageBrain Collocations & Dictionary Bilingual Cross-Search', () => {
    it('renders collocation pills in Brain concept modal and toggles bilingual search direction in Dictionary', async () => {
      const nodes: BrainNodeItem[] = [
        {
          id: 'bn-w7-1',
          label: 'tea',
          translationVi: 'trà',
          cefr: 'A1',
          status: 'learning',
          groupLabel: 'Food & Drink',
          x: 10,
          y: 10,
          size: 20,
        },
      ];

      render(<LanguageBrainCanvas initialNodes={nodes} />);

      fireEvent.click(screen.getByRole('button', { name: /tea/i }));

      await waitFor(() => {
        expect(screen.getByTestId('brain-related-collocations')).toBeInTheDocument();
      });
      expect(screen.getByTestId('brain-related-collocations').textContent).toContain('a cup of tea');

      render(<DictionaryView />);
      const langToggle = screen.getByTestId('dictionary-search-lang-toggle');
      expect(langToggle).toBeInTheDocument();
      expect(langToggle.textContent).toContain('Anh ↔ Việt');

      fireEvent.click(langToggle);
      expect(langToggle.textContent).toContain('Tìm bằng tiếng Việt');
    });
  });

  describe('4. Items #7 & #8: Library Bulk Selection & Today Circadian Study Banner', () => {
    it('supports select-all in LibraryView and renders study rhythm banner in TodayDashboard', () => {
      const items: LibraryItemViewModel[] = [
        {
          id: 'lib-w7-1',
          itemType: 'concept',
          canonicalForm: 'tea',
          savedAt: '2026-10-28T08:00:00Z',
          status: 'learning',
          isDue: false,
        },
        {
          id: 'lib-w7-2',
          itemType: 'concept',
          canonicalForm: 'coffee',
          savedAt: '2026-10-28T09:00:00Z',
          status: 'mastered',
          isDue: false,
        },
      ];

      render(<LibraryView initialItems={items} />);

      const bulkBox = screen.getByTestId('library-bulk-actions');
      expect(bulkBox).toBeInTheDocument();

      const selectAllBtn = screen.getByTestId('library-select-all');
      expect(selectAllBtn.textContent).toContain('Chọn tất cả (2)');
      fireEvent.click(selectAllBtn);
      expect(selectAllBtn.textContent).toContain('Bỏ chọn tất cả (2)');

      render(<TodayDashboard initialStreakDays={3} />);
      const greetingBanner = screen.getByTestId('today-greeting-banner');
      expect(greetingBanner).toBeInTheDocument();
      expect(greetingBanner.textContent).toContain('Nhịp học khoa học');
    });
  });

  describe('5. Items #9 & #10: Progress Velocity Forecast & Settings Reminder Time Selector', () => {
    it('renders CEFR velocity forecast in ProgressAnalytics and persists preferredReminderTime in SettingsView', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 5,
            wordsSolidified: 30,
            retentionScore: 90,
            minutesLearned7d: 105,
            minutesLearned30d: 320,
            dailyHistory: [
              { date: '2026-10-22', dayLabel: 'T2', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-23', dayLabel: 'T3', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-24', dayLabel: 'T4', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-25', dayLabel: 'T5', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-26', dayLabel: 'T6', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-27', dayLabel: 'T7', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-28', dayLabel: 'CN', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
            ],
          }}
        />,
      );

      const forecast = screen.getByTestId('progress-velocity-forecast');
      expect(forecast).toBeInTheDocument();
      expect(forecast.textContent).toContain('Tốc độ dự kiến');

      render(<SettingsView />);
      const reminderSelector = screen.getByTestId('settings-reminder-time-selector');
      expect(reminderSelector).toBeInTheDocument();

      const eveningBtn = screen.getByTestId('settings-reminder-20:00');
      fireEvent.click(eveningBtn);

      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveBtn);

      const raw = window.localStorage.getItem('lingua-user-settings-v1');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).preferredReminderTime).toBe('20:00');
    });
  });
});
