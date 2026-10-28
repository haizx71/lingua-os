import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { lookupBeginnerWord, PHRASAL_VERBS_MAP } from '../../apps/web/src/features/read/beginnerLexicon';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import type { BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 8 Enterprise Language Platform Upgrades Test Suite', () => {
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

  describe('1. Items #1 & #2: InteractiveReader Focus/Zen Mode & Phrasal Verbs Lexicon', () => {
    it('toggles Zen Mode in InteractiveReader without writing to localStorage', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w8',
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
            text: 'I wake up early.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I wake up early.',
                translationVi: 'Tôi thức dậy sớm.',
                tokens: [
                  { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'wake', isTarget: true, conceptId: 'c-wake', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'up', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'early', isTarget: true, conceptId: 'c-early', status: 'mastered', sentenceId: 'sent-1', segmentId: 'seg-1' },
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
              { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'wake', isTarget: true, conceptId: 'c-wake', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'up', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'early', isTarget: true, conceptId: 'c-early', status: 'mastered', sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      const { container } = render(<InteractiveReader passage={passage} />);

      const readerRoot = container.firstElementChild as HTMLElement;
      expect(readerRoot).toHaveAttribute('data-reader-zen', 'false');

      const zenToggle = screen.getByTestId('reader-focus-mode-toggle');
      expect(zenToggle).toBeInTheDocument();
      expect(zenToggle.textContent).toContain('🧘 Đọc tập trung');

      fireEvent.click(zenToggle);
      expect(readerRoot).toHaveAttribute('data-reader-zen', 'true');
      expect(zenToggle.textContent).toContain('🧘 Đang tập trung');

      fireEvent.click(zenToggle);
      expect(readerRoot).toHaveAttribute('data-reader-zen', 'false');
      expect(window.localStorage.length).toBe(0);
    });

    it('resolves multi-word phrasal verbs and idioms via lookupBeginnerWord and PHRASAL_VERBS_MAP', () => {
      expect(PHRASAL_VERBS_MAP['wake up']).toBeDefined();
      expect(PHRASAL_VERBS_MAP['wake up'].meaningVi).toContain('thức dậy');

      const wakeUp = lookupBeginnerWord('wake up');
      expect(wakeUp).not.toBeNull();
      expect(wakeUp?.lemma).toBe('wake up');
      expect(wakeUp?.posVi).toBe('Cụm động từ');
      expect(wakeUp?.meaningVi).toContain('thức dậy, tỉnh giấc');

      const lookForward = lookupBeginnerWord('look forward to');
      expect(lookForward).not.toBeNull();
      expect(lookForward?.meaningVi).toContain('mong đợi');

      const aLotOf = lookupBeginnerWord('a lot of');
      expect(aLotOf).not.toBeNull();
      expect(aLotOf?.posVi).toBe('Cụm lượng từ');
      expect(aLotOf?.meaningVi).toContain('nhiều, rất nhiều');
    });
  });

  describe('2. Items #3 & #4: ReviewSession Accuracy HUD & Brain Mastery Summary Filter', () => {
    it('renders real-time accuracy HUD and streak badge in ReviewSession header', () => {
      const queue: ReviewCardItem[] = [
        {
          id: 'rev-w8-1',
          term: 'schedule',
          meaningVi: 'lịch trình',
          pos: 'noun',
          status: 'learning',
          exerciseMode: 'self_recall',
          isDue: true,
        },
      ];

      render(<ReviewSession initialQueue={queue} />);

      const accuracyBadge = screen.getByTestId('review-session-accuracy-badge');
      expect(accuracyBadge).toBeInTheDocument();
      expect(accuracyBadge.textContent).toContain('100%');
    });

    it('renders mastery health status counts in LanguageBrainCanvas filter pills', () => {
      const nodes: BrainNodeItem[] = [
        {
          id: 'bn-w8-1',
          label: 'tea',
          translationVi: 'trà',
          cefr: 'A1',
          status: 'mastered',
          groupLabel: 'Food',
          x: 10,
          y: 10,
          size: 20,
        },
        {
          id: 'bn-w8-2',
          label: 'schedule',
          translationVi: 'lịch trình',
          cefr: 'A2',
          status: 'learning',
          groupLabel: 'Work',
          x: 20,
          y: 20,
          size: 20,
        },
        {
          id: 'bn-w8-3',
          label: 'appointment',
          translationVi: 'cuộc hẹn',
          cefr: 'B1',
          status: 'weak',
          groupLabel: 'Work',
          x: 30,
          y: 30,
          size: 20,
        },
      ];

      render(<LanguageBrainCanvas initialNodes={nodes} />);

      const masteryFilter = screen.getByTestId('brain-mastery-summary-filter');
      expect(masteryFilter).toBeInTheDocument();
      expect(masteryFilter.textContent).toContain('Đã vững:');
      expect(masteryFilter.textContent).toContain('Đang học:');
      expect(masteryFilter.textContent).toContain('Cần củng cố / Đã quên:');
    });
  });

  describe('3. Items #5 & #6: Dictionary Example Sentence Audio & Library Filter Reset', () => {
    it('plays pronunciation of example sentence in DictionaryView when clicking audio button', () => {
      render(<DictionaryView />);

      const exampleAudios = screen.getAllByTestId('dictionary-example-audio');
      expect(exampleAudios.length).toBeGreaterThan(0);

      fireEvent.click(exampleAudios[0]);
      expect(speakSpy).toHaveBeenCalled();
    });

    it('displays and triggers filter reset button in LibraryView when filters are active', () => {
      const items: LibraryItemViewModel[] = [
        {
          id: 'lib-w8-1',
          itemType: 'concept',
          canonicalForm: 'tea',
          savedAt: '2026-10-28T08:00:00Z',
          status: 'learning',
          isDue: false,
        },
        {
          id: 'lib-w8-2',
          itemType: 'concept',
          canonicalForm: 'schedule',
          savedAt: '2026-10-28T09:00:00Z',
          status: 'mastered',
          isDue: false,
        },
      ];

      render(<LibraryView initialItems={items} />);

      const searchInput = screen.getByPlaceholderText(/Tìm từ, câu/i);
      fireEvent.change(searchInput, { target: { value: 'tea' } });

      const resetBtn = screen.getByTestId('library-reset-filters');
      expect(resetBtn).toBeInTheDocument();

      fireEvent.click(resetBtn);
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('4. Items #7 & #8: Today Remaining Time Indicator & Retention Health Badge', () => {
    it('renders estimated remaining study time in TodayDashboard', () => {
      const { rerender } = render(
        <TodayDashboard
          initialTargetMinutes={20}
          initialCompletedMinutes={5}
        />,
      );

      const indicator = screen.getByTestId('today-remaining-time-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.textContent).toContain('Còn khoảng 15 phút');

      rerender(
        <TodayDashboard
          initialTargetMinutes={15}
          initialCompletedMinutes={15}
        />,
      );
      expect(screen.getByTestId('today-remaining-time-indicator').textContent).toContain('Đã hoàn thành');
    });

    it('renders memory retention health status badge in ProgressAnalytics', () => {
      const { rerender } = render(
        <ProgressAnalytics
          initialData={{
            streakDays: 6,
            wordsSolidified: 35,
            retentionScore: 92,
            minutesLearned7d: 84,
            minutesLearned30d: 310,
            dailyHistory: [
              { date: '2026-10-21', dayLabel: 'T2', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 92 },
              { date: '2026-10-22', dayLabel: 'T3', minutesSpent: 12, wordsReviewed: 8, retentionPercent: 92 },
            ],
          }}
        />,
      );

      const healthBadge = screen.getByTestId('progress-retention-status-badge');
      expect(healthBadge).toBeInTheDocument();
      expect(healthBadge.textContent).toContain('💚 Trí nhớ ổn định tốt');

      rerender(
        <ProgressAnalytics
          initialData={{
            streakDays: 2,
            wordsSolidified: 10,
            retentionScore: 75,
            minutesLearned7d: 30,
            minutesLearned30d: 100,
            dailyHistory: [
              { date: '2026-10-21', dayLabel: 'T2', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 75 },
              { date: '2026-10-22', dayLabel: 'T3', minutesSpent: 12, wordsReviewed: 8, retentionPercent: 75 },
            ],
          }}
        />,
      );
      expect(screen.getByTestId('progress-retention-status-badge').textContent).toContain('💛 Cần tăng cường ôn tập');
    });
  });

  describe('5. Items #9 & #10: Profile Summary Share & Onboarding Progress Percentage', () => {
    it('copies formatted identity summary to clipboard in ProfileView', async () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Minh Learner',
            email: 'minh@example.com',
            startingLevelEstimate: 'A2',
            targetGoal: '15 phút/ngày',
            totalConceptsEncountered: 55,
            totalConceptsMastered: 18,
            streakDays: 7,
          }}
        />,
      );

      const copyBtn = screen.getByTestId('profile-copy-summary');
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn.textContent).toContain('Sao chép tóm tắt hồ sơ');

      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(clipboardSpy).toHaveBeenCalledTimes(1);
      });

      expect(clipboardSpy).toHaveBeenCalledWith(
        expect.stringContaining('LINGUA OS · Minh Learner · Cấp độ: A2 · Đã củng cố: 18 từ · Chuỗi: 7 ngày'),
      );
      expect(copyBtn.textContent).toContain('Đã sao chép hồ sơ');
    });

    it('renders visual question progress percentage indicator in OnboardingDiagnostic', () => {
      render(<OnboardingDiagnostic />);

      const percentIndicator = screen.getByTestId('diagnostic-percentage-indicator');
      expect(percentIndicator).toBeInTheDocument();
      expect(percentIndicator.textContent).toContain('33%');

      const dontKnowBtn = screen.getByTestId('onboarding-dont-know-option');
      fireEvent.click(dontKnowBtn);

      const nextBtn = screen.getByRole('button', { name: /Câu tiếp theo/i });
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('diagnostic-percentage-indicator').textContent).toContain('67%');
    });
  });
});
