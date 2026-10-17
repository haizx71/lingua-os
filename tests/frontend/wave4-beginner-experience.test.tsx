import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MockApiClient,
  mockContentResponse,
  type ReaderPassageViewModel,
  type ReviewCardViewModel,
} from '@lingua/types';
import { AuthProvider } from '../../apps/web/src/features/auth';
import {
  lookupBeginnerWord,
  formatBeginnerPosVi,
  getVietnamesePronunciationTip,
  getSentenceStructureTip,
} from '../../apps/web/src/features/read/beginnerLexicon';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';

const IDS = {
  actorA: '10000000-0000-4000-8000-000000000001',
  content: '20000000-0000-4000-8000-000000000001',
  segment1: '30000000-0000-4000-8000-000000000001',
  sentence1: '40000000-0000-4000-8000-000000000001',
  conceptTea: '50000000-0000-4000-8000-000000000001',
};

function createMockSupabase() {
  const currentSession = {
    access_token: 'token-a',
    refresh_token: 'refresh-a',
    expires_in: 3600,
    expires_at: 9_999_999_999,
    token_type: 'bearer',
    user: { id: IDS.actorA, email: 'reader@example.test', role: 'authenticated' },
  };
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  } as unknown as SupabaseClient;
}

function makeTeaLiveContent() {
  const base = structuredClone(mockContentResponse);
  return {
    ...base,
    data: {
      ...base.data,
      summary: {
        ...base.data.summary,
        id: IDS.content,
        title: 'A Quiet Cup of Tea',
        isSaved: false,
      },
      totalWords: 3,
      segments: [
        {
          id: IDS.segment1,
          order: 0,
          segmentType: 'paragraph',
          text: 'Mina drinks tea.',
          sentences: [
            {
              id: IDS.sentence1,
              order: 0,
              text: 'Mina drinks tea.',
              translation: 'Mina uống trà.',
              concepts: [
                {
                  conceptId: IDS.conceptTea,
                  canonicalForm: 'tea',
                  startOffset: 12,
                  endOffset: 15,
                  status: 'learning',
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

describe('Wave 4: Beginner Experience ("Zero-to-One Learner UX") Test Suite', () => {
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
  });

  describe('1. beginnerLexicon helpers', () => {
    it('returns beginner-friendly Vietnamese guidance for common words, inflections, POS, and structures', () => {
      // Direct lookup
      const gm = lookupBeginnerWord('grandmother');
      expect(gm).not.toBeNull();
      expect(gm?.meaningVi).toContain('bà');
      expect(gm?.posVi).toBe('Danh từ');

      // Inflection / suffix matching (visits -> visit)
      const visits = lookupBeginnerWord('visits');
      expect(visits).not.toBeNull();
      expect(visits?.lemma).toBe('visit');
      expect(visits?.posVi).toBe('Động từ');

      // formatBeginnerPosVi
      expect(formatBeginnerPosVi('noun')).toBe('Danh từ');
      expect(formatBeginnerPosVi('verb')).toBe('Động từ');
      expect(formatBeginnerPosVi('adjective')).toBe('Tính từ');
      expect(formatBeginnerPosVi(undefined)).toBeNull();

      // getVietnamesePronunciationTip
      const teaPron = getVietnamesePronunciationTip('tea');
      expect(typeof teaPron).toBe('string');
      expect(teaPron.length).toBeGreaterThan(0);

      // getSentenceStructureTip
      const quoteTip = getSentenceStructureTip('"Tea is good," says Mina.');
      expect(quoteTip).toContain('Câu thoại trực tiếp');

      const compoundTip = getSentenceStructureTip('Mina drinks tea, and she feels calm.');
      expect(compoundTip).toContain('Câu ghép');
    });
  });

  describe('2. Word Inspector Vietnamese definition promotion (tea screenshot bug fix)', () => {
    it('promotes Vietnamese definition to Nghĩa từ when translation is missing or null, without hiding under English definition', async () => {
      const content = makeTeaLiveContent();
      const client = Object.assign(new MockApiClient(), {
        listRecommendedContent: vi.fn().mockResolvedValue({
          data: [content.data.summary],
          meta: { requestId: 'recommendations', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
        }),
        getContent: vi.fn().mockResolvedValue(content),
        getConcept: vi.fn().mockResolvedValue({
          data: {
            id: IDS.conceptTea,
            canonicalForm: 'tea',
            partOfSpeech: 'noun',
            definitions: [
              {
                languageCode: 'vi',
                definition: 'đồ uống pha từ lá trà hoặc thảo mộc',
                translation: null,
              },
            ],
          },
        }),
        recordReaderExposure: vi.fn().mockResolvedValue({ data: {} }),
      });

      render(
        <AuthProvider customClient={createMockSupabase()}>
          <InteractiveReader apiClient={client} />
        </AuthProvider>
      );

      const teaToken = await screen.findByRole('button', { name: 'tea' });
      fireEvent.click(teaToken);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Chi tiết từ vựng' })).toBeInTheDocument();
      });

      // Vietnamese definition must be displayed under "Nghĩa từ"
      await waitFor(() => {
        expect(screen.getByText('đồ uống pha từ lá trà hoặc thảo mộc')).toBeInTheDocument();
      });
      expect(screen.getByText('Nghĩa từ')).toBeInTheDocument();

      // Must NOT be hidden inside "Định nghĩa tiếng Anh" details
      expect(screen.queryByText('Định nghĩa tiếng Anh')).toBeNull();
    });
  });

  describe('3. Any-Word Clickable Helper in InteractiveReader', () => {
    it('clicking a non-concept word opens the Word Inspector with Vietnamese meaning & pronunciation tip without calling API', async () => {
      const passageWithHelperWords: ReaderPassageViewModel = {
        id: 'passage-helper-words',
        title: 'Morning Walk',
        level: 'A0',
        wordCount: 4,
        familiarityRate: 100,
        segments: [
          {
            id: 'segment-1',
            order: 0,
            text: 'grandmother visits today.',
            sentences: [
              {
                id: 'sentence-1',
                order: 0,
                text: 'grandmother visits today.',
                translationVi: 'Bà đến thăm hôm nay.',
                tokens: [
                  {
                    raw: 'grandmother',
                    conceptId: 'concept-gm',
                    status: 'learning',
                    sentenceId: 'sentence-1',
                    segmentId: 'segment-1',
                  },
                  {
                    raw: ' ',
                    sentenceId: 'sentence-1',
                    segmentId: 'segment-1',
                  },
                  {
                    raw: 'visits',
                    sentenceId: 'sentence-1',
                    segmentId: 'segment-1',
                  },
                  {
                    raw: ' ',
                    sentenceId: 'sentence-1',
                    segmentId: 'segment-1',
                  },
                  {
                    raw: 'today',
                    sentenceId: 'sentence-1',
                    segmentId: 'segment-1',
                  },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sentence-1',
            order: 0,
            text: 'grandmother visits today.',
            translationVi: 'Bà đến thăm hôm nay.',
            tokens: [
              {
                raw: 'grandmother',
                conceptId: 'concept-gm',
                status: 'learning',
                sentenceId: 'sentence-1',
                segmentId: 'segment-1',
              },
              {
                raw: ' ',
                sentenceId: 'sentence-1',
                segmentId: 'segment-1',
              },
              {
                raw: 'visits',
                sentenceId: 'sentence-1',
                segmentId: 'segment-1',
              },
              {
                raw: ' ',
                sentenceId: 'sentence-1',
                segmentId: 'segment-1',
              },
              {
                raw: 'today',
                sentenceId: 'sentence-1',
                segmentId: 'segment-1',
              },
            ],
          },
        ],
      };

      const getConceptSpy = vi.fn();
      const recordExposureSpy = vi.fn();

      const client = Object.assign(new MockApiClient(), {
        getConcept: getConceptSpy,
        recordReaderExposure: recordExposureSpy,
      });

      render(<InteractiveReader passage={passageWithHelperWords} apiClient={client} />);

      // Non-concept words should have data-testid="reader-helper-word"
      const helperWords = screen.getAllByTestId('reader-helper-word');
      expect(helperWords.length).toBeGreaterThanOrEqual(2);

      // Click "visits" helper word
      const visitsHelper = helperWords.find((el) => el.textContent === 'visits');
      expect(visitsHelper).toBeDefined();
      fireEvent.click(visitsHelper!);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Chi tiết từ vựng' })).toBeInTheDocument();
      });

      // API must NOT be called for non-concept helper words
      expect(getConceptSpy).not.toHaveBeenCalled();
      expect(recordExposureSpy).not.toHaveBeenCalled();

      // Dialog shows Vietnamese meaning
      expect(screen.getByText(/thăm, ghé thăm/i)).toBeInTheDocument();
    });
  });

  describe('4. Slow Audio (0.75x) Toggle in InteractiveReader & DictionaryView', () => {
    it('toggles slow audio in InteractiveReader and plays speech with rate 0.75', async () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-audio-test',
        title: 'Slow Audio Story',
        level: 'A0',
        wordCount: 2,
        familiarityRate: 100,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            text: 'Hello world.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'Hello world.',
                translationVi: 'Chào thế giới.',
                tokens: [{ raw: 'Hello', sentenceId: 'sent-1', segmentId: 'seg-1' }],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'Hello world.',
            translationVi: 'Chào thế giới.',
            tokens: [{ raw: 'Hello', sentenceId: 'sent-1', segmentId: 'seg-1' }],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      const slowToggle = screen.getByTestId('reader-slow-audio-toggle');
      expect(slowToggle).toBeInTheDocument();

      // Toggle to 0.75x
      fireEvent.click(slowToggle);
      expect(slowToggle).toHaveTextContent('0.75x');

      // Click "Nghe toàn bài"
      const playButton = screen.getByRole('button', { name: /Nghe toàn bài/i });
      fireEvent.click(playButton);

      expect(speakSpy).toHaveBeenCalled();
      expect(lastUtterance?.rate).toBe(0.75);
    });

    it('plays slow audio 0.75x when clicking slow pronunciation button in DictionaryView', async () => {
      render(<DictionaryView forcedState="success" />);

      // Find the 0.75x slow audio button
      const slowButtons = screen.getAllByRole('button', { name: /Nghe chậm 0.75x/i });
      expect(slowButtons.length).toBeGreaterThan(0);

      fireEvent.click(slowButtons[0]);

      expect(speakSpy).toHaveBeenCalled();
      expect(lastUtterance?.rate).toBe(0.75);
    });
  });

  describe('5. Onboarding Beginner Bypass & No-Guessing Option', () => {
    it('clicking beginner bypass completes onboarding with estimatedLevel A1 and shows calibration reassurance', async () => {
      const onCompleteSpy = vi.fn();
      render(<OnboardingDiagnostic onComplete={onCompleteSpy} />);

      const bypassButton = screen.getByTestId('onboarding-beginner-bypass');
      expect(bypassButton).toHaveTextContent('Bắt đầu từ Cơ bản (Mất gốc)');

      fireEvent.click(bypassButton);

      expect(onCompleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedLevel: 'A1',
          confidence: 'high',
          methodVersion: 'beginner-zero-to-one-bypass-v1',
        })
      );

      // Verify calibration reassurance message is displayed
      expect(screen.getByTestId('onboarding-beginner-reassurance')).toBeInTheDocument();
      expect(screen.getByText(/A1 Beginner/i)).toBeInTheDocument();
    });

    it('clicking "Không đoán mò" (data-testid="onboarding-dont-know-option") allows advancing without guessing', async () => {
      render(<OnboardingDiagnostic />);

      const dontKnowOption = screen.getByTestId('onboarding-dont-know-option');
      expect(dontKnowOption).toBeInTheDocument();

      fireEvent.click(dontKnowOption);

      const nextButton = screen.getByRole('button', { name: /Câu tiếp theo/i });
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(nextButton);

      // Advanced to Question 2
      expect(screen.getByText(/Câu hỏi 2 \//i)).toBeInTheDocument();
    });
  });

  describe('6. Smart Review Progressive Letter Hints (Gợi ý chữ cái) & Slow Audio', () => {
    const typingCard: ReviewCardViewModel = {
      id: 'rev-card-1',
      conceptId: 'concept-apple',
      term: 'apple',
      ipa: '/ˈæp.əl/',
      pos: 'noun',
      prompt: 'Gõ từ tiếng Anh có nghĩa là quả táo',
      meaningVi: 'quả táo',
      contextSentence: 'She eats a red apple.',
      contextTranslationVi: 'Cô ấy ăn một quả táo đỏ.',
      status: 'learning',
      isDue: true,
      dueText: 'Đến hạn',
      exerciseMode: 'typing',
    };

    it('reveals spelling hints progressively with character mask and Vietnamese meaning in typing mode', async () => {
      render(<ReviewSession initialQueue={[typingCard]} forcedState="success" />);

      // Initially hint is not visible
      expect(screen.queryByTestId('review-spelling-hint')).toBeNull();

      const hintButton = screen.getByTestId('review-hint-button');
      expect(hintButton).toHaveTextContent('Gợi ý chữ cái');

      // Click level 1 hint
      fireEvent.click(hintButton);
      expect(screen.getByTestId('review-spelling-hint')).toBeInTheDocument();
      expect(screen.getByTestId('review-spelling-hint')).toHaveTextContent(/a _ _ _ _/i);
      expect(screen.getByTestId('review-spelling-hint')).toHaveTextContent('quả táo');

      // Click level 2 hint
      fireEvent.click(hintButton);
      expect(screen.getByTestId('review-spelling-hint')).toBeInTheDocument();
      expect(screen.getByTestId('review-spelling-hint')).toHaveTextContent(/quả táo/i);
    });

    it('plays slow audio at 0.75x rate in ReviewSession', async () => {
      render(<ReviewSession initialQueue={[typingCard]} forcedState="success" />);

      const slowReviewAudio = screen.getByRole('button', { name: /Nghe phát âm chậm 0.75x/i });
      fireEvent.click(slowReviewAudio);

      expect(speakSpy).toHaveBeenCalled();
      expect(lastUtterance?.rate).toBe(0.75);
    });
  });

  describe('7. Today 3-Step Beginner Guide', () => {
    it('renders the 3-step beginner guide with clear instructions on TodayDashboard', async () => {
      render(<TodayDashboard forcedState="success" />);

      const guide = screen.getByTestId('today-beginner-guide');
      expect(guide).toBeInTheDocument();

      expect(guide).toHaveTextContent('Lộ trình 3 bước dễ dàng cho người mới');
      expect(guide).toHaveTextContent('Bước 1 · Đọc & Chạm từ');
      expect(guide).toHaveTextContent('Bước 2 · Lưu 3–5 từ mới');
      expect(guide).toHaveTextContent('Bước 3 · Ôn tập có gợi ý');
    });
  });
});
