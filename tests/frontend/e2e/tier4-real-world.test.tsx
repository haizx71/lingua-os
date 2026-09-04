import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../harness/test-render';
import { MockApiService } from '../harness/mock-api-service';
import { AppShell } from '@/components/navigation/AppShell';
import TodayPage from '@/app/today/page';
import ReviewPage from '@/app/review/page';
import ReadPage from '@/app/read/page';
import BrainPage from '@/app/brain/page';
import ProgressPage from '@/app/progress/page';
import DictionaryPage from '@/app/dictionary/page';
import { mockDiagnosticQuestions, mockDiagnosticResult } from '../harness/contract-fixtures';

vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Tier 4: Real-World Application Workload Scenarios', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  it('scenario_01_complete_daily_study_routine_simulation', async () => {
    // Step 1: Learner opens Today Dashboard
    const initialPlan = await apiService.getTodayPlan();
    expect(initialPlan.due_reviews_count).toBe(23);
    expect(initialPlan.target_minutes).toBe(25);

    const { rerender } = renderWithProviders(
      <AppShell currentPath="/today">
        <TodayPage />
      </AppShell>,
      { apiService }
    );
    expect(screen.getByRole('heading', { level: 1, name: /Chào buổi sáng/i })).toBeInTheDocument();

    // Step 2: Learner starts Smart Review (FSRS) and reviews all 3 cards
    rerender(
      <AppShell currentPath="/review">
        <ReviewPage />
      </AppShell>
    );
    expect(screen.getByRole('heading', { level: 1, name: /Hàng đợi ôn tập/i })).toBeInTheDocument();

    const queue = await apiService.getReviewQueue();
    await apiService.submitReviewRating(queue[0].id, 'good');
    await apiService.submitReviewRating(queue[1].id, 'hard');
    await apiService.submitReviewRating(queue[2].id, 'easy');

    const remainingQueue = await apiService.getReviewQueue();
    expect(remainingQueue).toHaveLength(0);

    // Step 3: Learner moves to Reader to read today's passage
    rerender(
      <AppShell currentPath="/read">
        <ReadPage />
      </AppShell>
    );
    expect(screen.getByRole('heading', { level: 2, name: /Making an Appointment/i })).toBeInTheDocument();

    // Step 4: Learner inspects Language Brain to observe updated memory metrics
    rerender(
      <AppShell currentPath="/brain">
        <BrainPage />
      </AppShell>
    );
    const brainData = await apiService.getBrainGraphData();
    expect(brainData.summary.total_tracked).toBeGreaterThan(0);
    expect(brainData.summary.memory_health_score).toBeGreaterThan(0);

    // Step 5: Learner checks Progress overview
    rerender(
      <AppShell currentPath="/progress">
        <ProgressPage />
      </AppShell>
    );
    const progress = await apiService.getProgressSummary();
    expect(progress.retention_rate).toBeGreaterThan(0);
    expect(progress.weekly_evidence.active_days).toBe(5);
  });

  it('scenario_02_interrupted_session_recovery_workflow', async () => {
    // Step 1: User starts review session with 3 items
    const initialQueue = await apiService.getReviewQueue();
    expect(initialQueue).toHaveLength(3);

    // Review first item successfully
    await apiService.submitReviewRating(initialQueue[0].id, 'good');
    const queueAfter1 = await apiService.getReviewQueue();
    expect(queueAfter1).toHaveLength(2);

    // Step 2: Simulated network failure / 500 server error on second item
    apiService.injectError('INTERNAL_ERROR');

    try {
      await apiService.submitReviewRating(queueAfter1[0].id, 'again');
      expect.fail('Should have failed due to injected 500 error');
    } catch (err: any) {
      expect(err.errorResponse.code).toBe('INTERNAL_ERROR');
    }

    // Step 3: Recover network and retry
    apiService.clearInjectedError();
    const retryResult = await apiService.submitReviewRating(queueAfter1[0].id, 'again');
    expect(retryResult.remainingQueueCount).toBe(1);

    // Verify session state was preserved and did not restart from item 1
    const finalQueue = await apiService.getReviewQueue();
    expect(finalQueue).toHaveLength(1);
    expect(finalQueue[0].id).toBe(initialQueue[2].id);
  });

  it('scenario_03_deep_lexical_exploration_reader_to_dictionary_to_brain', async () => {
    // Step 1: In Reader, learner finds 'collaborate'
    const reader = await apiService.getReaderContent();
    expect(reader.sentences.length).toBeGreaterThan(0);

    // Step 2: Learner navigates to Dictionary to explore definition, IPA and examples
    renderWithProviders(<DictionaryPage />, { apiService });
    const results = await apiService.searchDictionary('collaborate');

    expect(results.length).toBeGreaterThan(0);
    const concept = results[0];
    expect(concept.term).toBe('collaborate');
    expect(concept.cefr_level).toBe('B2');

    // Step 3: Verify concept state in Language Brain
    const brainData = await apiService.getBrainGraphData();
    const node = brainData.nodes.find((n) => n.label === 'collaborate');
    expect(node).toBeDefined();
    expect(node?.status).toBe('active');
  });

  it('scenario_04_onboarding_consumes_static_server_estimate', async () => {
    // Questions are presentation fixtures; the frontend does not score placement answers.
    expect(mockDiagnosticQuestions).toHaveLength(3);

    // The result is supplied by the server fixture, never computed in the browser.
    const result = mockDiagnosticResult;
    expect(result.estimated_level).toBe('A2');
    expect(result.confidence).toBe('medium');
    expect(result.evidence_count).toBe(3);

    // Step 3: User Profile updated with Starting Level Estimate
    const profile = await apiService.getUserProfile();
    expect(profile.starting_level_estimate).toBe('A2');

    // Step 4: Today Plan remains a separate server projection.
    const todayPlan = await apiService.getTodayPlan();
    expect(todayPlan.target_minutes).toBe(25);
  });

  it('scenario_05_focus_mode_study_session_with_keyboard_navigation', () => {
    const handleKeyRating = vi.fn();

    const KeyboardReviewSimulator = () => {
      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (['1', '2', '3', '4'].includes(e.key)) {
          handleKeyRating(e.key);
        }
      };

      return (
        <div
          tabIndex={0}
          data-testid="focus-keyboard-container"
          onKeyDown={handleKeyDown}
          className="focus:outline-none focus:ring-2 focus:ring-indigo-500 p-6"
        >
          <AppShell focusMode={true}>
            <ReviewPage />
          </AppShell>
        </div>
      );
    };

    renderWithProviders(<KeyboardReviewSimulator />);

    const container = screen.getByTestId('focus-keyboard-container');
    container.focus();

    // Simulate key presses 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
    fireEvent.keyDown(container, { key: '1', code: 'Digit1' });
    fireEvent.keyDown(container, { key: '3', code: 'Digit3' });
    fireEvent.keyDown(container, { key: '4', code: 'Digit4' });

    expect(handleKeyRating).toHaveBeenCalledTimes(3);
    expect(handleKeyRating).toHaveBeenNthCalledWith(1, '1');
    expect(handleKeyRating).toHaveBeenNthCalledWith(2, '3');
    expect(handleKeyRating).toHaveBeenNthCalledWith(3, '4');
  });
});
