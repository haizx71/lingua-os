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
import SettingsPage from '@/app/settings/page';
import ProfilePage from '@/app/profile/page';
import { ErrorState } from '@lingua/ui';

vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Tier 3: Cross-Feature Combinations & State Transitions', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  it('combo_01_review_rating_does_not_recompute_today_plan_in_frontend', async () => {
    // 1. Initial Today state
    const initialPlan = await apiService.getTodayPlan();
    expect(initialPlan.due_reviews_count).toBe(23);
    expect(initialPlan.minutes_spent).toBe(0);

    // 2. User starts review and rates first item 'good'
    const queue = await apiService.getReviewQueue();
    const result = await apiService.submitReviewRating(queue[0].id, 'good');

    expect(result.remainingQueueCount).toBe(2);

    // 3. Today remains a separate, static server projection.
    const updatedPlan = await apiService.getTodayPlan();
    expect(updatedPlan).toEqual(initialPlan);
  });

  it('combo_02_reader_word_inspection_and_save_concept_syncs_with_dictionary', async () => {
    // 1. User discovers new concept in Reader
    const newConcept = await apiService.saveConcept({
      term: 'procrastinate',
      lemma: 'procrastinate',
      translation_vi: 'trì hoãn',
      cefr_level: 'B2',
      pos: 'verb',
      status: 'discovered',
    });

    expect(newConcept.id).toBeDefined();

    // 2. Search Dictionary for the new concept
    const searchResults = await apiService.searchDictionary('procrastinate');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].term).toBe('procrastinate');
    expect(searchResults[0].definitions[0].meaning_vi).toBe('trì hoãn');
    expect(searchResults[0].status).toBe('discovered');
  });

  it('combo_03_brain_view_consumes_static_server_projection', async () => {
    const brainData = await apiService.getBrainGraphData();
    const weakNode = brainData.nodes.find((n) => n.id === 'concept-002');

    expect(weakNode).toBeDefined();
    expect(weakNode?.status).toBe('weak');
    expect(brainData.summary.weak).toBeGreaterThan(0);
  });

  it('combo_04_review_rating_does_not_calculate_memory_or_mastery_in_frontend', async () => {
    const queue = await apiService.getReviewQueue();
    const firstItem = queue[0];

    // The harness accepts a static server outcome and never derives FSRS/mastery from rating.
    const result = await apiService.submitReviewRating(firstItem.id, 'again');

    expect(result.updatedItem.state).toBe(firstItem.state);
    expect(result.updatedConcept?.status).toBe('mastered');

    const brainData = await apiService.getBrainGraphData();
    expect(brainData.summary.memory_health_score).toBeLessThanOrEqual(100);
  });

  it('combo_05_review_rating_does_not_mutate_server_progress_fixture', async () => {
    const queue = await apiService.getReviewQueue();
    const firstItem = queue[0];

    // Submit 'easy' rating
    const result = await apiService.submitReviewRating(firstItem.id, 'easy');

    expect(result.updatedConcept?.status).toBe('mastered');

    const progress = await apiService.getProgressSummary();
    expect(progress.total_mastered).toBe(483);
  });

  it('combo_06_onboarding_estimate_and_today_are_separate_server_projections', async () => {
    const profile = await apiService.getUserProfile();
    expect(profile.starting_level_estimate).toBe('A2');

    const todayPlan = await apiService.getTodayPlan();
    expect(todayPlan.recommended_activities[1].title).toContain('An Unexpected Morning');
    expect(todayPlan.recommended_activities[1].badge_label).toContain('Độ phù hợp 95%');
  });

  it('combo_07_local_settings_do_not_claim_server_today_plan_persistence', async () => {
    // 1. Initial target is 25 minutes
    const initialSettings = await apiService.getLocalSettings();
    expect(initialSettings.daily_target_minutes).toBe(25);

    // 2. User updates setting to 45 minutes
    await apiService.updateLocalSettings({ daily_target_minutes: 45 });

    // 3. The server-owned Today plan remains unchanged.
    const updatedPlan = await apiService.getTodayPlan();
    expect(updatedPlan.target_minutes).toBe(25);
  });

  it('combo_08_deferred_new_words_budget_remains_local_to_scenario_state', async () => {
    await apiService.updateLocalSettings({ new_words_budget_per_day: 8 });

    const settings = await apiService.getLocalSettings();
    expect(settings.new_words_budget_per_day).toBe(8);
  });

  it('combo_09_dictionary_lookup_matches_reader_passage_target_vocabulary', async () => {
    const reader = await apiService.getReaderContent();
    const targetToken = reader.sentences[0].tokens.find((t) => t.raw === 'appointment');

    expect(targetToken).toBeDefined();

    const dictResults = await apiService.searchDictionary(targetToken!.raw);
    expect(dictResults.length).toBeGreaterThan(0);
    expect(dictResults[0].term).toBe('appointment');
  });

  it('combo_10_appshell_renders_across_all_5_primary_routes_cleanly', async () => {
    const readPage = await ReadPage({ searchParams: Promise.resolve({}) });
    const routes = [
      { path: '/today', component: <TodayPage /> },
      { path: '/read', component: readPage },
      { path: '/review', component: <ReviewPage /> },
      { path: '/brain', component: <BrainPage /> },
      { path: '/progress', component: <ProgressPage /> },
    ];

    routes.forEach(({ path, component }) => {
      const { unmount } = renderWithProviders(
        <AppShell currentPath={path}>{component}</AppShell>
      );
      expect(screen.getByRole('main')).toBeInTheDocument();
      unmount();
    });
  });

  it('combo_11_error_state_retry_trigger_transitions_cleanly_to_success_state', async () => {
    let hasFailed = true;
    const fetchData = async () => {
      if (hasFailed) {
        throw new Error('Network error');
      }
      return 'Dữ liệu học tập đã tải thành công!';
    };

    const TestComponent = () => {
      const [data, setData] = React.useState<string | null>(null);
      const [error, setError] = React.useState<boolean>(true);

      const load = async () => {
        try {
          const res = await fetchData();
          setData(res);
          setError(false);
        } catch {
          setError(true);
        }
      };

      if (error) {
        return (
          <ErrorState
            code="INTERNAL_ERROR"
            onRetry={() => {
              hasFailed = false;
              load();
            }}
          />
        );
      }

      return <div data-testid="success-data">{data}</div>;
    };

    renderWithProviders(<TestComponent />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByTestId('success-data')).toHaveTextContent(
      'Dữ liệu học tập đã tải thành công!'
    );
  });

  it('combo_12_focus_mode_toggle_in_review_session_hides_navigation_chrome', () => {
    const { rerender } = renderWithProviders(
      <AppShell focusMode={false}>
        <ReviewPage />
      </AppShell>
    );

    // Normal mode: Navigation sidebar / bottom nav present
    expect(screen.getByLabelText('Điều hướng chính di động')).toBeInTheDocument();

    // Toggle Focus Mode
    rerender(
      <AppShell focusMode={true}>
        <ReviewPage />
      </AppShell>
    );

    expect(screen.queryByLabelText('Điều hướng chính di động')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng màn hình lớn')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Thẻ đến lượt' })).toBeInTheDocument();
  });
});
