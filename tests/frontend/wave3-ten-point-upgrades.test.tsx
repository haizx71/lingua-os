import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockApiClient, mockProgressOverviewResponse, mockMeResponse, mockBrainSummaryResponse } from '@lingua/types';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { mockPassage } from '../../apps/web/src/fixtures/readerFixture';

describe('Wave 3: 10-Point System Upgrades Frontend Test Suite', () => {
  let navEvents: Array<{ path: string }> = [];

  beforeEach(() => {
    navEvents = [];
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      if (customEvent.detail) {
        navEvents.push(customEvent.detail);
      }
    };
    window.addEventListener('lingua:navigate', handleNav);
    return () => {
      window.removeEventListener('lingua:navigate', handleNav);
    };
  });

  describe('Item #8b: clientNavigate integration in ProfileView & ReviewSession', () => {
    it('uses clientNavigate("/today") in ProfileView empty state without crashing window.location', async () => {
      render(<ProfileView forcedState="empty" />);

      const backBtn = screen.getByRole('button', { name: 'Về Hôm nay' });
      expect(backBtn).toBeInTheDocument();

      fireEvent.click(backBtn);

      expect(navEvents).toContainEqual({ path: '/today' });
    });

    it('renders modernized hero header and summary cards in ProfileView success state', async () => {
      const client = Object.assign(new MockApiClient(), {
        transportKind: 'http' as const,
        getMe: vi.fn().mockResolvedValue(mockMeResponse),
        getBrainSummary: vi.fn().mockResolvedValue(mockBrainSummaryResponse),
        getProgressOverview: vi.fn().mockResolvedValue(mockProgressOverviewResponse),
      });

      render(<ProfileView apiClient={client} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: 'Learner Account' })).toBeInTheDocument();
      });

      // Verification of accessible summary cards and mastery progress bar
      expect(screen.getByRole('region', { name: 'Tóm tắt hồ sơ' })).toBeInTheDocument();
      expect(screen.getByText('Từ đã gặp')).toBeInTheDocument();
      expect(screen.getByText('Đã củng cố vững')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Tỷ lệ khái niệm đã củng cố' })).toBeInTheDocument();
    });

    it('uses clientNavigate("/read") in ReviewSession empty state', async () => {
      render(<ReviewSession forcedState="empty" />);

      const readBtn = screen.getByRole('button', { name: 'Đọc bài mới trong Reader' });
      expect(readBtn).toBeInTheDocument();

      fireEvent.click(readBtn);

      expect(navEvents).toContainEqual({ path: '/read' });
    });
  });

  describe('Item #9: 30-Day Trend Summary Strip & Modern Chart Polish in ProgressAnalytics', () => {
    it('renders the analytical summary strip (data-testid="progress-window-summary") with average, peak, and retention metrics', async () => {
      const client = Object.assign(new MockApiClient(), {
        transportKind: 'http' as const,
        getProgressOverview: vi.fn().mockResolvedValue(mockProgressOverviewResponse),
      });

      render(<ProgressAnalytics apiClient={client} />);

      await waitFor(() => {
        expect(screen.getByTestId('progress-window-summary')).toBeInTheDocument();
      });

      const summaryStrip = screen.getByTestId('progress-window-summary');
      expect(summaryStrip).toHaveTextContent(/Trung bình:\s*\d+\s*phút\/ngày/);
      expect(summaryStrip).toHaveTextContent(/Cao điểm:/);
      expect(summaryStrip).toHaveTextContent(/Ghi nhớ TB:\s*\d+%/);

      // Verify chart list and day items
      expect(screen.getByRole('list', { name: 'Thời gian học theo ngày' })).toBeInTheDocument();
    });

    it('uses clientNavigate("/today") in ProgressAnalytics empty state', async () => {
      render(<ProgressAnalytics forcedState="empty" />);

      const actionBtn = screen.getByRole('button', { name: 'Về Hôm nay' });
      expect(actionBtn).toBeInTheDocument();

      fireEvent.click(actionBtn);

      expect(navEvents).toContainEqual({ path: '/today' });
    });
  });

  describe('Item #10: Keyboard Shortcuts (1-4, Enter) and Dynamic Evidence in OnboardingDiagnostic', () => {
    it('supports selecting options via numeric keys (1-4) and letter keys (A-D) and advancing via Enter', async () => {
      const onComplete = vi.fn();
      render(<OnboardingDiagnostic onComplete={onComplete} />);

      // Verify helper hint is visible
      expect(
        screen.getByText('Mẹo: Nhấn phím 1–4 (hoặc A–D) để chọn nhanh và Enter để tiếp tục')
      ).toBeInTheDocument();

      // Question 1: Press '1' to select option 0 ('appointment')
      fireEvent.keyDown(window, { key: '1', code: 'Digit1' });

      // Verify option is selected by checking button state
      const optA = screen.getByRole('button', { name: /A\.\s*appointment/i });
      expect(optA.className).toContain('bg-[var(--status-info-bg)]');

      // Press Enter to advance to Question 2
      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Câu hỏi 2 / 3 • Đo lường phản xạ từ vựng và ngữ cảnh')).toBeInTheDocument();
      });

      // Question 2: Press 'b' (case-insensitive) to select option 1 ('available')
      fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });

      const optB = screen.getByRole('button', { name: /B\.\s*available/i });
      expect(optB.className).toContain('bg-[var(--status-info-bg)]');

      // Press Enter to advance to Question 3
      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Câu hỏi 3 / 3 • Đo lường phản xạ từ vựng và ngữ cảnh')).toBeInTheDocument();
      });

      // Question 3: Press '1' to select option 0 ('on schedule')
      fireEvent.keyDown(window, { key: '1', code: 'Digit1' });

      // Press Enter to complete diagnostic
      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

      // Onboarding complete
      await waitFor(() => {
        expect(screen.getByText('Kết quả ước lượng khởi điểm')).toBeInTheDocument();
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedLevel: 'A2',
          confidence: 'medium',
          evidenceCount: 12,
          methodVersion: 'starting-level-heuristic-v1',
        })
      );

      // Verify result card renders A2 Elementary and evidence count
      expect(screen.getByRole('heading', { level: 2, name: /A2 Elementary/i })).toBeInTheDocument();
      expect(screen.getByText(/12 bằng chứng/i)).toBeInTheDocument();
    });

    it('ignores shortcut keys when user is typing inside an input element', async () => {
      render(
        <div>
          <input data-testid="test-input" />
          <OnboardingDiagnostic />
        </div>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      // Press '1' inside input element
      fireEvent.keyDown(input, { key: '1', code: 'Digit1' });

      // No option should be selected
      const optA = screen.getByRole('button', { name: /A\.\s*appointment/i });
      expect(optA.className).not.toContain('bg-[var(--status-info-bg)]');
    });
  });

  describe('Items #4, #5, #8a: LibraryView Search Bar, Pronunciation TTS & Brain Quick Link', () => {
    it('filters saved library items via instant search input, plays TTS pronunciation, and links concepts to /brain', async () => {
      const speakSpy = vi.fn();
      const cancelSpy = vi.fn();
      Object.defineProperty(window, 'speechSynthesis', {
        writable: true,
        value: { speak: speakSpy, cancel: cancelSpy },
      });
      class MockUtterance {
        text: string;
        lang = 'en-US';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        writable: true,
        value: MockUtterance,
      });

      render(
        <LibraryView
          forcedState="success"
          initialItems={[
            {
              itemType: 'concept',
              id: 'concept-1',
              canonicalForm: 'resilient',
              partOfSpeech: 'adjective',
              ipa: '/rɪˈzɪliənt/',
              level: 'B1',
              status: 'learning',
              isDue: false,
              savedAt: '2026-10-15T10:00:00Z',
            },
            {
              itemType: 'sentence',
              id: 'sentence-1',
              order: 1,
              text: 'She remained calm under pressure.',
              translation: 'Cô ấy giữ bình tĩnh dưới áp lực.',
              concepts: [],
              savedAt: '2026-10-15T10:05:00Z',
            },
          ]}
        />
      );

      expect(screen.getAllByTestId('library-item')).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Xem trong Brain' })).toHaveAttribute('href', '/brain');

      // Test pronunciation button on concept
      const listenBtn = screen.getByRole('button', { name: 'Phát âm: resilient' });
      fireEvent.click(listenBtn);
      expect(speakSpy).toHaveBeenCalledTimes(1);

      // Test instant search filtering
      const searchInput = screen.getByRole('searchbox', { name: 'Tìm kiếm trong thư viện' });
      fireEvent.change(searchInput, { target: { value: 'bình tĩnh' } });

      expect(screen.getAllByTestId('library-item')).toHaveLength(1);
      expect(screen.getByText('She remained calm under pressure.')).toBeInTheDocument();
    });
  });

  describe('Item #6: InteractiveReader Full-Passage & Per-Sentence Audio Playback', () => {
    it('renders per-sentence listen button ("Nghe câu 1") and invokes Web Speech synthesis', async () => {
      const speakSpy = vi.fn();
      const cancelSpy = vi.fn();
      Object.defineProperty(window, 'speechSynthesis', {
        writable: true,
        value: { speak: speakSpy, cancel: cancelSpy },
      });
      class MockUtterance {
        text: string;
        lang = 'en-US';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        writable: true,
        value: MockUtterance,
      });

      render(<InteractiveReader apiClient={new MockApiClient()} passage={mockPassage} />);

      const sentenceListenBtn = await screen.findByRole('button', { name: 'Nghe câu 1' });
      fireEvent.click(sentenceListenBtn);

      expect(speakSpy).toHaveBeenCalled();

      const fullListenBtn = screen.getByRole('button', { name: 'Nghe toàn bài' });
      fireEvent.click(fullListenBtn);
      expect(speakSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
