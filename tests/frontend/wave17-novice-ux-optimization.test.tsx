import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import {
  getSemanticContrastTip,
  getWordFamilyHint,
  SEMANTIC_CONTRAST_TIPS,
} from '../../apps/web/src/features/read/beginnerLexicon';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { LanguageBrainCanvas, FILTER_OPTIONS } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import { defaultBrainNodes, type BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 17 Zero-English Novice UX Optimization Test Suite (Cycle 4 of 5)', () => {
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

  describe('1. Item #1: InteractiveReader Zen Mode Removal & Visible Save Sentence Label', () => {
    it('removes (Zen Mode) from reader-focus-mode-toggle aria-label and renders visible reader-save-sentence-label', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w17-zen',
        title: 'Morning Walk',
        level: 'A1',
        wordCount: 10,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I drink green tea in the morning.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I drink green tea in the morning.',
                translationVi: 'Tôi uống trà xanh vào buổi sáng.',
                tokens: [
                  { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'drink ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'green ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'tea ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'in ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'the ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'morning.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I drink green tea in the morning.',
            translationVi: 'Tôi uống trà xanh vào buổi sáng.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const toggleBtn = screen.getByTestId('reader-focus-mode-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn.getAttribute('aria-label')).toBe('Bật/tắt chế độ đọc tập trung');
      expect(toggleBtn.getAttribute('aria-label')).not.toContain('Zen Mode');

      const saveSentenceLabel = screen.getByTestId('reader-save-sentence-label');
      expect(saveSentenceLabel).toBeInTheDocument();
      expect(saveSentenceLabel).toHaveTextContent(/📌 Lưu câu/);
    });
  });

  describe('2. Item #2: beginnerLexicon Plain Vietnamese Part-of-Speech & Semantic Theme Headers', () => {
    it('uses Vietnamese pos descriptions (tính từ: theo lịch), các đuôi từ thường gặp, and Cùng chủ đề:', () => {
      const scheduleHint = getWordFamilyHint('schedule');
      expect(scheduleHint).toContain('(tính từ: theo lịch)');
      expect(scheduleHint).not.toContain('(adj - theo lịch)');
      expect(scheduleHint).toContain('(danh từ)');

      const fallbackHint = getWordFamilyHint('unregistered_word');
      expect(fallbackHint).toContain('các đuôi từ thường gặp');
      expect(fallbackHint).not.toContain('các hậu tố thường gặp');

      expect(SEMANTIC_CONTRAST_TIPS.morning).toContain('Cùng chủ đề:');
      expect(SEMANTIC_CONTRAST_TIPS.morning).not.toContain('Cùng trường nghĩa:');

      const morningTip = getSemanticContrastTip('morning');
      expect(morningTip).toContain('Cùng chủ đề:');
    });
  });

  describe('3. Item #3: ReviewSession Vietnamese POS & Friendly FSRS System Title', () => {
    it('renders Vietnamese part of speech badge on review flashcard and friendly FSRS title', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-w17-1',
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

      const posVi = screen.getByTestId('review-card-pos-vi');
      expect(posVi).toBeInTheDocument();
      expect(posVi).toHaveTextContent('(Danh từ)');
      expect(posVi).not.toHaveTextContent('(noun)');
    });
  });

  describe('4. Item #4: TodayDashboard Differentiated Skill Focus & Softened FSRS Reason', () => {
    it('differentiates wave9-today-skill-focus from today-focus-skill-badge and softens FSRS reason text', () => {
      render(
        <TodayDashboard
          initialPlan={{
            id: 'plan-w17-test',
            languageProfileId: 'lp-w17-test',
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
                id: 'act-w17-1',
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

      const skillFocusPill = screen.getByTestId('wave9-today-skill-focus');
      expect(skillFocusPill).toBeInTheDocument();
      expect(skillFocusPill).toHaveTextContent(/🎯 Mục tiêu Trọng tâm hôm nay:/);

      const methodBadge = screen.getByTestId('today-focus-skill-badge');
      expect(methodBadge).toBeInTheDocument();
      expect(methodBadge).toHaveTextContent(/🧭 Phương pháp gợi ý:/);

      expect(screen.getByText(/Hệ thống ghi nhớ phát hiện từ sắp quên \(Cần ôn lại\)\./)).toBeInTheDocument();
      expect(screen.queryByText('FSRS phát hiện từ sắp quên.')).not.toBeInTheDocument();
    });
  });

  describe('5. Item #5: LanguageBrainCanvas Status Filter Clarification & Vietnamese Node POS', () => {
    it('renders Tất cả trạng thái in FILTER_OPTIONS and Vietnamese POS in concept detail', () => {
      const allOption = FILTER_OPTIONS.find((opt) => opt.id === 'ALL');
      expect(allOption).toBeDefined();
      expect(allOption?.label).toBe('Tất cả trạng thái');

      const customNodes: BrainNodeItem[] = [
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-test-pos',
          label: 'schedule',
          lemma: 'schedule',
          pos: 'noun',
          ipa: '/ˈskedʒ.uːl/',
        },
      ];

      render(<LanguageBrainCanvas initialNodes={customNodes} />);

      // Verify the filter prefix and button
      expect(screen.getByTestId('brain-status-filter-prefix')).toHaveTextContent('Trạng thái:');
      expect(screen.getByRole('button', { name: 'Tất cả trạng thái' })).toBeInTheDocument();

      // Click node to open detail
      fireEvent.click(screen.getByText('schedule'));

      const posViBadge = screen.getByTestId('brain-selected-pos-vi');
      expect(posViBadge).toBeInTheDocument();
      expect(posViBadge).toHaveTextContent('Danh từ');
    });
  });

  describe('6. Item #6: DictionaryView Slow Audio Label & Matched Forms Heading', () => {
    it('renders để nghe rõ từng âm tiết on 0.5x audio button and Các dạng của từ: label', async () => {
      const mockApi: any = {
        searchDictionary: vi.fn().mockResolvedValue({
          data: [],
          lemmaGroups: [
            {
              lexemeId: 'lex-sched-1',
              lemma: 'schedule',
              partOfSpeech: 'noun',
              matchedForms: ['schedule', 'scheduled', 'schedules'],
              senses: [
                {
                  senseId: 'sense-sched-1',
                  definition: 'A plan.',
                  translatedDefinition: 'Lịch trình.',
                  concepts: [],
                },
              ],
            },
          ],
        }),
      };

      render(<DictionaryView apiClient={mockApi} />);

      const slowAudioButtons = screen.getAllByTestId('dictionary-slow-audio-05');
      expect(slowAudioButtons.length).toBeGreaterThanOrEqual(1);
      expect(slowAudioButtons[0]?.getAttribute('aria-label')).toContain('để nghe rõ từng âm tiết');
      expect(slowAudioButtons[0]?.getAttribute('aria-label')).not.toContain('để phân tích âm vị');

      // Trigger search to populate lemmaGroups
      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'schedule' } });

      const matchedFormsLabel = await screen.findByTestId('dictionary-matched-forms-label');
      expect(matchedFormsLabel).toBeInTheDocument();
      expect(matchedFormsLabel).toHaveTextContent('Các dạng của từ:');
    });
  });

  describe('7. Item #7: LibraryView Vietnamese Action Buttons with Reader & Brain Substrings', () => {
    it('renders 📖 Mở bài đọc on content cards and 🧠 Xem bản đồ từ on concept cards', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'lib-content-1',
          itemType: 'content',
          title: 'Morning Routine',
          level: 'A1',
          sourceUrl: '/read?contentId=lib-content-1',
          estimatedMinutes: 5,
        },
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

      const openReaderBtn = screen.getByTestId('library-open-reader-btn');
      expect(openReaderBtn).toBeInTheDocument();
      expect(openReaderBtn).toHaveTextContent(/📖 Mở bài đọc/);
      expect(openReaderBtn).toHaveTextContent(/Reader/);

      const openBrainBtn = screen.getByTestId('library-open-brain-btn');
      expect(openBrainBtn).toBeInTheDocument();
      expect(openBrainBtn).toHaveTextContent(/🧠 Xem bản đồ từ/);
      expect(openBrainBtn).toHaveTextContent(/Brain/);
    });
  });

  describe('8. Item #8: ProgressAnalytics Vietnamese CEFR Milestones & Phút in Best Day Badge', () => {
    it('renders Vietnamese milestone names and phút instead of m in best-day badge', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            wordsSolidified: 25,
            history7d: [
              { dayLabel: 'T2', retentionPercent: 90, minutesSpent: 15 },
              { dayLabel: 'T3', retentionPercent: 92, minutesSpent: 30 },
            ],
          }}
        />
      );

      // Cột mốc tiếp theo có tên tiếng Việt
      const milestoneHeadings = screen.getAllByText(/A1 Căn bản \(Beginner\)/);
      expect(milestoneHeadings.length).toBeGreaterThanOrEqual(1);

      const bestDayBadge = screen.getByTestId('progress-best-day-badge');
      expect(bestDayBadge).toBeInTheDocument();
      expect(bestDayBadge).toHaveTextContent(/30 phút/);
      expect(bestDayBadge).not.toHaveTextContent(/30m/);
    });
  });

  describe('9. Item #9: ProfileView Pace Scale Labels, Solidified Note & Settings Budget Note', () => {
    it('renders 10 phút, 20 phút, 45 phút in profile-pace-scale and solidified explanation note', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Minh Chau',
            email: 'chau@example.test',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 30,
            totalConceptsMastered: 15,
            streakDays: 5,
          }}
        />
      );

      const paceScale = screen.getByTestId('profile-pace-scale');
      expect(paceScale).toBeInTheDocument();
      expect(paceScale).toHaveTextContent('Thong thả: 10 phút');
      expect(paceScale).toHaveTextContent('Đều đặn: 20 phút');
      expect(paceScale).toHaveTextContent('Tập trung: 45 phút');
      expect(paceScale).not.toHaveTextContent('10p');
      expect(paceScale).not.toHaveTextContent('20p');
      expect(paceScale).not.toHaveTextContent('45p');

      const note = screen.getByTestId('profile-solidified-beginner-note');
      expect(note).toBeInTheDocument();
      expect(note).toHaveTextContent(
        '💡 Giải thích: “Đã củng cố” là những từ vựng tiếng Anh bạn đã ôn lại nhiều lần và nhớ chắc chắn trong trí nhớ dài hạn.'
      );
    });

    it('renders settings-budget-beginner-note and updated accent title in SettingsView', () => {
      render(<SettingsView />);

      const budgetNote = screen.getByTestId('settings-budget-beginner-note');
      expect(budgetNote).toBeInTheDocument();
      expect(budgetNote).toHaveTextContent(
        '💡 Giải thích: Số lượng từ tiếng Anh mới tối đa bạn muốn học thêm mỗi ngày (chỉ tiêu học tập, không phải chi phí tiền bạc).'
      );

      const accentSelector = screen.getByTestId('settings-accent-selector');
      expect(accentSelector).toBeInTheDocument();
      expect(accentSelector).toHaveTextContent('Giọng phát âm ưu tiên (Chuẩn Anh-Mỹ hoặc Anh-Anh)');
      expect(accentSelector).not.toHaveTextContent('Giọng phát âm ưu tiên (Accent)');
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Vietnamese Level Label on Completion Card', () => {
    it('renders onboarding-level-label-vi with friendly Vietnamese description on completion card', () => {
      render(<OnboardingDiagnostic />);

      // Jump to completion screen via beginner bypass
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      const levelLabel = screen.getByTestId('onboarding-level-label-vi');
      expect(levelLabel).toBeInTheDocument();
      expect(levelLabel).toHaveTextContent('A1 Cơ bản (Dành cho người mới bắt đầu)');
      expect(levelLabel).not.toHaveTextContent('A1 Beginner (Lộ trình cho người mất gốc)');
    });
  });
});
