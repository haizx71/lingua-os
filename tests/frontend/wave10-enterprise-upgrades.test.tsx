import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApiClient, LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { getWordFamilyHint } from '../../apps/web/src/features/read/beginnerLexicon';
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

describe('Wave 10 Enterprise Language Platform Upgrades Test Suite', () => {
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

  describe('1. Item #1: InteractiveReader Saved Sentence Counter Badge', () => {
    it('renders initial saved sentences counter badge and updates on save', async () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w10',
        title: 'Morning Routine',
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

      const mockApiClient: Partial<ApiClient> = {
        saveReaderSentence: vi.fn().mockResolvedValue({
          data: { isSaved: true },
        }),
      };

      render(<InteractiveReader passage={passage} apiClient={mockApiClient as ApiClient} />);

      // Invariant READ-LIVE-08: no localStorage write on mount
      expect(window.localStorage.getItem('lingua-reader-theme')).toBeNull();

      const counterBadge = screen.getByTestId('reader-saved-sentences-count');
      expect(counterBadge).toBeInTheDocument();
      expect(counterBadge).toHaveAttribute('aria-label', 'Số câu đã lưu trong bài đọc');
      expect(counterBadge).toHaveTextContent('📌 Đã lưu 0 câu');

      // Click save sentence button
      const saveBtn = screen.getByRole('button', { name: 'Lưu câu 1' });
      fireEvent.click(saveBtn);

      expect(await screen.findByRole('button', { name: 'Câu 1 đã lưu' })).toBeInTheDocument();
      expect(counterBadge).toHaveTextContent('📌 Đã lưu 1 câu');
    });
  });

  describe('2. Item #2: Word Family Derivatives in beginnerLexicon & Word Inspector', () => {
    it('returns morphological word family hints and renders callout in Word Inspector', () => {
      expect(getWordFamilyHint('tea')).toContain('teapot');
      expect(getWordFamilyHint('schedule')).toContain('scheduled');
      expect(getWordFamilyHint('appointment')).toContain('appoint');
      expect(getWordFamilyHint('work')).toContain('worker');
      expect(getWordFamilyHint('unknownword')).toContain('Họ từ & biến thể');

      const passage: ReaderPassageViewModel = {
        id: 'passage-family',
        title: 'Word Family Pilot',
        level: 'A2',
        wordCount: 2,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-wf',
            order: 0,
            segmentType: 'paragraph',
            text: 'Drink tea.',
            sentences: [
              {
                id: 'sent-wf',
                order: 0,
                text: 'Drink tea.',
                translationVi: 'Uống trà.',
                tokens: [
                  { raw: 'Drink', isTarget: false, sentenceId: 'sent-wf', segmentId: 'seg-wf' },
                  { raw: 'tea', isTarget: true, conceptId: 'c-tea-wf', status: 'learning', sentenceId: 'sent-wf', segmentId: 'seg-wf' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-wf',
            order: 0,
            text: 'Drink tea.',
            translationVi: 'Uống trà.',
            tokens: [
              { raw: 'Drink', isTarget: false, sentenceId: 'sent-wf', segmentId: 'seg-wf' },
              { raw: 'tea', isTarget: true, conceptId: 'c-tea-wf', status: 'learning', sentenceId: 'sent-wf', segmentId: 'seg-wf' },
            ],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const teaBtn = screen.getByRole('button', { name: 'tea' });
      fireEvent.click(teaBtn);

      const familyCallout = screen.getByTestId('inspector-word-family');
      expect(familyCallout).toBeInTheDocument();
      expect(familyCallout).toHaveTextContent(/teapot/);
      expect(familyCallout).toHaveTextContent(/teacup/);
    });
  });

  describe('3. Item #3: ReviewSession Smart Pace & Rhythm Indicator', () => {
    it('renders calm review pace indicator pill in ReviewSession toolbar', () => {
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

      const paceIndicator = screen.getByTestId('review-pace-indicator');
      expect(paceIndicator).toBeInTheDocument();
      expect(paceIndicator).toHaveAttribute('aria-label', 'Nhịp độ phản xạ khuyến nghị');
      expect(paceIndicator).toHaveTextContent('⏱️ Nhịp chuẩn: ~8s/thẻ');
    });
  });

  describe('4. Item #4: Language Brain Quick Concept Search Input', () => {
    it('renders quick search input and filters nodes by term or meaning', () => {
      const mockNodes: BrainNodeItem[] = [
        { id: 'n1', term: 'cat', meaningVi: 'con mèo', cefr: 'A1', status: 'mastered', encounterCount: 5, recallScore: 1, relatedIds: [] },
        { id: 'n2', term: 'travel', meaningVi: 'du lịch', cefr: 'A2', status: 'learning', encounterCount: 3, recallScore: 0.7, relatedIds: [] },
        { id: 'n3', term: 'schedule', meaningVi: 'lịch trình', cefr: 'B1', status: 'learning', encounterCount: 2, recallScore: 0.6, relatedIds: [] },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      const searchInput = screen.getByTestId('brain-node-search');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('aria-label', 'Tìm nhanh khái niệm trong mạng lưới');

      // Initial: all items present
      expect(screen.getByText('cat')).toBeInTheDocument();
      expect(screen.getByText('travel')).toBeInTheDocument();
      expect(screen.getByText('schedule')).toBeInTheDocument();

      // Filter by Vietnamese meaning
      fireEvent.change(searchInput, { target: { value: 'mèo' } });
      expect(screen.getByText('cat')).toBeInTheDocument();
      expect(screen.queryByText('travel')).not.toBeInTheDocument();
      expect(screen.queryByText('schedule')).not.toBeInTheDocument();

      // Filter by English term
      fireEvent.change(searchInput, { target: { value: 'travel' } });
      expect(screen.queryByText('cat')).not.toBeInTheDocument();
      expect(screen.getByText('travel')).toBeInTheDocument();
      expect(screen.queryByText('schedule')).not.toBeInTheDocument();
    });
  });

  describe('5. Item #5: Dictionary 1-Click Copy Term & IPA Button', () => {
    it('renders 1-click copy button and copies text to clipboard', async () => {
      render(<DictionaryView />);

      const copyBtns = screen.getAllByTestId('dictionary-copy-term');
      expect(copyBtns.length).toBeGreaterThan(0);

      const firstBtn = copyBtns[0];
      expect(firstBtn).toHaveTextContent('📋 Sao chép từ');

      fireEvent.click(firstBtn);
      expect(clipboardSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(firstBtn).toHaveTextContent('Đã sao chép');
      });
    });
  });

  describe('6. Item #6: Library Saved Item Type Breakdown Pill', () => {
    it('renders item type counts pill summarizing concepts, sentences, and passages', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'c1',
          itemType: 'concept',
          canonicalForm: 'tea',
          meaningVi: 'trà',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
        {
          id: 'c2',
          itemType: 'concept',
          canonicalForm: 'coffee',
          meaningVi: 'cà phê',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'learning',
        },
        {
          id: 's1',
          itemType: 'sentence',
          text: 'I drink tea.',
          translationVi: 'Tôi uống trà.',
          savedAt: '2026-10-28T00:00:00Z',
        },
        {
          id: 'p1',
          itemType: 'passage',
          title: 'Tea Culture',
          sourceSnippet: 'Tea has a long history...',
          savedAt: '2026-10-28T00:00:00Z',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const typeCounts = screen.getByTestId('library-type-counts');
      expect(typeCounts).toBeInTheDocument();
      expect(typeCounts).toHaveAttribute('aria-label', 'Thống kê số lượng mục đã lưu theo phân loại');
      expect(typeCounts).toHaveTextContent(/2 từ vựng/);
      expect(typeCounts).toHaveTextContent(/1 câu/);
      expect(typeCounts).toHaveTextContent(/1 bài đọc/);
    });
  });

  describe('7. Item #7: Today Dashboard Quick Review Link Jump', () => {
    it('renders quick review button in Today Dashboard goal card', () => {
      render(<TodayDashboard forcedState="success" />);

      const quickReviewLink = screen.getByTestId('today-quick-review-link');
      expect(quickReviewLink).toBeInTheDocument();
      expect(quickReviewLink).toHaveAttribute('aria-label', 'Mở nhanh phiên ôn tập thẻ nhớ đến hạn');
      expect(quickReviewLink).toHaveTextContent('⚡ Ôn nhanh thẻ đến hạn');
    });
  });

  describe('8. Item #8: ProgressAnalytics Peak Study Day Highlight Badge', () => {
    it('renders best study day record badge computed from study history', () => {
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
              { dayLabel: 'T3', minutesSpent: 45, wordsLearned: 4, retentionPercent: 88 },
              { dayLabel: 'T4', minutesSpent: 30, wordsLearned: 5, retentionPercent: 92 },
              { dayLabel: 'T5', minutesSpent: 25, wordsLearned: 3, retentionPercent: 89 },
            ],
            retentionScore: 90,
            wordsSolidified: 25,
          }}
        />
      );

      const bestDayBadge = screen.getByTestId('progress-best-day-badge');
      expect(bestDayBadge).toBeInTheDocument();
      expect(bestDayBadge).toHaveAttribute('aria-label', 'Kỷ lục thời lượng học cao nhất trong ngày');
      expect(bestDayBadge).toHaveTextContent('🏆 Kỷ lục ngày: 45 phút');
    });
  });

  describe('9. Item #9: ProfileView CEFR Capability Descriptor Callout', () => {
    it('renders appropriate Vietnamese capability descriptor according to CEFR level', () => {
      const { rerender } = render(
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

      const cefrDescriptorB1 = screen.getByTestId('profile-cefr-descriptor');
      expect(cefrDescriptorB1).toBeInTheDocument();
      expect(cefrDescriptorB1).toHaveAttribute('aria-label', 'Mô tả năng lực giao tiếp theo cấp độ CEFR hiện tại');
      expect(cefrDescriptorB1).toHaveTextContent('💬 Năng lực hiện tại: Đọc hiểu văn bản dài & diễn đạt ý kiến độc lập trong giao tiếp.');

      // Test A2
      rerender(
        <ProfileView
          initialProfile={{
            name: 'Alex Rivera',
            email: 'alex@lingua.app',
            startingLevelEstimate: 'A2',
            totalConceptsEncountered: 20,
            totalConceptsMastered: 5,
            streakDays: 2,
          }}
        />
      );
      expect(screen.getByTestId('profile-cefr-descriptor')).toHaveTextContent('💬 Năng lực hiện tại: Giao tiếp tình huống quen thuộc & đọc hiểu đoạn văn ngắn.');

      // Test A1
      rerender(
        <ProfileView
          initialProfile={{
            name: 'Alex Rivera',
            email: 'alex@lingua.app',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 5,
            totalConceptsMastered: 1,
            streakDays: 1,
          }}
        />
      );
      expect(screen.getByTestId('profile-cefr-descriptor')).toHaveTextContent('💬 Năng lực hiện tại: Giao tiếp câu ngắn cơ bản & làm quen từ vựng cốt lõi.');
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Estimated Time Remaining Pill', () => {
    it('renders estimated time remaining pill on active questions', () => {
      render(<OnboardingDiagnostic />);

      const timeEstimate = screen.getByTestId('onboarding-time-estimate');
      expect(timeEstimate).toBeInTheDocument();
      expect(timeEstimate).toHaveAttribute('aria-label', 'Thời gian ước tính hoàn thành bài chẩn đoán');
      expect(timeEstimate).toHaveTextContent('⏱️ Còn 3 câu (~1 phút)');
    });
  });
});
