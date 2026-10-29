import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { mockApiResponses } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import {
  getSemanticContrastTip,
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

describe('Wave 18 Zero-English Novice UX Optimization Test Suite (Cycle 5 of 5 — Final)', () => {
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
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  describe('1. Item #1: InteractiveReader Word Inspector English Definition & Saved Status Label', () => {
    it('renders inspector-english-def-summary with advanced reference note and inspector-saved-status-label', async () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w18-inspector',
        title: 'Morning Routine',
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
                  {
                    raw: 'tea ',
                    isTarget: true,
                    conceptId: 'concept-tea-w18',
                    lemma: 'tea',
                    surfaceText: 'tea',
                    meaningVi: 'trà',
                    explanationEn: 'A beverage made by steeping cured leaves in water.',
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
            text: 'I drink green tea in the morning.',
            translationVi: 'Tôi uống trà xanh vào buổi sáng.',
            tokens: [],
          },
        ],
      };

      const mockApi: any = {
        saveConceptToLibrary: vi.fn().mockResolvedValue({
          data: {
            id: 'concept-tea-w18',
            itemType: 'concept',
            canonicalForm: 'tea',
            isSaved: true,
          },
        }),
      };

      render(<InteractiveReader passage={passage} apiClient={mockApi} />);

      // Click token 'tea' to open Word Inspector
      const teaToken = screen.getByText('tea');
      fireEvent.click(teaToken);

      // Verify English definition summary contains advanced reference hint
      const defSummary = screen.getByTestId('inspector-english-def-summary');
      expect(defSummary).toBeInTheDocument();
      expect(defSummary).toHaveTextContent('Định nghĩa gốc tiếng Anh (Tham khảo nâng cao)');

      // Verify save button transitions to friendly saved status label
      const saveBtn = screen.getByRole('button', { name: /Lưu vào ôn tập/i });
      expect(saveBtn).toBeInTheDocument();
      fireEvent.click(saveBtn);

      const savedStatus = await screen.findByTestId('inspector-saved-status-label');
      expect(savedStatus).toBeInTheDocument();
      expect(savedStatus).toHaveTextContent('Đã lưu vào ôn tập (Kho từ nhớ)');
    });
  });

  describe('2. Item #2: beginnerLexicon Word Family & Antonym Hints', () => {
    it('standardizes tea word family hint to Họ từ (Từ cùng gốc) & từ ghép:', () => {
      const teaHint = getWordFamilyHint('tea');
      expect(teaHint).toContain('Họ từ (Từ cùng gốc) & từ ghép:');
      expect(teaHint).toContain('teapot (ấm trà)');
      expect(teaHint).toContain('teacup (tách trà)');
    });

    it('standardizes morning semantic contrast tip to Từ trái nghĩa: evening / night', () => {
      const morningTip = getSemanticContrastTip('morning');
      expect(morningTip).toContain('Từ trái nghĩa:');
      expect(morningTip).toContain('evening (buổi tối)');
      expect(morningTip).toContain('night (ban đêm)');
      expect(morningTip).toContain('Cùng chủ đề:');
      expect(morningTip).not.toContain('Đối lập ngữ nghĩa:');
    });
  });

  describe('3. Item #3: ReviewSession Total Due Badge & Space Key Clarification', () => {
    it('renders review-total-due-badge and clarifies Phím Cách = Space', async () => {
      const client: any = {
        listReviewQueue: vi.fn().mockResolvedValue({
          data: [
            {
              ...mockApiResponses.reviewQueue.data[0],
              prompt: {
                ...mockApiResponses.reviewQueue.data[0]!.prompt,
                contextSentence: 'I have an appointment with the doctor.',
                translation: 'Tôi có cuộc hẹn với bác sĩ.',
                audioUrl: 'https://cdn.example.test/audio/appointment.mp3',
              },
            },
          ],
          meta: {
            requestId: '00000000-0000-4000-8000-000000000901',
            apiVersion: '1.0',
            hasMore: false,
            nextCursor: null,
            pageSize: 1,
          },
        }),
      };

      render(<ReviewSession apiClient={client} />);

      // Verify total due badge
      const totalDueBadge = await screen.findByTestId('review-total-due-badge');
      expect(totalDueBadge).toBeInTheDocument();
      expect(totalDueBadge).toHaveTextContent(/Tổng cần ôn:\s*\d+\s*thẻ/);

      // Verify keyboard shortcuts help specifies Phím Cách = Space
      const shortcutsHelp = screen.getByTestId('review-shortcuts-help');
      expect(shortcutsHelp).toBeInTheDocument();
      expect(shortcutsHelp).toHaveTextContent('Phím Cách = Space');

      // Verify reveal button clarifies Phím Cách / Space
      const revealBtn = screen.getByRole('button', { name: /Hiện đáp án/i });
      expect(revealBtn).toHaveTextContent(/Hiện đáp án.*\(Phím Cách \/ Space\)/);
    });
  });

  describe('4. Item #4: TodayDashboard Priority Step with Blue Button Text Match', () => {
    it('renders priority step message guiding novice users to blue start button', () => {
      render(
        <TodayDashboard
          initialPlan={{
            id: 'plan-w18-today',
            languageProfileId: 'lp-w18-today',
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
                type: 'read',
                title: 'Bài đọc buổi sáng',
                description: 'Đọc đoạn hội thoại ngắn.',
                durationMinutes: 10,
                badgeLabel: 'Mới',
                badgeVariant: 'primary',
                reasonCodes: ['SCHEDULED'],
                reasonText: 'Bài đọc theo kế hoạch.',
                targetUrl: '/read',
                status: 'pending',
                completed: false,
              },
            ],
          }}
          forcedState="success"
        />
      );

      const priorityStep = screen.getByTestId('today-step-priority-act-1');
      expect(priorityStep).toBeInTheDocument();
      expect(priorityStep).toHaveTextContent(
        '👉 Bước chính: Bấm nút màu xanh (“Bắt đầu” / “Mở bài”) để vào bài học'
      );
    });
  });

  describe('5. Item #5: LanguageBrainCanvas CEFR Prefix & Clean Vietnamese POS in Drawer', () => {
    it('renders brain-selected-cefr-badge with Cấp độ: prefix and shows Vietnamese POS without duplicate English pos', () => {
      const customNodes: BrainNodeItem[] = [
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-w18-sched',
          label: 'schedule',
          lemma: 'schedule',
          pos: 'noun',
          ipa: '/ˈskedʒ.uːl/',
          cefr: 'B1',
        },
      ];

      render(<LanguageBrainCanvas initialNodes={customNodes} />);

      // Click node to open detail drawer
      fireEvent.click(screen.getByText('schedule'));

      // CEFR badge with prefix
      const cefrBadge = screen.getByTestId('brain-selected-cefr-badge');
      expect(cefrBadge).toBeInTheDocument();
      expect(cefrBadge).toHaveTextContent('Cấp độ: B1');

      // Vietnamese POS without duplicate raw English span
      const posVi = screen.getByTestId('brain-selected-pos-vi');
      expect(posVi).toBeInTheDocument();
      expect(posVi).toHaveTextContent('Danh từ');

      const drawer = screen.getByRole('dialog', { name: 'Chi tiết khái niệm' });
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('6. Item #6: DictionaryView Saved Counter Clarification & Mastery Level Label', () => {
    it('renders (từ vựng) clarification in saved counter and Mức độ ghi nhớ: in related concepts', async () => {
      const mockApi: any = {
        searchDictionary: vi.fn().mockResolvedValue({
          data: [],
          lemmaGroups: [
            {
              lexemeId: 'lex-w18-1',
              lemma: 'schedule',
              partOfSpeech: 'noun',
              matchedForms: ['schedule'],
              senses: [
                {
                  senseId: 'sense-w18-1',
                  definition: 'A plan.',
                  translatedDefinition: 'Lịch trình.',
                  concepts: [
                    {
                      concept: {
                        id: 'c-sched-rel-1',
                        canonicalForm: 'agenda',
                        partOfSpeech: 'noun',
                        level: { code: 'B1' },
                        status: 'mastered',
                        isDue: false,
                      },
                      mastery: 0.85,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      };

      render(<DictionaryView apiClient={mockApi} />);

      // Saved counter contains khái niệm (từ vựng)
      const savedCounter = screen.getByTestId('dictionary-saved-counter');
      expect(savedCounter).toBeInTheDocument();
      expect(savedCounter).toHaveTextContent(/⭐ Đã lưu \d+ khái niệm \(từ vựng\)/);

      // Trigger search to populate related concepts
      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'schedule' } });

      const masteryLabel = await screen.findByTestId('dictionary-related-mastery-label');
      expect(masteryLabel).toBeInTheDocument();
      expect(masteryLabel).toHaveTextContent(/Mức độ ghi nhớ:\s*85%/);
      expect(masteryLabel).not.toHaveTextContent('Độ vững:');
    });
  });

  describe('7. Item #7: LibraryView Vietnamese Concept POS & Prefixed Level Badge', () => {
    it('renders Vietnamese POS (Danh từ) and Cấp độ: prefix on saved concept cards', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'lib-concept-w18-coffee',
          itemType: 'concept',
          canonicalForm: 'coffee',
          meaningVi: 'cà phê',
          partOfSpeech: 'noun',
          level: 'A1',
          savedAt: '2026-10-28T00:00:00Z',
          status: 'mastered',
        },
      ];

      render(<LibraryView initialItems={mockItems} />);

      const posVi = screen.getByTestId('library-concept-pos-vi');
      expect(posVi).toBeInTheDocument();
      expect(posVi).toHaveTextContent('(Danh từ)');

      const levelBadge = screen.getByTestId('library-concept-level-badge');
      expect(levelBadge).toBeInTheDocument();
      expect(levelBadge).toHaveTextContent('Cấp độ: A1');
    });
  });

  describe('8. Item #8: ProgressAnalytics Expanded Average Retention & Session Efficiency', () => {
    it('renders expanded Ghi nhớ trung bình: and ⚡ Trung bình buổi học:', () => {
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

      const retentionPill = screen.getByTestId('progress-avg-retention-pill');
      expect(retentionPill).toBeInTheDocument();
      expect(retentionPill).toHaveTextContent(/Ghi nhớ trung bình:/);

      const sessionEfficiency = screen.getByTestId('progress-session-efficiency');
      expect(sessionEfficiency).toBeInTheDocument();
      expect(sessionEfficiency).toHaveTextContent(/⚡ Trung bình buổi học:/);
    });
  });

  describe('9. Item #9: ProfileView Solidified Heading, Brain Link Text & Settings FSRS Cap Note', () => {
    it('renders profile-solidified-heading-vi and Bản đồ từ vựng in profile-open-brain-link', () => {
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

      const solidifiedHeading = screen.getByTestId('profile-solidified-heading-vi');
      expect(solidifiedHeading).toBeInTheDocument();
      expect(solidifiedHeading).toHaveTextContent(
        'Từ vựng đã củng cố vững (Khái niệm đã củng cố)'
      );

      const brainLink = screen.getByTestId('profile-open-brain-link');
      expect(brainLink).toBeInTheDocument();
      expect(brainLink).toHaveTextContent('🧠 Mở bản đồ Language Brain (Bản đồ từ vựng)');
      // Invariant check: preserves '🧠 Mở bản đồ Language Brain' as substring
      expect(brainLink.textContent).toContain('🧠 Mở bản đồ Language Brain');
    });

    it('renders settings-fsrs-cap-beginner-note explaining review cap in SettingsView', () => {
      render(<SettingsView />);

      const capSelector = screen.getByTestId('settings-review-cap-selector');
      expect(capSelector).toBeInTheDocument();

      const capNote = screen.getByTestId('settings-fsrs-cap-beginner-note');
      expect(capNote).toBeInTheDocument();
      expect(capNote).toHaveTextContent(
        '💡 Giải thích: Hệ thống chỉ đưa ra tối đa số thẻ này mỗi ngày để bạn không bao giờ bị quá tải bài ôn.'
      );

      // Invariants check
      expect(screen.getByText('Ngân sách từ mới mỗi ngày')).toBeInTheDocument();
      expect(
        screen.getByText('Giới hạn thẻ ôn tập FSRS mỗi ngày (Nhịp nhắc thông minh vừa sức)')
      ).toBeInTheDocument();
      expect(screen.getByText(/chưa được lưu lâu dài/i)).toBeInTheDocument();
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Vietnamese Goal Label on Completion Card', () => {
    it('renders onboarding-budget-label-vi with friendly Mục tiêu từ mới mỗi ngày:', () => {
      render(<OnboardingDiagnostic />);

      // Jump to completion screen via beginner bypass
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      const budgetLabel = screen.getByTestId('onboarding-budget-label-vi');
      expect(budgetLabel).toBeInTheDocument();
      expect(budgetLabel).toHaveTextContent('Mục tiêu từ mới mỗi ngày:');

      const cleanMeta = screen.getByTestId('onboarding-clean-summary-meta');
      expect(cleanMeta).toBeInTheDocument();
      expect(cleanMeta).toHaveTextContent('Mục tiêu từ mới mỗi ngày:');
      expect(cleanMeta).toHaveTextContent('3–5 từ mới/ngày (vừa sức cho người mới)');
    });
  });
});
