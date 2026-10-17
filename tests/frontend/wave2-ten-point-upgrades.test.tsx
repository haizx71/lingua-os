import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MockApiClient, mockApiResponses, mockTodayPlanResponse } from '@lingua/types';
import { usePrefersReducedMotion } from '@lingua/ui';
import {
  clearQueryCache,
  fetchWithActorCache,
} from '../../apps/web/src/lib/api/queryCache';
import { clientNavigate } from '../../apps/web/src/lib/navigation/clientNavigate';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { defaultReaderPassage } from '../../apps/web/src/fixtures/readerFixture';
import { useReaderSession } from '../../apps/web/src/features/read/useReaderSession';
import { useTodayPlan } from '../../apps/web/src/features/today/useTodayPlan';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import { useReviewSession } from '../../apps/web/src/features/review/useReviewSession';
import { defaultReviewQueue } from '../../apps/web/src/fixtures/reviewFixture';

describe('Wave 2: 10-Point System Upgrades Test Suite', () => {
  beforeEach(() => {
    clearQueryCache();
    delete document.documentElement.dataset.reducedMotion;
    delete document.documentElement.dataset.focusMode;
    window.localStorage.clear();
  });

  describe('Wave 2 Item #4: Passage-Level Translation Toggle & Word Inspector Pronunciation (PILOT-003 & PILOT-004)', () => {
    it('reveals and hides all Vietnamese sentence translations via the Reader toolbar toggle button', async () => {
      const passageWithTranslation = {
        ...defaultReaderPassage,
        sentences: [
          {
            ...defaultReaderPassage.sentences[0],
            translationVi: 'Tôi muốn đặt một cuộc hẹn vào ngày mai nếu ông ấy rảnh.',
          },
        ],
      };

      render(<InteractiveReader passage={passageWithTranslation} />);

      // Initially, toggle button shows "Hiện nghĩa toàn bài" and sentence translation is not rendered
      const toggleButton = screen.getByRole('button', { name: 'Hiện nghĩa toàn bài' });
      expect(toggleButton).toBeInTheDocument();
      expect(screen.queryByText('Tôi muốn đặt một cuộc hẹn vào ngày mai nếu ông ấy rảnh.')).not.toBeInTheDocument();

      // Click to reveal all translations
      fireEvent.click(toggleButton);

      // Label changes to "Ẩn nghĩa toàn bài" and translation appears
      expect(screen.getByRole('button', { name: 'Ẩn nghĩa toàn bài' })).toBeInTheDocument();
      expect(screen.getByText('Tôi muốn đặt một cuộc hẹn vào ngày mai nếu ông ấy rảnh.')).toBeInTheDocument();

      // Click again to hide all translations
      fireEvent.click(screen.getByRole('button', { name: 'Ẩn nghĩa toàn bài' }));

      // Reverts to "Hiện nghĩa toàn bài" and translation is hidden
      expect(screen.getByRole('button', { name: 'Hiện nghĩa toàn bài' })).toBeInTheDocument();
      expect(screen.queryByText('Tôi muốn đặt một cuộc hẹn vào ngày mai nếu ông ấy rảnh.')).not.toBeInTheDocument();
    });

    it('renders pronunciation button in Word Inspector and speaks the word via Web Speech API', async () => {
      const speakMock = vi.fn();
      const cancelMock = vi.fn();
      const utteranceConstructorMock = vi.fn().mockImplementation((text: string) => ({
        text,
        lang: '',
      }));

      Object.defineProperty(window, 'speechSynthesis', {
        value: { speak: speakMock, cancel: cancelMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: utteranceConstructorMock,
        writable: true,
        configurable: true,
      });

      render(<InteractiveReader passage={defaultReaderPassage} />);

      // Click the first interactive token button
      const tokenButton = screen.getByRole('button', { name: 'appointment' });
      fireEvent.click(tokenButton);

      // Inspector dialog opens with "Phát âm từ vựng" button
      const speakButton = await screen.findByRole('button', { name: 'Phát âm từ vựng' });
      expect(speakButton).toBeInTheDocument();

      fireEvent.click(speakButton);

      expect(cancelMock).toHaveBeenCalled();
      expect(speakMock).toHaveBeenCalledTimes(1);
      const utterance = speakMock.mock.calls[0][0];
      expect(utterance.text).toBe('appointment');
      expect(utterance.lang).toBe('en-US');
    });
  });

  describe('Wave 2 Item #6: SPA-Aware Client Navigation Helper (clientNavigate)', () => {
    it('dispatches lingua:navigate CustomEvent and updates browser history via pushState', () => {
      const navigateListener = vi.fn();
      window.addEventListener('lingua:navigate', navigateListener);

      clientNavigate('/library');

      expect(window.location.pathname).toBe('/library');
      expect(navigateListener).toHaveBeenCalledTimes(1);
      const event = navigateListener.mock.calls[0][0] as CustomEvent<{ path: string }>;
      expect(event.detail).toEqual({ path: '/library' });

      window.removeEventListener('lingua:navigate', navigateListener);
    });

    it('rejects external or relative paths without leading slash', () => {
      expect(() => clientNavigate('https://external.test')).toThrow();
      expect(() => clientNavigate('//evil.test')).toThrow();
      expect(() => clientNavigate('library')).toThrow();
    });
  });

  describe('Wave 2 Item #5: Cross-Feature SWR Cache Invalidation on Mutations', () => {
    it('invalidates warm ApiClient cache entries when completing a Today activity', async () => {
      const client = new MockApiClient();
      let queryCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        queryCount += 1;
        return { metrics: 'learner-stats', queryCount };
      });

      // 1. Warm cache for this client instance
      await fetchWithActorCache(client, 'learner-progress-key', 'actor-1', fetcher, 60000);
      expect(queryCount).toBe(1);

      // Cache hit
      const cached = await fetchWithActorCache(client, 'learner-progress-key', 'actor-1', fetcher, 60000);
      expect(queryCount).toBe(1);
      expect(cached.queryCount).toBe(1);

      // 2. Complete Today activity
      const { result } = renderHook(() =>
        useTodayPlan({ apiClient: client, initialPlan: mockTodayPlanResponse.data })
      );

      await act(async () => {
        await result.current.completeActivity(mockTodayPlanResponse.data.activities[0].id, 180);
      });

      // 3. Next query must bypass warm cache and fetch fresh data
      const refreshed = await fetchWithActorCache(client, 'learner-progress-key', 'actor-1', fetcher, 60000);
      expect(queryCount).toBe(2);
      expect(refreshed.queryCount).toBe(2);
    });

    it('invalidates warm ApiClient cache entries when saving a concept in Reader session', async () => {
      const client = new MockApiClient();
      let queryCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        queryCount += 1;
        return { metrics: 'brain-stats', queryCount };
      });

      // 1. Warm cache for this client instance
      await fetchWithActorCache(client, 'brain-overview-key', 'actor-1', fetcher, 60000);
      expect(queryCount).toBe(1);

      // 2. Save a concept in useReaderSession
      const { result } = renderHook(() =>
        useReaderSession({ apiClient: client, initialPassage: defaultReaderPassage })
      );

      const targetToken = defaultReaderPassage.sentences[0].tokens.find((t) => Boolean(t.conceptId));
      expect(targetToken).toBeDefined();

      await act(async () => {
        const saved = await result.current.saveConcept(targetToken!);
        expect(saved).toBe(true);
      });

      // 3. Next query must bypass warm cache and fetch fresh data
      const refreshed = await fetchWithActorCache(client, 'brain-overview-key', 'actor-1', fetcher, 60000);
      expect(queryCount).toBe(2);
      expect(refreshed.queryCount).toBe(2);
    });
  });

  describe('Wave 2 Items #1, #2, #3: Motion Hook, Focus Mode & Review Typing Keyboard Shortcuts', () => {
    it('reacts dynamically to document.documentElement.dataset.reducedMotion via MutationObserver in usePrefersReducedMotion', async () => {
      delete document.documentElement.dataset.reducedMotion;
      const { result } = renderHook(() => usePrefersReducedMotion());
      expect(result.current).toBe(false);

      // Set data-reduced-motion on documentElement
      act(() => {
        document.documentElement.dataset.reducedMotion = 'true';
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      // Clear data-reduced-motion
      act(() => {
        delete document.documentElement.dataset.reducedMotion;
      });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('toggles Focus Mode dataset attribute and exits Focus Mode on Escape', async () => {
      render(<ReviewSession initialQueue={defaultReviewQueue} />);

      const toggleFocusBtn = screen.getByRole('button', { name: 'Bật chế độ tập trung' });
      expect(toggleFocusBtn).toBeInTheDocument();

      // Enable Focus Mode
      fireEvent.click(toggleFocusBtn);
      expect(document.documentElement.dataset.focusMode).toBe('true');
      const focusContainer = document.querySelector('[data-focus-mode="true"]');
      expect(focusContainer).toBeInTheDocument();

      // Press Escape to exit Focus Mode
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(document.documentElement.dataset.focusMode).toBe('false');
    });

    it('forwards responseText on typing mode keyboard shortcut 3 and reveals answer on Enter in input', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

      const user = {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'learner.a@example.test',
        role: 'authenticated',
      };
      const session = {
        access_token: 'token-a',
        refresh_token: 'refresh-a',
        expires_in: 3600,
        expires_at: 9999999999,
        token_type: 'bearer',
        user,
      };
      const mockSupabase = {
        auth: {
          getSession: vi.fn(async () => ({ data: { session }, error: null })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
        },
      };

      const mockQueueResponse = {
        data: [
          {
            ...mockApiResponses.reviewQueue.data[0],
            exerciseMode: 'typing' as const,
            prompt: {
              ...mockApiResponses.reviewQueue.data[0].prompt,
              contextSentence: 'I have an appointment with the doctor.',
              translation: 'Tôi có cuộc hẹn với bác sĩ.',
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
      };

      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => ({
        data: {
          reviewItemId: mockApiResponses.reviewQueue.data[0].reviewItemId,
          memory: {
            state: 'review' as const,
            dueAt: '2026-09-12T08:00:00Z',
            isDue: false,
            lastReviewedAt: '2026-09-05T09:00:00Z',
          },
          competence: mockApiResponses.reviewQueue.data[0].competence,
          remainingDueCount: 0,
          feedback: 'Đã ghi nhận kết quả ôn tập.',
        },
        meta: { requestId: '00000000-0000-4000-8000-000000000999', apiVersion: '1.0' },
      }));

      const client = {
        listReviewQueue,
        answerReviewItem,
        getCurrentActorId: () => user.id,
      };

      render(
        <AuthProvider customClient={mockSupabase as any}>
          <ReviewSession apiClient={client as any} />
        </AuthProvider>
      );

      // Typing mode input is rendered for typing exercise mode
      const input = await screen.findByRole('textbox', { name: 'Câu trả lời' });
      expect(input).toBeInTheDocument();

      // Enter key inside input reveals the answer
      fireEvent.change(input, { target: { value: 'appointment' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      // Answer should now be revealed
      expect(await screen.findByText('Đáp án: appointment')).toBeInTheDocument();

      // Keyboard shortcut 3 forwards responseText
      fireEvent.keyDown(window, { key: '3', code: 'Digit3' });

      await waitFor(() => {
        expect(answerReviewItem).toHaveBeenCalledTimes(1);
      });

      const call = answerReviewItem.mock.calls[0][0];
      expect(call.body.rating).toBe('good');
      expect(call.body.responseText).toBe('appointment');
      expect(call.body.exerciseMode).toBe('typing');
    });
  });
});
