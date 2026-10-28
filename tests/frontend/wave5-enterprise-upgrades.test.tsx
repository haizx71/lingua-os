import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  LibraryItemViewModel,
  ReaderPassageViewModel,
} from '@lingua/types';
import { lookupBeginnerWord } from '../../apps/web/src/features/read/beginnerLexicon';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import type { BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';

describe('Wave 5 Enterprise Language Platform Upgrades Test Suite', () => {
  let speakSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;
  let lastUtterance: { text: string; lang: string; rate: number } | null = null;

  class MockSpeechSynthesisUtterance {
    text: string;
    lang = 'en-US';
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastUtterance = this;
    }
  }

  beforeEach(() => {
    lastUtterance = null;
    speakSpy = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      lastUtterance = utterance;
    });
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

  describe('1. Item #3: beginnerLexicon Irregular Verbs & Contractions', () => {
    it('resolves irregular past-tense verbs and contractions to their base lemmas with Vietnamese morphological notes', () => {
      // 1. went -> go
      const wentEntry = lookupBeginnerWord('went');
      expect(wentEntry).not.toBeNull();
      expect(wentEntry?.lemma).toBe('go');
      expect(wentEntry?.posVi).toBe('Động từ');
      expect(wentEntry?.meaningVi).toContain('Quá khứ của go');

      // 2. drank -> drink
      const drankEntry = lookupBeginnerWord('drank');
      expect(drankEntry).not.toBeNull();
      expect(drankEntry?.lemma).toBe('drink');
      expect(drankEntry?.meaningVi).toContain('Quá khứ của drink');

      // 3. took -> take
      const tookEntry = lookupBeginnerWord('took');
      expect(tookEntry).not.toBeNull();
      expect(tookEntry?.lemma).toBe('take');
      expect(tookEntry?.meaningVi).toContain('Quá khứ của take');

      // 4. don't -> do not
      const dontEntry = lookupBeginnerWord("don't");
      expect(dontEntry).not.toBeNull();
      expect(dontEntry?.lemma).toBe("do not (don't)");
      expect(dontEntry?.meaningVi).toContain('không (viết tắt của do not)');
    });
  });

  describe('2. Items #1 & #2: InteractiveReader LingQ Highlighting & Sentence Read-Along', () => {
    it('renders tiered concept status highlight classes and toggles data-playing="true" on per-sentence audio click', async () => {
      const mockPassage: ReaderPassageViewModel = {
        id: 'passage-w5',
        title: 'Morning Routine',
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

      render(<InteractiveReader passage={mockPassage} />);

      // Tiered status highlight checks
      const drinksToken = screen.getByRole('button', { name: 'drinks' });
      expect(drinksToken).toHaveAttribute('data-concept-status', 'learning');
      expect(drinksToken.className).toMatch(/amber-500/);

      const teaToken = screen.getByRole('button', { name: 'tea' });
      expect(teaToken).toHaveAttribute('data-concept-status', 'mastered');
      expect(teaToken.className).toMatch(/emerald-500/);

      // Per-sentence audio button
      const sentenceArticle = screen.getByTestId('reader-sentence');
      expect(sentenceArticle).toHaveAttribute('data-playing', 'false');

      const listenSentenceBtn = screen.getByRole('button', { name: 'Nghe câu 1' });
      fireEvent.click(listenSentenceBtn);

      expect(sentenceArticle).toHaveAttribute('data-playing', 'true');
    });
  });

  describe('3. Items #4 & #5: Smart Review Interval Preview & Audio Autoplay', () => {
    const queueWithCard: ReviewCardItem[] = [
      {
        id: 'rev-card-1',
        term: 'appointment',
        meaningVi: 'cuộc hẹn',
        pos: 'noun',
        status: 'learning',
        exerciseMode: 'recognition',
        options: ['cuộc hẹn', 'họp mặt', 'đồ uống', 'lớp học'],
        correctOptionIndex: 0,
        confidence: 'medium',
        isDue: true,
      },
    ];

    it('renders data-testid="review-interval-preview" with shortcut badges <kbd>1</kbd>..<kbd>4</kbd> and FSRS previews', () => {
      render(<ReviewSession initialQueue={queueWithCard} />);

      const intervalPreview = screen.getByTestId('review-interval-preview');
      expect(intervalPreview).toBeInTheDocument();
      expect(intervalPreview.textContent).toContain('1< 10 phút');
      expect(intervalPreview.textContent).toContain('21 ngày');
      expect(intervalPreview.textContent).toContain('33 ngày');
      expect(intervalPreview.textContent).toContain('46 ngày');

      const kbds = intervalPreview.querySelectorAll('kbd');
      expect(kbds).toHaveLength(4);
      expect(Array.from(kbds).map((k) => k.textContent)).toEqual(['1', '2', '3', '4']);
    });

    it('auto-speaks the card term on mount when audioAutoplay is enabled in lingua-user-settings-v1', async () => {
      window.localStorage.setItem(
        'lingua-user-settings-v1',
        JSON.stringify({ audioAutoplay: true, defaultSpeechRate: 0.75 })
      );

      render(<ReviewSession initialQueue={queueWithCard} />);

      await waitFor(() => {
        expect(speakSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'appointment',
            rate: 0.75,
          })
        );
      });
    });
  });

  describe('4. Items #6 & #7: LanguageBrain Canvas Audio/Filter & Today Streak Badge', () => {
    it('LanguageBrainCanvas renders semantic group filters and concept pronunciation button in detail dialog', async () => {
      const brainNodes: BrainNodeItem[] = [
        {
          id: 'bn-1',
          label: 'tea',
          translationVi: 'trà',
          cefr: 'A1',
          status: 'learning',
          groupLabel: 'Food & Drink',
          x: 0,
          y: 0,
          size: 20,
        },
        {
          id: 'bn-2',
          label: 'calendar',
          translationVi: 'lịch',
          cefr: 'A1',
          status: 'mastered',
          groupLabel: 'Work',
          x: 30,
          y: 30,
          size: 20,
        },
      ];

      render(<LanguageBrainCanvas initialNodes={brainNodes} />);

      // Group filter pills
      const groupFilter = screen.getByTestId('brain-group-filter');
      expect(groupFilter).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tất cả chủ đề' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Food & Drink' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument();

      // Open node dialog
      const teaChip = screen.getByRole('button', { name: /tea/i });
      fireEvent.click(teaChip);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Chi tiết khái niệm' })).toBeInTheDocument();
      });

      // Pronunciation button in dialog
      const speakBtn = screen.getByRole('button', { name: 'Phát âm khái niệm tea' });
      expect(speakBtn).toBeInTheDocument();

      fireEvent.click(speakBtn);
      expect(speakSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'tea',
        })
      );
    });

    it('TodayDashboard renders data-testid="today-streak-badge" with current streak count', () => {
      render(<TodayDashboard initialStreakDays={5} />);

      const streakBadge = screen.getByTestId('today-streak-badge');
      expect(streakBadge).toBeInTheDocument();
      expect(streakBadge.textContent).toContain('Chuỗi học 5 ngày liên tiếp');
    });
  });

  describe('5. Items #8 & #9: Dictionary Chips/CEFR Filter & Library Sort/Export', () => {
    it('DictionaryView renders 1-click starter search chips and CEFR level filter group', () => {
      render(<DictionaryView />);

      const starterChips = screen.getByTestId('dictionary-starter-chips');
      expect(starterChips).toBeInTheDocument();
      expect(starterChips.textContent).toContain('appointment');
      expect(starterChips.textContent).toContain('available');
      expect(starterChips.textContent).toContain('schedule');
      expect(starterChips.textContent).toContain('tea');

      const cefrFilter = screen.getByTestId('dictionary-cefr-filter');
      expect(cefrFilter).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'A1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'A2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'B1' })).toBeInTheDocument();

      // Clicking a starter chip updates the search input
      const appointmentChip = screen.getByRole('button', { name: 'appointment' });
      fireEvent.click(appointmentChip);

      const searchInput = screen.getByRole('searchbox');
      expect((searchInput as HTMLInputElement).value).toBe('appointment');
    });

    it('LibraryView supports A-Z sorting toggle and 1-click clipboard export', async () => {
      const items: LibraryItemViewModel[] = [
        {
          id: 'lib-1',
          itemType: 'concept',
          canonicalForm: 'banana',
          savedAt: '2026-10-27T10:00:00Z',
          status: 'learning',
          isDue: false,
        },
        {
          id: 'lib-2',
          itemType: 'concept',
          canonicalForm: 'apple',
          savedAt: '2026-10-27T11:00:00Z',
          status: 'mastered',
          isDue: false,
        },
      ];

      render(<LibraryView initialItems={items} />);

      const sortBtn = screen.getByTestId('library-sort-toggle');
      expect(sortBtn.textContent).toContain('Sắp xếp: Mặc định');

      fireEvent.click(sortBtn);
      expect(sortBtn.textContent).toContain('Sắp xếp: A → Z');

      const exportBtn = screen.getByTestId('library-export-copy');
      expect(exportBtn.textContent).toContain('Sao chép danh sách');

      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(exportBtn.textContent).toContain('Đã sao chép danh sách');
      });
    });
  });

  describe('6. Item #10: SettingsView Global Speech Rate Persistence', () => {
    it('persists defaultSpeechRate: 0.75 to lingua-user-settings-v1 when selecting 0.75x and clicking Save', async () => {
      render(<SettingsView />);

      const speechRateGroup = screen.getByTestId('settings-speech-rate-group');
      expect(speechRateGroup).toBeInTheDocument();

      const slowButton = screen.getByTestId('settings-speech-rate-slow');
      const normalButton = screen.getByTestId('settings-speech-rate-1');

      expect(slowButton).toBeInTheDocument();
      expect(normalButton).toBeInTheDocument();

      // Click 0.75x Chậm
      fireEvent.click(slowButton);

      // Click Save Settings button
      const saveButton = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveButton);

      // Verify localStorage persistence
      const rawStored = window.localStorage.getItem('lingua-user-settings-v1');
      expect(rawStored).not.toBeNull();

      const parsed = JSON.parse(rawStored!);
      expect(parsed.defaultSpeechRate).toBe(0.75);
    });
  });
});
