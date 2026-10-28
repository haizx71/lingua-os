import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { getSemanticContrastTip } from '../../apps/web/src/features/read/beginnerLexicon';
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

describe('Wave 12 Enterprise Language Platform Upgrades Test Suite', () => {
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

  describe('1. Item #1: InteractiveReader Passage Sentence Count Pill', () => {
    it('renders sentence count pill displaying total sentences in passage', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w12-sentence-count',
        title: 'Daily Life',
        level: 'A1',
        wordCount: 12,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I wake up early. The morning is quiet.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I wake up early.',
                translationVi: 'Tôi thức dậy sớm.',
                tokens: [
                  { raw: 'I', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'wake', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'up', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'early', isTarget: true, conceptId: 'c-early', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
              {
                id: 'sent-2',
                order: 1,
                text: 'The morning is quiet.',
                translationVi: 'Buổi sáng thật yên tĩnh.',
                tokens: [
                  { raw: 'The', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
                  { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'mastered', sentenceId: 'sent-2', segmentId: 'seg-1' },
                  { raw: 'is', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
                  { raw: 'quiet', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
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
              { raw: 'wake', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'up', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
              { raw: 'early', isTarget: true, conceptId: 'c-early', status: 'learning', sentenceId: 'sent-1', segmentId: 'seg-1' },
            ],
          },
          {
            id: 'sent-2',
            order: 1,
            text: 'The morning is quiet.',
            translationVi: 'Buổi sáng thật yên tĩnh.',
            tokens: [
              { raw: 'The', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
              { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'mastered', sentenceId: 'sent-2', segmentId: 'seg-1' },
              { raw: 'is', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
              { raw: 'quiet', isTarget: false, sentenceId: 'sent-2', segmentId: 'seg-1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const countPill = screen.getByTestId('reader-sentence-count-pill');
      expect(countPill).toBeInTheDocument();
      expect(countPill).toHaveAttribute('aria-label', 'Tổng số câu trong bài đọc');
      expect(countPill).toHaveTextContent('📄 2 câu trong bài');
    });
  });

  describe('2. Item #2: Semantic Contrast & Antonym Guidance in beginnerLexicon & Inspector', () => {
    it('returns semantic contrast / antonym tip for recognized vocabulary and default fallback', () => {
      const morningTip = getSemanticContrastTip('morning');
      expect(morningTip).toContain('evening');

      const hotTip = getSemanticContrastTip('hot');
      expect(hotTip).toContain('cold');

      const fallbackTip = getSemanticContrastTip('nonexistentword123');
      expect(fallbackTip).toContain('Liên kết ngữ nghĩa');
    });

    it('renders semantic contrast tip in Word Inspector when learner taps a word', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w12-contrast',
        title: 'Contrast Test',
        level: 'A1',
        wordCount: 3,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-c1',
            order: 0,
            segmentType: 'paragraph',
            text: 'Good morning tea.',
            sentences: [
              {
                id: 'sent-c1',
                order: 0,
                text: 'Good morning tea.',
                translationVi: 'Trà buổi sáng.',
                tokens: [
                  { raw: 'Good', isTarget: false, sentenceId: 'sent-c1', segmentId: 'seg-c1' },
                  { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'learning', sentenceId: 'sent-c1', segmentId: 'seg-c1' },
                  { raw: 'tea', isTarget: false, sentenceId: 'sent-c1', segmentId: 'seg-c1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-c1',
            order: 0,
            text: 'Good morning tea.',
            translationVi: 'Trà buổi sáng.',
            tokens: [
              { raw: 'Good', isTarget: false, sentenceId: 'sent-c1', segmentId: 'seg-c1' },
              { raw: 'morning', isTarget: true, conceptId: 'c-morning', status: 'learning', sentenceId: 'sent-c1', segmentId: 'seg-c1' },
              { raw: 'tea', isTarget: false, sentenceId: 'sent-c1', segmentId: 'seg-c1' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const tokenButton = screen.getByRole('button', { name: /morning/i });
      fireEvent.click(tokenButton);

      const contrastNote = screen.getByTestId('inspector-semantic-contrast');
      expect(contrastNote).toBeInTheDocument();
      expect(contrastNote).toHaveTextContent(/evening/);
    });
  });

  describe('3. Item #3: ReviewSession Exercise Mode Guidance Banner', () => {
    it('renders guidance banner and updates pedagogical tip when switching exercise modes', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-w12-review',
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

      const guidance = screen.getByTestId('review-mode-guidance');
      expect(guidance).toBeInTheDocument();
      expect(guidance).toHaveAttribute('aria-label', 'Hướng dẫn phương pháp theo chế độ ôn tập');
      expect(guidance).toHaveTextContent(/Nhẩm nghĩa và đọc to câu ví dụ trước khi lật đáp án/);

      // Switch to Cloze mode
      const clozeButton = screen.getByRole('button', { name: /Điền từ/i });
      fireEvent.click(clozeButton);
      expect(guidance).toHaveTextContent(/Đọc cả câu ngữ cảnh để suy luận từ vựng còn khuyết/);

      // Switch to Typing mode
      const typingButton = screen.getByRole('button', { name: /Gõ từ/i });
      fireEvent.click(typingButton);
      expect(guidance).toHaveTextContent(/Gõ chính xác từng chữ cái để rèn trí nhớ cơ tay/);

      // Switch back to Self recall / Flashcard mode
      const flashcardButton = screen.getByRole('button', { name: /Thẻ lật/i });
      fireEvent.click(flashcardButton);
      expect(guidance).toHaveTextContent(/Nhẩm nghĩa và đọc to câu ví dụ trước khi lật đáp án/);
    });
  });

  describe('4. Item #4: Language Brain Mastered Concept Percentage Badge', () => {
    it('renders mastered concepts percentage badge calculated from nodes', () => {
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

      const masteryBadge = screen.getByTestId('brain-mastery-percent-badge');
      expect(masteryBadge).toBeInTheDocument();
      expect(masteryBadge).toHaveAttribute('aria-label', 'Tỷ lệ làm chủ mạng lưới khái niệm');
      // 1 out of 2 nodes mastered = 50%
      expect(masteryBadge).toHaveTextContent('🏆 Làm chủ: 50% mạng lưới');
    });
  });

  describe('5. Item #5: Dictionary Contextual Practice Reader Link', () => {
    it('renders practice in reader button and triggers navigation to /read', () => {
      render(<DictionaryView />);

      const practiceBtn = screen.getByTestId('dictionary-practice-reader-link');
      expect(practiceBtn).toBeInTheDocument();
      expect(practiceBtn).toHaveAttribute('aria-label', 'Chuyển sang bài đọc ngữ cảnh để thực hành từ vựng');
      expect(practiceBtn).toHaveTextContent('📖 Luyện đọc ngữ cảnh');

      fireEvent.click(practiceBtn);
      expect(navEvents).toContainEqual({ path: '/read' });
    });
  });

  describe('6. Item #6: Library Due-for-Review Quick Filter Toggle', () => {
    it('renders due-only toggle button and filters concepts needing review', () => {
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
          canonicalForm: 'perseverance',
          meaningVi: 'sự kiên trì',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'learning',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const toggleBtn = screen.getByTestId('library-due-only-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
      expect(toggleBtn).toHaveTextContent('⏰ Lọc từ cần ôn');

      // Both items are initially visible
      expect(screen.getByText('tea')).toBeInTheDocument();
      expect(screen.getByText('perseverance')).toBeInTheDocument();

      // Click to filter due only (non-mastered items)
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
      expect(toggleBtn).toHaveTextContent('⏰ Đang lọc: Cần ôn');

      expect(screen.queryByText('tea')).not.toBeInTheDocument();
      expect(screen.getByText('perseverance')).toBeInTheDocument();

      // Toggle off
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('tea')).toBeInTheDocument();
    });
  });

  describe('7. Item #7: Today Dashboard Completed Activity Ratio Pill', () => {
    it('renders completed activities ratio pill in today plan aside', () => {
      render(<TodayDashboard forcedState="success" />);

      const ratioPill = screen.getByTestId('today-activity-ratio-pill');
      expect(ratioPill).toBeInTheDocument();
      expect(ratioPill).toHaveAttribute('aria-label', 'Số nhiệm vụ đã hoàn thành trong ngày');
      expect(ratioPill).toHaveTextContent(/✅ Hoàn tất \d+\/\d+ nhiệm vụ/);
    });
  });

  describe('8. Item #8: ProgressAnalytics Solidified Words vs Target Ratio Badge', () => {
    it('renders solidified ratio badge in CEFR milestone section', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 5,
            activeDaysCount: 5,
            weeklyTargetDays: 7,
            totalStudyMinutes: 150,
            newWordsAcquired: 20,
            history7d: [
              { dayLabel: 'T2', minutesSpent: 30, wordsLearned: 4, retentionPercent: 90 },
              { dayLabel: 'T3', minutesSpent: 30, wordsLearned: 4, retentionPercent: 92 },
              { dayLabel: 'T4', minutesSpent: 30, wordsLearned: 4, retentionPercent: 88 },
              { dayLabel: 'T5', minutesSpent: 30, wordsLearned: 4, retentionPercent: 94 },
              { dayLabel: 'T6', minutesSpent: 30, wordsLearned: 4, retentionPercent: 91 },
            ],
            retentionScore: 91,
            wordsSolidified: 42,
          }}
        />
      );

      const ratioBadge = screen.getByTestId('progress-solidified-ratio');
      expect(ratioBadge).toBeInTheDocument();
      expect(ratioBadge).toHaveAttribute('aria-label', 'Tỷ lệ tích lũy từ vựng bền vững');
      expect(ratioBadge).toHaveTextContent(/📚 Tích lũy bền vững: 42\/\d+ từ/);
    });
  });

  describe('9. Item #9: Profile Open Language Brain Link', () => {
    it('renders open brain link in memory overview card and navigates to /brain', () => {
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

      const brainLink = screen.getByTestId('profile-open-brain-link');
      expect(brainLink).toBeInTheDocument();
      expect(brainLink).toHaveAttribute('aria-label', 'Mở bản đồ mạng lưới từ vựng Language Brain');
      expect(brainLink).toHaveTextContent('🧠 Mở bản đồ Language Brain');

      fireEvent.click(brainLink);
      expect(navEvents).toContainEqual({ path: '/brain' });
    });
  });

  describe('10. Item #10: Onboarding Diagnostic Question Skill Category Tag', () => {
    it('renders skill category tag in active question header', () => {
      render(<OnboardingDiagnostic />);

      const categoryTag = screen.getByTestId('onboarding-question-category-tag');
      expect(categoryTag).toBeInTheDocument();
      expect(categoryTag).toHaveAttribute('aria-label', 'Nhóm kỹ năng của câu hỏi chẩn đoán');
      expect(categoryTag).toHaveTextContent('🎯 Kỹ năng: Đọc hiểu & Ngữ cảnh');
    });
  });
});
