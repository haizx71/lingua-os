import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReaderPassageViewModel } from '@lingua/types';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';

describe('Wave 6 Enterprise Language Platform Upgrades Test Suite', () => {
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

    window.localStorage.clear();
  });

  describe('1. Items #1 & #2: ProgressAnalytics CEFR Milestone Estimator & Consistency Strip', () => {
    it('renders data-testid="progress-cefr-milestone" and data-testid="progress-consistency-strip"', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 6,
            wordsSolidified: 35,
            retentionScore: 91,
            minutesLearned7d: 84,
            minutesLearned30d: 310,
            dailyHistory: [
              { date: '2026-10-21', dayLabel: 'T2', minutesSpent: 15, wordsReviewed: 10, retentionPercent: 90 },
              { date: '2026-10-22', dayLabel: 'T3', minutesSpent: 12, wordsReviewed: 8, retentionPercent: 92 },
              { date: '2026-10-23', dayLabel: 'T4', minutesSpent: 14, wordsReviewed: 9, retentionPercent: 91 },
              { date: '2026-10-24', dayLabel: 'T5', minutesSpent: 10, wordsReviewed: 7, retentionPercent: 89 },
              { date: '2026-10-25', dayLabel: 'T6', minutesSpent: 18, wordsReviewed: 12, retentionPercent: 93 },
              { date: '2026-10-26', dayLabel: 'T7', minutesSpent: 15, wordsReviewed: 11, retentionPercent: 91 },
              { date: '2026-10-27', dayLabel: 'CN', minutesSpent: 0, wordsReviewed: 0, retentionPercent: 90 },
            ],
          }}
        />,
      );

      const milestone = screen.getByTestId('progress-cefr-milestone');
      expect(milestone).toBeInTheDocument();
      expect(milestone.textContent).toContain('A1 Beginner');
      expect(milestone.textContent).toContain('35/50');
      expect(milestone.textContent).toContain('70%');

      const consistency = screen.getByTestId('progress-consistency-strip');
      expect(consistency).toBeInTheDocument();
      expect(consistency.textContent).toContain('6/7 ngày');
    });
  });

  describe('2. Items #3 & #4: ProfileView Milestone Badges & Quick Settings Link', () => {
    it('renders data-testid="profile-achievements-grid" and data-testid="profile-edit-goal-link"', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Minh Learner',
            email: 'minh@example.com',
            startingLevelEstimate: 'A2',
            targetGoal: '15 phút/ngày',
            totalConceptsEncountered: 55,
            totalConceptsMastered: 12,
            streakDays: 5,
          }}
        />,
      );

      const editGoalBtn = screen.getByTestId('profile-edit-goal-link');
      expect(editGoalBtn).toBeInTheDocument();
      expect(editGoalBtn.textContent).toContain('Chỉnh sửa mục tiêu & múi giờ');

      const achievementsGrid = screen.getByTestId('profile-achievements-grid');
      expect(achievementsGrid).toBeInTheDocument();
      expect(screen.getByTestId('profile-badge-first-step')).toHaveAttribute('data-unlocked', 'true');
      expect(screen.getByTestId('profile-badge-streak-builder')).toHaveAttribute('data-unlocked', 'true');
      expect(screen.getByTestId('profile-badge-avid-explorer')).toHaveAttribute('data-unlocked', 'true');
      expect(screen.getByTestId('profile-badge-memory-master')).toHaveAttribute('data-unlocked', 'true');
    });
  });

  describe('3. Items #5 & #6: OnboardingDiagnostic Auditory Playback & Multi-Skill Breakdown', () => {
    it('speaks the active question prompt and displays multi-skill breakdown on completion', () => {
      render(<OnboardingDiagnostic />);

      const speakBtn = screen.getByTestId('onboarding-speak-prompt');
      expect(speakBtn).toBeInTheDocument();
      fireEvent.click(speakBtn);
      expect(speakSpy).toHaveBeenCalledTimes(1);

      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      const breakdown = screen.getByTestId('onboarding-skill-breakdown');
      expect(breakdown).toBeInTheDocument();
      expect(breakdown.textContent).toContain('Nhận diện từ vựng');
      expect(breakdown.textContent).toContain('Đọc hiểu ngữ cảnh');
      expect(breakdown.textContent).toContain('Nhịp độ đề xuất');
    });
  });

  describe('4. Items #7 & #8: InteractiveReader Sentence Shadowing & Post-Passage Recall Micro-Check', () => {
    it('triggers 1.0x + 0.75x shadowing utterances and renders post-passage recall flip chips when completed', () => {
      const completedPassage: ReaderPassageViewModel = {
        id: 'passage-w6',
        title: 'A Quiet Cup of Tea',
        level: 'A1',
        wordCount: 4,
        familiarityRate: 80,
        isSaved: false,
        progress: {
          currentSegmentId: 'seg-1',
          completedSegmentIds: ['seg-1'],
          progressPercent: 100,
          isCompleted: true,
        },
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'Mina visits for tea.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'Mina visits for tea.',
                translationVi: 'Mina ghé thăm để uống trà.',
                tokens: [
                  { raw: 'Mina', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: ' ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  {
                    raw: 'visits',
                    lemma: 'visit',
                    translationVi: 'ghé thăm',
                    isTarget: true,
                    conceptId: 'c-visit',
                    status: 'learning',
                    sentenceId: 'sent-1',
                    segmentId: 'seg-1',
                  },
                  { raw: ' for ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  {
                    raw: 'tea',
                    lemma: 'tea',
                    translationVi: 'trà',
                    isTarget: true,
                    conceptId: 'c-tea',
                    status: 'mastered',
                    sentenceId: 'sent-1',
                    segmentId: 'seg-1',
                  },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'Mina visits for tea.',
            translationVi: 'Mina ghé thăm để uống trà.',
            tokens: [
              { raw: 'Mina', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: ' ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              {
                raw: 'visits',
                lemma: 'visit',
                translationVi: 'ghé thăm',
                isTarget: true,
                conceptId: 'c-visit',
                status: 'learning',
                sentenceId: 'sent-1',
                segmentId: 'seg-1',
              },
              { raw: ' for ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              {
                raw: 'tea',
                lemma: 'tea',
                translationVi: 'trà',
                isTarget: true,
                conceptId: 'c-tea',
                status: 'mastered',
                sentenceId: 'sent-1',
                segmentId: 'seg-1',
              },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={completedPassage} />);

      const shadowBtn = screen.getByTestId('reader-shadowing-button');
      expect(shadowBtn).toBeInTheDocument();
      fireEvent.click(shadowBtn);
      expect(speakSpy).toHaveBeenCalledTimes(2);

      const recallBox = screen.getByTestId('reader-completion-recall');
      expect(recallBox).toBeInTheDocument();

      const visitChip = screen.getByTestId('reader-recall-chip-c-visit');
      expect(visitChip.textContent).toContain('(Chạm xem nghĩa)');
      fireEvent.click(visitChip);
      expect(visitChip.textContent).toContain('ghé thăm');
    });
  });

  describe('5. Item #9: ReviewSession Tactile Card Flip State', () => {
    it('exposes data-card-flipped="false" before reveal and "true" after reveal', () => {
      const clozeQueue: ReviewCardItem[] = [
        {
          id: 'rev-w6-1',
          term: 'schedule',
          meaningVi: 'lịch trình',
          pos: 'noun',
          status: 'learning',
          exerciseMode: 'cloze',
          prompt: 'Điền từ còn thiếu',
          contextSentence: 'Check your ___ before tomorrow.',
          isDue: true,
        },
      ];

      render(<ReviewSession initialQueue={clozeQueue} />);

      const card = screen.getByTestId('review-active-card');
      expect(card).toHaveAttribute('data-card-flipped', 'false');

      const revealBtn = screen.getByRole('button', { name: /Hiện đáp án/i });
      fireEvent.click(revealBtn);

      expect(card).toHaveAttribute('data-card-flipped', 'true');
    });
  });

  describe('6. Item #10: DictionaryView Recent Search History Chips', () => {
    it('renders data-testid="dictionary-recent-searches" and clears history on click', () => {
      render(<DictionaryView />);

      const recentBar = screen.getByTestId('dictionary-recent-searches');
      expect(recentBar).toBeInTheDocument();
      expect(recentBar.textContent).toContain('morning');

      const clearBtn = screen.getByTestId('dictionary-clear-history');
      fireEvent.click(clearBtn);

      expect(screen.queryByTestId('dictionary-recent-searches')).not.toBeInTheDocument();
    });
  });
});
