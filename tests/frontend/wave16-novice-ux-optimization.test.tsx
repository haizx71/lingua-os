import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import {
  getFalseFriendTrap,
  getWordFamilyHint,
} from '../../apps/web/src/features/read/beginnerLexicon';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import { defaultBrainNodes, type BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 16 Zero-English Novice UX Optimization Test Suite (Cycle 3 of 5)', () => {
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

  describe('1. Item #1: InteractiveReader CEFR Beginner Label & Differentiated Pace Meter', () => {
    it('renders reader-cefr-beginner-label and clarified pace meter in header', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w16-beginner',
        title: 'Morning Routine',
        level: 'A1',
        wordCount: 12,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I wake up early in the morning and drink a cup of tea.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I wake up early in the morning and drink a cup of tea.',
                translationVi: 'Tôi thức dậy sớm vào buổi sáng và uống một tách trà.',
                tokens: [
                  { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'wake ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'up ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'early ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'in ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'the ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'morning ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'and ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'drink ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'a ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'cup ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'of ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'tea.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I wake up early in the morning and drink a cup of tea.',
            translationVi: 'Tôi thức dậy sớm vào buổi sáng và uống một tách trà.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const levelLabel = screen.getByTestId('reader-cefr-beginner-label');
      expect(levelLabel).toBeInTheDocument();
      expect(levelLabel).toHaveTextContent('A1 · Cơ bản cho người mới');

      const paceMeter = screen.getByTestId('wave10-reader-wpm-meter');
      expect(paceMeter).toBeInTheDocument();
      expect(paceMeter).toHaveTextContent(/Nhịp đọc gợi ý cho người mới/i);
    });
  });

  describe('2. Item #2: beginnerLexicon Plain Vietnamese Translations for Word Family & False Friends', () => {
    it('uses (Từ cùng gốc) instead of (Word family) and (Từ dễ nhầm nghĩa) instead of (False Friend)', () => {
      const wordFamilySchedule = getWordFamilyHint('schedule');
      expect(wordFamilySchedule).toContain('(Từ cùng gốc)');
      expect(wordFamilySchedule).not.toContain('(Word family)');

      const wordFamilyAppointment = getWordFamilyHint('appointment');
      expect(wordFamilyAppointment).toContain('(Từ cùng gốc)');
      expect(wordFamilyAppointment).not.toContain('(Word family)');

      const falseFriendActually = getFalseFriendTrap('actually');
      expect(falseFriendActually).toContain('(Từ dễ nhầm nghĩa)');
      expect(falseFriendActually).not.toContain('(False Friend)');

      const falseFriendEventually = getFalseFriendTrap('eventually');
      expect(falseFriendEventually).toContain('(Từ dễ nhầm nghĩa)');
      expect(falseFriendEventually).not.toContain('(False Friend)');
    });
  });

  describe('3. Item #3: ReviewSession Shortcut Badges on Rating Buttons', () => {
    it('renders shortcut key badges [Phím 1] through [Phím 4] on rating buttons after revealing answer', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-w16-1',
          term: 'tea',
          meaningVi: 'trà',
          ipa: '/tiː/',
          partOfSpeech: 'noun',
          exampleSentence: 'I drink green tea.',
          exampleTranslation: 'Tôi uống trà xanh.',
          currentIntervalDays: 1,
          stability: 2.5,
          difficulty: 3.0,
          reps: 2,
          lapses: 0,
        },
      ];

      render(<ReviewSession initialQueue={mockQueue} />);

      // Reveal answer
      const revealBtn = screen.getByRole('button', { name: /Hiện đáp án/i });
      fireEvent.click(revealBtn);

      // Verify key badges
      expect(screen.getByTestId('review-key-badge-again')).toHaveTextContent('[Phím 1]');
      expect(screen.getByTestId('review-key-badge-hard')).toHaveTextContent('[Phím 2]');
      expect(screen.getByTestId('review-key-badge-good')).toHaveTextContent('[Phím 3]');
      expect(screen.getByTestId('review-key-badge-easy')).toHaveTextContent('[Phím 4]');

      // Verify button accessible names remain intact
      expect(screen.getByRole('button', { name: /Quên \(Again\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Khó \(Hard\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tốt \(Good\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dễ \(Easy\)/i })).toBeInTheDocument();
    });
  });

  describe('4. Item #4: TodayDashboard Priority Step Callout for Beginners', () => {
    it('renders today-step-priority callout on incomplete activity cards', () => {
      render(
        <TodayDashboard
          initialPlan={{
            id: 'plan-w16-test',
            languageProfileId: 'lp-w16-test',
            planDate: '2026-10-29',
            timeZone: 'Asia/Ho_Chi_Minh',
            targetMinutes: 25,
            completedMinutes: 0,
            status: 'active',
            engineVersion: 'today-v1',
            progressPercent: 0,
            isCompleted: false,
            completedActivitiesCount: 0,
            totalActivitiesCount: 1,
            activities: [
              {
                id: 'act-1',
                position: 0,
                type: 'review',
                title: 'Ôn tập thẻ ghi nhớ',
                description: 'Ôn các từ vựng đang đến hạn.',
                durationMinutes: 10,
                badgeLabel: 'Cần ôn',
                badgeVariant: 'warning',
                reasonCodes: ['FSRS_DUE'],
                reasonText: 'FSRS phát hiện từ sắp quên.',
                targetUrl: '/review',
                status: 'pending',
                completed: false,
              },
            ],
          }}
          forcedState="success"
        />
      );

      const priorityBadge = screen.getByTestId('today-step-priority-act-1');
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveTextContent(/👉 Bước chính: Bấm .*Bắt đầu.* để vào bài học/);
    });
  });

  describe('5. Item #5: LanguageBrainCanvas Remediation Advice Plain Vietnamese', () => {
    it('uses Vietnamese descriptions instead of English exam jargon in remediation advice', () => {
      const customNodes: BrainNodeItem[] = [
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-listen-weak',
          label: 'listening-weak-term',
          lemma: 'listening-weak-term',
          recognitionScore: 90,
          listeningScore: 20,
          productionScore: 80,
        },
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-prod-weak',
          label: 'production-weak-term',
          lemma: 'production-weak-term',
          recognitionScore: 90,
          listeningScore: 90,
          productionScore: 20,
        },
      ];

      render(<LanguageBrainCanvas initialNodes={customNodes} />);

      // Select listening-weak concept
      fireEvent.click(screen.getByText('listening-weak-term'));
      expect(screen.getByText('Gợi ý ôn tập trọng tâm')).toBeInTheDocument();
      expect(screen.getByText(/Nghe câu & Điền từ còn thiếu/i)).toBeInTheDocument();
      expect(screen.queryByText(/Listening \/ Cloze/i)).not.toBeInTheDocument();

      // Select production-weak concept
      fireEvent.click(screen.getByText('production-weak-term'));
      expect(screen.getByText('Gợi ý ôn tập trọng tâm')).toBeInTheDocument();
      expect(screen.getByText(/Tự nhớ lại & Gõ từ vựng/i)).toBeInTheDocument();
      expect(screen.queryByText(/Production \/ Typing/i)).not.toBeInTheDocument();
    });
  });

  describe('6. Item #6: DictionaryView Complexity Label & Empty Related Words Copy', () => {
    it('renders Từ dài (Đọc chậm từng âm) and friendly empty related copy', async () => {
      const mockApi: any = {
        searchDictionary: vi.fn().mockResolvedValue({
          data: [],
          lemmaGroups: [
            {
              lexemeId: 'lex-rec-1',
              lemma: 'recommendation',
              partOfSpeech: 'noun',
              matchedForms: ['recommendation'],
              senses: [
                {
                  senseId: 'sense-rec-1',
                  definition: 'A suggestion.',
                  translatedDefinition: 'Lời đề xuất.',
                  concepts: [],
                },
              ],
            },
          ],
        }),
      };

      render(<DictionaryView apiClient={mockApi} />);

      // Words over 8 characters (e.g. appointment) display "Từ dài (Đọc chậm từng âm)"
      const initialLabels = screen.getAllByText('Từ dài (Đọc chậm từng âm)');
      expect(initialLabels.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Đa âm tiết')).not.toBeInTheDocument();

      // Trigger search that yields lemmaGroup with empty concepts
      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'recommendation' } });

      const emptyRelatedEl = await screen.findByText('Chưa có từ liên quan mở rộng cho mục này.');
      expect(emptyRelatedEl).toBeInTheDocument();
      expect(screen.queryByText('Chưa có khái niệm liên kết được duyệt.')).not.toBeInTheDocument();
    });
  });

  describe('7. Item #7: LibraryView Vietnamese Meaning on Saved Concept Cards', () => {
    it('renders library-concept-meaning-vi on concept cards', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'lib-concept-1',
          itemType: 'concept',
          canonicalForm: 'tea',
          meaningVi: 'trà',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const meaningEl = screen.getByTestId('library-concept-meaning-vi');
      expect(meaningEl).toBeInTheDocument();
      expect(meaningEl).toHaveTextContent(/🇻🇳 Nghĩa:/);
      expect(meaningEl).toHaveTextContent('trà');
    });
  });

  describe('8. Item #8: ProgressAnalytics Retention Practical Meaning Callout', () => {
    it('explains retention rate in everyday practical terms', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            wordsSolidified: 20,
            history7d: [
              { dayLabel: 'T2', retentionPercent: 85, minutesSpent: 15 },
              { dayLabel: 'T3', retentionPercent: 85, minutesSpent: 20 },
            ],
          }}
        />
      );

      const practicalMeaning = screen.getByTestId('progress-retention-practical-meaning');
      expect(practicalMeaning).toBeInTheDocument();
      expect(practicalMeaning).toHaveTextContent(/cứ 10 từ đã học thì bạn nhớ vững khoảng/i);
    });
  });

  describe('9. Item #9: ProfileView Achievement Progress & SettingsView Storage Reassurance', () => {
    it('renders profile achievement progress text and friendly vocabulary copy', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'An Nguyen',
            email: 'an@example.test',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 25,
            totalConceptsMastered: 12,
            streakDays: 4,
          }}
        />
      );

      const masterProgress = screen.getByTestId('profile-badge-progress-master-20');
      expect(masterProgress).toBeInTheDocument();
      expect(masterProgress).toHaveTextContent('12/20 từ');

      const solidProgress = screen.getByTestId('profile-badge-progress-solid-10');
      expect(solidProgress).toBeInTheDocument();
      expect(solidProgress).toHaveTextContent('10/10 từ');

      const achievementsGrid = screen.getByTestId('profile-achievements-grid');
      expect(achievementsGrid).toHaveTextContent('từ vựng tiếng Anh');
      expect(achievementsGrid).not.toHaveTextContent('khái niệm ngôn ngữ');
    });

    it('renders settings storage reassurance banner note', () => {
      render(<SettingsView />);

      const reassurance = screen.getByTestId('settings-storage-reassurance');
      expect(reassurance).toBeInTheDocument();
      expect(reassurance).toHaveTextContent(
        /Các tùy chọn giọng đọc, tốc độ nghe và cỡ chữ vẫn được giữ tự động trên trình duyệt của máy này/
      );
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Concrete Day-1 Study Tip', () => {
    it('renders onboarding-day1-tip on completion card', () => {
      render(<OnboardingDiagnostic />);

      // Jump to completion screen via beginner bypass
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      const day1Tip = screen.getByTestId('onboarding-day1-tip');
      expect(day1Tip).toBeInTheDocument();
      expect(day1Tip).toHaveTextContent(
        '💡 Cách học mỗi ngày: Chỉ cần bấm nghe phát âm, xem nghĩa tiếng Việt và chọn mức độ nhớ — hệ thống sẽ tự nhắc lại đúng lúc bạn sắp quên.'
      );
    });
  });
});
