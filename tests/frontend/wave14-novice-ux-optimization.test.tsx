import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import {
  getFalseFriendTrap,
  getLearnerTrapWarning,
  lookupBeginnerWord,
} from '../../apps/web/src/features/read/beginnerLexicon';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import type { BrainNodeItem } from '../../apps/web/src/fixtures/brainFixture';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 14 Zero-English Novice UX Optimization Test Suite', () => {
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

  describe('1. Item #1: InteractiveReader Unified Reading Time & Beginner Toolbar Hint', () => {
    it('unifies reading time between reader-estimated-time and wave10-reader-wpm-meter without conflicting values, and displays beginner toolbar hint', () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w14-novice',
        title: 'Making an Appointment',
        level: 'A1',
        wordCount: 8,
        familiarityRate: 100,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I have an appointment with the doctor.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I have an appointment with the doctor.',
                translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
                tokens: [
                  { raw: 'I ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'have ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'an ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'appointment ', isTarget: true, term: 'appointment', sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'with ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'the ', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                  { raw: 'doctor.', isTarget: false, sentenceId: 'sent-1', segmentId: 'seg-1' },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I have an appointment with the doctor.',
            translationVi: 'Tôi có một cuộc hẹn với bác sĩ.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      // Verify reading time pill and wpm meter are present and coherent
      const timePill = screen.getByTestId('reader-estimated-time');
      expect(timePill).toBeInTheDocument();
      expect(timePill).toHaveTextContent(/phút đọc/);

      const wpmMeter = screen.getByTestId('wave10-reader-wpm-meter');
      expect(wpmMeter).toBeInTheDocument();
      expect(wpmMeter).toHaveTextContent(/phút đọc thong thả/);
      // No raw English "wpm" jargon
      expect(wpmMeter).not.toHaveTextContent(/\bwpm\b/i);

      // Verify beginner toolbar hint is present
      const toolbarHint = screen.getByTestId('reader-beginner-toolbar-hint');
      expect(toolbarHint).toBeInTheDocument();
      expect(toolbarHint).toHaveTextContent(
        '💡 Mẹo cho người mới: Chạm vào bất kỳ từ tiếng Anh nào trong bài để xem nghĩa tiếng Việt và nghe phát âm.'
      );
    });
  });

  describe('2. Item #2: beginnerLexicon Phonetic Spelling Safety & Single IPA Match', () => {
    it('verifies appointment false friend trap uses Vietnamese phonetic spelling without repeating raw IPA string', () => {
      const trap = getFalseFriendTrap('appointment');
      expect(trap).not.toBeNull();
      // Uses Vietnamese phonetic spelling
      expect(trap).toMatch(/[ơờ]-POIN-mần/);
      // Does NOT repeat the raw IPA slash format /əˈpɔɪnt.mənt/ inside the trap text
      expect(trap).not.toMatch(/\/əˈpɔɪnt\.mənt\//);

      const warning = getLearnerTrapWarning('appointment');
      expect(warning).not.toBeNull();
      expect(warning).toMatch(/[ơờ]-POIN-mần/);
      expect(warning).not.toMatch(/\/əˈpɔɪnt\.mənt\//);

      // The IPA is cleanly retained in the lexical entry only
      const entry = lookupBeginnerWord('appointment');
      expect(entry).not.toBeNull();
      expect(entry?.ipa).toBe('/əˈpɔɪnt.mənt/');
    });
  });

  describe('3. Item #3: ReviewSession Beginner FSRS Explanation & Blind Listening Clarity', () => {
    it('renders review-beginner-fsrs-note and friendly blind listening button label', () => {
      const mockQueue: ReviewCardItem[] = [
        {
          id: 'card-1',
          term: 'coffee',
          meaningVi: 'cà phê',
          ipa: '/ˈkɒf.i/',
          partOfSpeech: 'noun',
          exampleSentence: 'I drink coffee in the morning.',
          exampleTranslation: 'Tôi uống cà phê vào buổi sáng.',
          currentIntervalDays: 1,
          stability: 2.1,
          difficulty: 4.8,
          reps: 2,
          lapses: 0,
        },
      ];

      render(<ReviewSession initialQueue={mockQueue} />);

      // Reassuring FSRS note for beginners
      const fsrsNote = screen.getByTestId('review-beginner-fsrs-note');
      expect(fsrsNote).toBeInTheDocument();
      expect(fsrsNote).toHaveTextContent(/💡 Ôn tập thông minh:/);
      expect(fsrsNote).toHaveTextContent(/hệ thống sẽ tự tính ngày nhắc lại phù hợp nhất/);

      // Beginner-friendly listening mode label
      const blindBtn = screen.getByTestId('wave10-review-blind-listening-toggle');
      expect(blindBtn).toBeInTheDocument();
      expect(blindBtn).toHaveTextContent('🎧 Luyện nghe đoán từ (Nghe mù)');

      // Toggle listening mode
      fireEvent.click(blindBtn);
      expect(blindBtn).toHaveTextContent('🎧 Đang bật: Luyện nghe đoán từ (Nghe mù)');
    });
  });

  describe('4. Item #4: TodayDashboard Reassurance & Spaced Retrieval Vietnamese Translation', () => {
    it('renders today-novice-reassurance and replaces English Spaced Retrieval with plain Vietnamese', () => {
      render(<TodayDashboard forcedState="success" />);

      // Beginner reassurance banner
      const reassurance = screen.getByTestId('today-novice-reassurance');
      expect(reassurance).toBeInTheDocument();
      expect(reassurance).toHaveTextContent(
        '🌱 Dành cho người mới bắt đầu: Bạn không cần biết trước từ vựng — hãy làm lần lượt từng bước từ Bước 1 đến Bước 3.'
      );

      // Replaces English "Spaced Retrieval" with Vietnamese
      expect(screen.queryByText(/Spaced Retrieval/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Ôn tập ngắt quãng nhớ lâu/i)).toBeInTheDocument();
    });
  });

  describe('5. Item #5: LanguageBrainCanvas Unified Search Input & Collocations Explanation', () => {
    it('renders a single unified search input with matching id and testid, and explains Collocations in Vietnamese', () => {
      const mockNodes: BrainNodeItem[] = [
        {
          id: 'b-node-1',
          term: 'early',
          meaningVi: 'sớm',
          cefr: 'A1',
          status: 'mastered',
          encounterCount: 5,
          recallScore: 0.9,
          relatedIds: [],
        },
      ];

      render(<LanguageBrainCanvas nodes={mockNodes} />);

      // Single unified search input
      const searchInput = screen.getByTestId('brain-node-search');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('id', 'brain-concept-search');
      expect(document.querySelectorAll('#brain-concept-search')).toHaveLength(1);

      // Click node to open detail drawer
      const nodeEl = screen.getByText('early');
      fireEvent.click(nodeEl);

      // Collocations section explained in plain Vietnamese
      const collocations = screen.getByTestId('brain-related-collocations');
      expect(collocations).toBeInTheDocument();
      expect(collocations).toHaveTextContent(
        '🔗 Cụm từ thường đi kèm (Collocations — Giúp ghép câu tự nhiên không cần dịch từng chữ):'
      );
    });
  });

  describe('6. Item #6: DictionaryView Beginner Audio Tip & Sans-Serif Complexity Tag', () => {
    it('renders dictionary-beginner-audio-tip and complexity tag without font-mono', () => {
      render(<DictionaryView />);

      // Audio tip for beginners
      const audioTip = screen.getByTestId('dictionary-beginner-audio-tip');
      expect(audioTip).toBeInTheDocument();
      expect(audioTip).toHaveTextContent(/💡 Mẹo phát âm:/);
      expect(audioTip).toHaveTextContent(/0\.75x/);
      expect(audioTip).toHaveTextContent(/0\.5x/);

      // Complexity tag does not use font-mono
      const tags = screen.getAllByTestId('dictionary-complexity-tag');
      expect(tags.length).toBeGreaterThan(0);
      tags.forEach((tag) => {
        expect(tag.className).not.toContain('font-mono');
      });
    });
  });

  describe('7. Item #7: LibraryView Beginner Guidance Tip', () => {
    it('renders library-beginner-tip explaining saved words and sentences', () => {
      render(<LibraryView />);

      const tip = screen.getByTestId('library-beginner-tip');
      expect(tip).toBeInTheDocument();
      expect(tip).toHaveTextContent(
        /💡 Mẹo cho người mới: Mọi từ vựng và câu bạn bấm .*Lưu.* khi đọc bài hoặc tra từ điển đều nằm tại đây để bạn nghe lại và ôn tập bất cứ lúc nào\./
      );
    });
  });

  describe('8. Item #8: ProgressAnalytics CEFR Beginner Legend & FSRS Explanation', () => {
    it('renders progress-cefr-beginner-note explaining CEFR progression and FSRS memory reinforcement', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            wordsSolidified: 20,
          }}
        />
      );

      const cefrNote = screen.getByTestId('progress-cefr-beginner-note');
      expect(cefrNote).toBeInTheDocument();
      expect(cefrNote).toHaveTextContent(
        '💡 Giải thích cho người mới: Thang CEFR chia trình độ từ A1 (Mới bắt đầu) → A2 (Giao tiếp cơ bản) → B1 (Đọc hiểu tự tin). Hệ thống FSRS giúp nhắc bạn ôn đúng lúc sắp quên.'
      );
    });
  });

  describe('9. Item #9: ProfileView Beginner Note & SettingsView Clean Accent Role Group', () => {
    it('renders profile-beginner-level-note inside hero card in ProfileView', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Linh Nguyen',
            email: 'linh@example.test',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 10,
            totalConceptsMastered: 4,
            streakDays: 3,
          }}
        />
      );

      const note = screen.getByTestId('profile-beginner-level-note');
      expect(note).toBeInTheDocument();
      expect(note).toHaveTextContent(
        '💡 Hồ sơ này tự động cập nhật khi bạn đọc bài và ôn tập mỗi ngày.'
      );
    });

    it('renders settings-accent-selector without duplicate nested role="group" in SettingsView', () => {
      render(<SettingsView />);

      const outerSelector = screen.getByTestId('settings-accent-selector');
      expect(outerSelector).toBeInTheDocument();
      expect(outerSelector).toHaveAttribute('role', 'group');
      expect(outerSelector).toHaveAttribute('aria-label', 'Chọn giọng phát âm tiếng Anh');

      // The flex container has wave9-settings-accent-selector testid but NO nested role="group"
      const innerSelector = screen.getByTestId('wave9-settings-accent-selector');
      expect(innerSelector).toBeInTheDocument();
      expect(innerSelector).not.toHaveAttribute('role');

      // Outer selector should have zero nested role="group" children
      const nestedGroups = within(outerSelector).queryAllByRole('group');
      expect(nestedGroups).toHaveLength(0);
    });
  });

  describe('10. Item #10: OnboardingDiagnostic Zero Developer Jargon & Vietnamese Skill Labels', () => {
    it('replaces developer jargon Diagnostic Placement with friendly Vietnamese header', () => {
      render(<OnboardingDiagnostic />);

      expect(screen.queryByText(/Diagnostic Placement/i)).not.toBeInTheDocument();
      expect(
        screen.getByText('Khám phá trình độ • Khởi tạo lộ trình cá nhân')
      ).toBeInTheDocument();
    });

    it('translates raw English skill keys like recognition to Vietnamese in question badge', () => {
      render(<OnboardingDiagnostic />);

      // No raw English key rendered
      expect(screen.queryByText('Bằng chứng recognition')).not.toBeInTheDocument();
      // Plain Vietnamese translated label
      expect(screen.getByText('Bằng chứng: Nhận diện từ vựng')).toBeInTheDocument();
    });

    it('removes internal developer code (ADR-009) from completed calibration result screen', () => {
      render(<OnboardingDiagnostic />);

      // Click beginner bypass to jump to completion result
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      fireEvent.click(bypassBtn);

      // Verify (ADR-009) is completely absent
      expect(screen.queryByText(/ADR-009/i)).not.toBeInTheDocument();
      // Clean plain Vietnamese heading
      expect(screen.getByText('Ước lượng trình độ khởi điểm')).toBeInTheDocument();
    });
  });
});
