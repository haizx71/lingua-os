import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, type User } from '@supabase/supabase-js';
import {
  createLearnerProfile,
  allK208CompetitorsEligibleForStates,
  k2HostedWaveCheckpoint,
  markK2HostedCheckpoint,
  markK2HostedFinalizerComplete,
  createK2OpaqueIdProjector,
  exactK208FixtureStateReadback,
  normalizeK2WaveRequest,
  projectK2WaveApiPayload,
  requestK2HostedApi,
  runK2ProtectedAuthUiSignIn,
  verifyK2FixtureZeroRowHead,
  type K2ProtectedAuthUiInteractions,
  type K2ProtectedAuthUiResponse,
} from './k2_hosted_runner';
import {
  K2_HOSTED_MARKER_KEY,
  K2_HOSTED_STAGING_SUPABASE_REF,
  K2_HOSTED_WORKFLOW,
  K2_HOSTED_WORKFLOW_REF,
  cleanupFreshK2HostedActorIdentity,
  getK2ActorOwnership,
  type K2AuthenticatedActor,
  type K2FreshActorIdentity,
  type K2HostedConfig,
} from './k2_hosted_actors';
import type { TestInfo } from '@playwright/test';
import { assertK2HostedDueOnlyPlanReplay } from './k2_hosted_wave_k2_08_due_only';

const actor = {
  id: 'fake-actor-id-marker',
  email: 'fake-email-marker@example.invalid',
  password: 'fake-password-marker',
} as const;
const privateMarkers = [actor.email, actor.password, 'fake-session-marker'];
const genericFailure =
  'K2 hosted acceptance browser sign-in failed; sensitive browser details were suppressed.';

function validResponse(): K2ProtectedAuthUiResponse {
  return {
    status: () => 200,
    json: async () => ({ user: { id: actor.id } }),
  };
}

function interactions(
  overrides: Partial<K2ProtectedAuthUiInteractions> = {},
): K2ProtectedAuthUiInteractions {
  return {
    fillEmail: vi.fn(async (_value: string) => {}),
    fillPassword: vi.fn(async (_value: string) => {}),
    clickSubmit: vi.fn(async () => {}),
    waitForSignInResponse: vi.fn(async () => validResponse()),
    waitForDestination: vi.fn(async () => {}),
    ...overrides,
  };
}

async function rejectedError(operation: Promise<unknown>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected the protected sign-in helper to reject.');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('K2 hosted phase diagnostics', () => {
  function diagnosticTestInfo(): TestInfo {
    return { annotations: [] } as unknown as TestInfo;
  }

  it('emits only a fixed phase and event in JSON and the test annotation', () => {
    const testInfo = diagnosticTestInfo();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    markK2HostedCheckpoint(testInfo, 'primary_profile_bootstrap', 'start');

    expect(log).toHaveBeenCalledWith(JSON.stringify({
      type: 'k2_hosted_phase',
      phase: 'primary_profile_bootstrap',
      event: 'start',
    }));
    expect(testInfo.annotations).toEqual([{
      type: 'k2-hosted-phase',
      description: 'primary_profile_bootstrap:start',
    }]);
  });

  it('keeps the due-only subcase on its own closed checkpoint', () => {
    expect(k2HostedWaveCheckpoint('K2-07')).toBe('wave_k2_07');
    expect(k2HostedWaveCheckpoint('K2-08-DUE-ONLY')).toBe('wave_k2_08_due_only');
    expect(k2HostedWaveCheckpoint('K2-08')).toBe('wave_k2_08');
    expect(() => k2HostedWaveCheckpoint('invalid' as never)).toThrow('wave is not implemented');
  });

  it('rejects an unlisted phase without logging or retaining its value', () => {
    const testInfo = diagnosticTestInfo();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('K2 hosted acceptance diagnostic checkpoint was invalid.');

    expect(() => markK2HostedCheckpoint(testInfo, 'unexpected_private_phase_marker', 'start'))
      .toThrow(error.message);
    expect(log).not.toHaveBeenCalled();
    expect(testInfo.annotations).toEqual([]);
  });

  it('marks finalizer completion only after actor cleanup and retained comparison pass', () => {
    const testInfo = diagnosticTestInfo();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const successfulProof = {
      cleanupError: false,
      actorCleanupPassed: true,
      freshIdentityCleanupPassed: true,
      retainedComparisonPassed: true,
    } as const;

    markK2HostedCheckpoint(testInfo, 'finalizer_actor_cleanup', 'pass');
    markK2HostedCheckpoint(testInfo, 'finalizer_fresh_identity_cleanup', 'pass');
    markK2HostedCheckpoint(testInfo, 'finalizer_retained_comparison', 'pass');
    expect(markK2HostedFinalizerComplete(testInfo, successfulProof)).toBe(true);

    expect(testInfo.annotations.map(annotation => annotation.description)).toEqual([
      'finalizer_actor_cleanup:pass',
      'finalizer_fresh_identity_cleanup:pass',
      'finalizer_retained_comparison:pass',
      'finalizer_complete:pass',
    ]);
    for (const failedProof of [
      { ...successfulProof, cleanupError: true },
      { ...successfulProof, actorCleanupPassed: false },
      { ...successfulProof, freshIdentityCleanupPassed: false },
      { ...successfulProof, retainedComparisonPassed: false },
    ]) {
      const failedTestInfo = diagnosticTestInfo();
      expect(markK2HostedFinalizerComplete(failedTestInfo, failedProof)).toBe(false);
      expect(failedTestInfo.annotations).toEqual([]);
    }
    expect(log).toHaveBeenCalledTimes(4);
  });
});

describe('K2 hosted wave request boundary', () => {
  const ids = createK2OpaqueIdProjector(() => '00000000-0000-4000-8000-000000000099');
  const reviewId = '00000000-0000-4000-8000-000000000001';
  const profileId = '00000000-0000-4000-8000-000000000002';
  const profiles = { primary: profileId } as const;

  it('accepts only the fixed GET projections without request bodies or arbitrary options', () => {
    expect(normalizeK2WaveRequest('primary', profiles, ids,
      '/v1/today?languageProfileId=actor:primary', {})).toMatchObject({
      route: `/v1/today?languageProfileId=${profileId}`,
      options: { method: 'GET' },
    });
    for (const options of [
      { body: { actorId: 'private-actor-marker' } },
      { idempotencyKey: 'unexpected-key' },
      { authorization: 'Bearer private-token-marker' },
    ]) {
      expect(() => normalizeK2WaveRequest('primary', profiles, ids,
        '/v1/today?languageProfileId=actor:primary', options as never)).toThrow();
    }
    expect(() => normalizeK2WaveRequest('primary', profiles, ids,
      '/v1/today?languageProfileId=actor:primary&languageProfileId=actor:observer', {})).toThrow();
  });

  it('rejects body or idempotency data on read routes and Library writes', () => {
    const cases = [
      ['/v1/dictionary/search?languageCode=en&limit=100&query=a', { idempotencyKey: 'x' }],
      ['/v1/concepts/k2-anchor', { body: {} }],
      ['/v1/library/concepts/k2-anchor', { method: 'PUT', idempotencyKey: 'x' }],
      ['/v1/review/queue?languageProfileId=actor:primary', { idempotencyKey: 'x' }],
    ] as const;
    for (const [route, options] of cases) {
      expect(() => normalizeK2WaveRequest('primary', profiles, ids, route, options))
        .toThrow('unapproved');
    }
  });

  it('allows only a bounded answer payload on a runner-mapped Review item', () => {
    ids.bind('review-one', reviewId);
    expect(normalizeK2WaveRequest('primary', profiles, ids, '/v1/review/review-one/answer', {
      method: 'POST',
      idempotencyKey: 'k2-replay-answer',
      body: { correct: false, exerciseMode: 'self_recall', rating: 'again', responseTimeMs: 900 },
    })).toMatchObject({ route: `/v1/review/${reviewId}/answer`, options: { method: 'POST' } });
    expect(() => normalizeK2WaveRequest('primary', profiles, ids, '/v1/review/review-one/answer', {
      method: 'POST',
      idempotencyKey: 'k2-replay-answer',
      body: { actorId: reviewId, correct: false, exerciseMode: 'self_recall', rating: 'again', responseTimeMs: 900 },
    })).toThrow('Review answer payload');
  });

  it('allows only a fixed normal-session cross-actor completion denial probe on bound handles', () => {
    ids.bind('known-plan', '00000000-0000-4000-8000-000000000003');
    ids.bind('known-activity', '00000000-0000-4000-8000-000000000004');
    expect(normalizeK2WaveRequest('primary', profiles, ids,
      '/v1/today/known-plan/activities/known-activity/complete', {
        method: 'POST',
        idempotencyKey: 'k208-cross-actor-denial',
        body: {},
      })).toMatchObject({
      route: '/v1/today/00000000-0000-4000-8000-000000000003/activities/00000000-0000-4000-8000-000000000004/complete',
      options: { method: 'POST', body: {} },
    });
    for (const options of [
      { method: 'POST', body: {} },
      { method: 'POST', idempotencyKey: 'key', body: { actorId: 'private-marker' } },
      { method: 'GET', idempotencyKey: 'key', body: {} },
      { method: 'POST', idempotencyKey: 'key', body: { durationSeconds: 86401 } },
    ]) {
      expect(() => normalizeK2WaveRequest('primary', profiles, ids,
        '/v1/today/known-plan/activities/known-activity/complete', options as never)).toThrow();
    }
    expect(() => normalizeK2WaveRequest('primary', profiles, ids,
      '/v1/today/00000000-0000-4000-8000-000000000003/activities/known-activity/complete', {
        method: 'POST', idempotencyKey: 'k208-cross-actor-denial', body: {},
      })).toThrow('raw identity');
  });
});

describe('K2 hosted wave response projection', () => {
  const ids = createK2OpaqueIdProjector();
  const conceptId = '00000000-0000-4000-8000-000000000011';
  const reviewId = '00000000-0000-4000-8000-000000000012';
  const activityId = '00000000-0000-4000-8000-000000000013';
  const planId = '00000000-0000-4000-8000-000000000014';
  const profileId = '00000000-0000-4000-8000-000000000016';
  const contentId = '00000000-0000-4000-8000-000000000015';
  const privateMarker = 'private-response-marker@example.invalid';

  it('projects only fixed route fields and opaque IDs from learner API responses', () => {
    ids.bind('k2-concept', conceptId);
    ids.bind('k2-review-item', reviewId);
    ids.bind('k2-activity', activityId);
    ids.bind('k2-plan', planId);
    ids.bind('k2-content', contentId);
    const dictionary = projectK2WaveApiPayload('/v1/dictionary/search?query=x', {
      data: [{ id: conceptId, canonicalForm: privateMarker, learner: { email: privateMarker } }],
      meta: { requestId: privateMarker },
    }, ids);
    expect(dictionary).toEqual({ data: [{ id: 'k2-concept' }] });

    const score = { score: 0, evidenceCount: 0, rawActorId: privateMarker };
    const queue = projectK2WaveApiPayload('/v1/review/queue', {
      data: [{
        reviewItemId: reviewId,
        concept: { id: conceptId, canonicalForm: privateMarker },
        exerciseMode: 'self_recall',
        competence: { recognition: score, listening: score, production: score },
        prompt: { text: privateMarker },
        memory: { userId: privateMarker },
      }],
      meta: { requestId: privateMarker },
    }, ids);
    expect(queue).toEqual({ data: [{
      reviewItemId: 'k2-review-item',
      concept: { id: 'k2-concept' },
      exerciseMode: 'self_recall',
      competence: {
        recognition: { score: 0, evidenceCount: 0 },
        listening: { score: 0, evidenceCount: 0 },
        production: { score: 0, evidenceCount: 0 },
      },
    }] });

    const today = projectK2WaveApiPayload('/v1/today', {
      data: {
        id: planId,
        languageProfileId: profileId,
        timeZone: privateMarker,
        planDate: '2026-10-01',
        targetMinutes: 15,
        completedMinutes: 0,
        status: 'active',
        engineVersion: 'today-heuristic-v2',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        activities: [{
          id: activityId,
          position: 0,
          activityType: 'read',
          title: privateMarker,
          description: privateMarker,
          estimatedMinutes: 5,
          reasonCodes: ['CONTENT_FIT'],
          reasonText: privateMarker,
          status: 'pending',
          targetCount: null,
          completedCount: 0,
          contentId,
          createdAt: '2026-10-01T00:00:00Z',
          arbitraryProfile: privateMarker,
        }],
      },
      meta: { requestId: privateMarker },
    }, ids, profileId);
    expect(today).toEqual({ data: {
      id: 'k2-plan',
      planDate: '2026-10-01',
      targetMinutes: 15,
      completedMinutes: 0,
      status: 'active',
      engineVersion: 'today-heuristic-v2',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      activities: [{
        id: 'k2-activity',
        activityType: 'read',
        position: 0,
        targetCount: null,
        completedCount: 0,
        estimatedMinutes: 5,
        status: 'pending',
        reasonCodes: ['CONTENT_FIT'],
        contentId: 'k2-content',
        conceptId: null,
        reviewItemId: null,
        completedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
      }],
    } });
    expect(JSON.stringify(today)).not.toContain(profileId);

    const answer = projectK2WaveApiPayload(`/v1/review/${reviewId}/answer`, {
      data: {
        reviewItemId: reviewId,
        memory: { userId: privateMarker },
        competence: { production: { score: 1, evidenceCount: 1, raw: privateMarker } },
        remainingDueCount: 0,
        feedback: privateMarker,
      },
      meta: { requestId: privateMarker },
    }, ids);
    expect(answer).toEqual({ data: {
      reviewItemId: 'k2-review-item',
      competence: { production: { evidenceCount: 1 } },
    } });
    expect(JSON.stringify([dictionary, queue, today, answer])).not.toContain(privateMarker);
  });

  it('fails closed when fixed DTO shapes or bounded values are invalid', () => {
    expect(() => projectK2WaveApiPayload('/v1/dictionary/search', { data: { rows: [] } }, ids))
      .toThrow('response projection was invalid');
    expect(() => projectK2WaveApiPayload('/v1/today', { data: {
      id: planId,
      activities: [{ id: activityId, reasonCodes: ['PRIVATE_REASON'], activityType: 'read' }],
    } }, ids, profileId)).toThrow('Today profile binding was invalid');
  });

  it('rejects foreign, missing, malformed, or unbound Today profiles before projecting IDs', () => {
    const foreignProfileId = '00000000-0000-4000-8000-000000000017';
    const base = {
      id: planId,
      planDate: '2026-10-01',
      targetMinutes: 15,
      completedMinutes: 0,
      status: 'active',
      engineVersion: 'today-heuristic-v2',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      activities: [],
    };
    const cases = [
      { data: { ...base, languageProfileId: foreignProfileId }, binding: profileId },
      { data: base, binding: profileId },
      { data: { ...base, languageProfileId: privateMarker }, binding: profileId },
      { data: { ...base, languageProfileId: profileId }, binding: undefined },
    ];
    for (const { data, binding } of cases) {
      const project = vi.fn((value: unknown) => value);
      const opaqueIds = {
        project,
        bind: vi.fn(),
        resolve: vi.fn(),
      } as unknown as ReturnType<typeof createK2OpaqueIdProjector>;
      let error: Error | undefined;
      try {
        projectK2WaveApiPayload('/v1/today', { data }, opaqueIds, binding);
      } catch (caught) {
        if (caught instanceof Error) error = caught;
      }
      expect(error?.message).toBe('K2 hosted acceptance Today profile binding was invalid.');
      expect(error?.message).not.toContain(foreignProfileId);
      expect(error?.message).not.toContain(privateMarker);
      expect(project).not.toHaveBeenCalled();
    }
  });

  it('validates a nested completion plan profile before projecting plan or activity IDs', () => {
    const foreignProfileId = '00000000-0000-4000-8000-000000000017';
    const route = `/v1/today/${planId}/activities/${activityId}/complete`;
    const plan = {
      id: planId,
      languageProfileId: foreignProfileId,
      planDate: '2026-10-01',
      targetMinutes: 15,
      completedMinutes: 5,
      status: 'active',
      engineVersion: 'today-heuristic-v2',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:01:00Z',
      activities: [],
    };
    const activity = {
      id: activityId,
      position: 0,
      activityType: 'read',
      estimatedMinutes: 5,
      reasonCodes: ['CONTENT_FIT'],
      status: 'completed',
      targetCount: null,
      completedCount: 1,
      contentId: null,
      conceptId: null,
      reviewItemId: null,
      completedAt: '2026-10-01T00:01:00Z',
      createdAt: '2026-10-01T00:00:00Z',
    };
    const project = vi.fn((value: unknown) => value);
    const opaqueIds = {
      project,
      bind: vi.fn(),
      resolve: vi.fn(),
    } as unknown as ReturnType<typeof createK2OpaqueIdProjector>;

    expect(() => projectK2WaveApiPayload(route, { data: { plan, activity } }, opaqueIds, profileId))
      .toThrow('Today profile binding was invalid');
    expect(project).not.toHaveBeenCalled();

    const valid = projectK2WaveApiPayload(route, {
      data: { plan: { ...plan, languageProfileId: profileId }, activity },
    }, createK2OpaqueIdProjector(), profileId) as {
      data: { plan: { id: string; activities: readonly unknown[] }; activity: { id: string } };
    };
    expect(valid.data.plan.id).not.toBe(planId);
    expect(valid.data.activity.id).not.toBe(activityId);
    expect(valid.data.plan.activities).toEqual([]);
    expect(JSON.stringify(valid)).not.toContain(profileId);
  });

  it('keeps entity replay stable across request metadata while detecting entity changes', () => {
    const entity = {
      id: planId,
      languageProfileId: profileId,
      planDate: '2026-10-01',
      targetMinutes: 15,
      completedMinutes: 0,
      status: 'active',
      engineVersion: 'today-heuristic-v2',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      activities: [{
        id: activityId,
        position: 0,
        activityType: 'review',
        title: privateMarker,
        description: privateMarker,
        estimatedMinutes: 15,
        reasonCodes: ['FSRS_DUE'],
        reasonText: privateMarker,
        status: 'pending',
        targetCount: 15,
        completedCount: 0,
        createdAt: '2026-10-01T00:00:00Z',
      }],
    };
    const first = projectK2WaveApiPayload('/v1/today', {
      data: entity,
      meta: { requestId: '00000000-0000-4000-8000-000000000031', generatedAt: 'first-request' },
    }, ids, profileId);
    const replay = projectK2WaveApiPayload('/v1/today', {
      data: entity,
      meta: { requestId: '00000000-0000-4000-8000-000000000032', generatedAt: 'replay-request' },
    }, ids, profileId);
    expect(first).toEqual(replay);
    expect(JSON.stringify(first)).not.toContain('00000000-0000-4000-8000-000000000031');
    expect(() => assertK2HostedDueOnlyPlanReplay(first, replay)).not.toThrow();

    const changedEntity = {
      ...entity,
      activities: [{ ...entity.activities[0], estimatedMinutes: 14 }],
    };
    const changed = projectK2WaveApiPayload('/v1/today', {
      data: changedEntity,
      meta: { requestId: '00000000-0000-4000-8000-000000000033', generatedAt: 'third-request' },
    }, ids, profileId);
    expect(changed).not.toEqual(first);
    expect(() => assertK2HostedDueOnlyPlanReplay(first, changed))
      .toThrow('replay changed the persisted plan');
    expect((first as { data: { id: string; activities: readonly { id: string }[] } }).data.id)
      .toBe('k2-plan');
    expect((first as { data: { activities: readonly { id: string }[] } }).data.activities[0].id)
      .toBe('k2-activity');
  });
});

describe('K2 hosted cross-profile denial status', () => {
  it('rejects an unexpected 200 before a cross-profile Today response can be projected', async () => {
    const foreignProfileId = '00000000-0000-4000-8000-000000000017';
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      data: { languageProfileId: foreignProfileId },
    }), {
      status: 200,
      headers: { 'x-lingua-source-sha': 'accepted-source-sha-marker' },
    }));
    vi.stubGlobal('fetch', fetch);
    const config = {
      apiOrigin: 'https://staging.example.test',
      githubSha: 'accepted-source-sha-marker',
    } as K2HostedConfig;

    let error: Error | undefined;
    try {
      await requestK2HostedApi(
        config,
        'private-actor-token-marker',
        `/v1/today?languageProfileId=${foreignProfileId}`,
        {},
        [404],
      );
    } catch (caught) {
      if (caught instanceof Error) error = caught;
    }
    expect(error?.message).toBe('K2 hosted acceptance staging API returned HTTP 200.');
    expect(error?.message).not.toContain(foreignProfileId);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe('K2 hosted zero-row fixture probe', () => {
  it('uses the pinned relation, HEAD, and a formal limit=0 request without returning rows or counts', async () => {
    const limit = vi.fn(async (value: number) => ({ data: null, error: null, status: 200, count: null, limit: value }));
    const select = vi.fn((_columns: string, options: { head: boolean }) => ({ limit }));
    const from = vi.fn((_table: string) => ({ select }));
    await expect(verifyK2FixtureZeroRowHead({ from } as never)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledExactlyOnceWith('user_concept_states');
    expect(select).toHaveBeenCalledExactlyOnceWith('id', { head: true });
    expect(limit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('fails closed if the HEAD request returns any body or a count', async () => {
    for (const result of [
      { data: [], error: null, status: 200, count: null },
      { data: null, error: null, status: 200, count: 0 },
    ]) {
      const client = {
        from: () => ({ select: () => ({ limit: async () => result }) }),
      };
      await expect(verifyK2FixtureZeroRowHead(client as never)).rejects.toThrow('HEAD limit=0');
    }
  });
});

describe('K2-08 ambiguous fixture insert readback', () => {
  const weakId = '40000000-0000-4000-8000-000000000001';
  const forgottenId = '40000000-0000-4000-8000-000000000002';
  const expected = [
    { conceptId: weakId, status: 'weak' as const },
    { conceptId: forgottenId, status: 'forgotten' as const },
  ];

  function proof(stateStatuses: readonly Readonly<{
    conceptId: string;
    status: 'weak' | 'forgotten';
    stateVersion: number;
  }>[]) {
    return {
      candidates: [],
      stateConceptIds: stateStatuses.map(row => row.conceptId),
      stateStatuses,
    } as const;
  }

  it('accepts only the exact fixed actor-bound reader projection status pair', () => {
    expect(exactK208FixtureStateReadback(proof([
      { conceptId: forgottenId, status: 'forgotten', stateVersion: 1 },
      { conceptId: weakId, status: 'weak', stateVersion: 1 },
    ]), expected)).toBe(true);
  });

  it('rejects partial, foreign, duplicate, or changed state without a privileged base-table read', () => {
    expect(exactK208FixtureStateReadback(proof([
      { conceptId: weakId, status: 'weak', stateVersion: 1 },
    ]), expected)).toBe(false);
    expect(exactK208FixtureStateReadback(proof([
      { conceptId: weakId, status: 'weak', stateVersion: 1 },
      { conceptId: forgottenId, status: 'forgotten', stateVersion: 1 },
      { conceptId: '40000000-0000-4000-8000-000000000003', status: 'weak', stateVersion: 1 },
    ]), expected)).toBe(false);
    expect(exactK208FixtureStateReadback(proof([
      { conceptId: weakId, status: 'weak', stateVersion: 1 },
      { conceptId: weakId, status: 'weak', stateVersion: 1 },
    ]), expected)).toBe(false);
    expect(exactK208FixtureStateReadback(proof([
      { conceptId: weakId, status: 'weak', stateVersion: 2 },
      { conceptId: forgottenId, status: 'forgotten', stateVersion: 1 },
    ]), expected)).toBe(false);
  });
});

describe('K2-08 bounded competitor eligibility', () => {
  const candidate = (
    contentId: string,
    linkedConceptIds: readonly string[],
    unseenCount = linkedConceptIds.length,
  ) => ({
    contentId,
    estimatedMinutes: 5,
    linkedConceptIds,
    unseenCount,
    isSaved: false,
    isUnfinished: false,
    isCompleted: false,
  });

  it('rejects a nonselected six-concept competitor when fixture statuses would reduce unseen count to four', () => {
    const knownConcepts = new Set(['shared-a', 'shared-b']);
    const selectedCandidates = [
      candidate('novel', ['novel-concept']),
      candidate('weak', ['weak-concept']),
      candidate('forgotten', ['forgotten-concept']),
    ];
    const nonselectedCandidate = candidate(
      'nonselected-six-linked',
      ['shared-a', 'shared-b', 'other-a', 'other-b', 'other-c', 'other-d'],
      4,
    );

    expect(allK208CompetitorsEligibleForStates(selectedCandidates)).toBe(true);
    expect(allK208CompetitorsEligibleForStates(
      [...selectedCandidates, nonselectedCandidate], knownConcepts,
    )).toBe(false);
  });
});

describe('createLearnerProfile', () => {
  const config = {
    apiOrigin: 'https://staging.example.test',
    githubSha: 'accepted-source-sha-marker',
  } as K2HostedConfig;
  const session: K2AuthenticatedActor = {
    userId: 'fake-actor-id-marker',
    accessToken: 'fake-access-token-marker',
  };

  const observerSession: K2AuthenticatedActor = {
    userId: 'fake-observer-id-marker',
    accessToken: 'fake-observer-access-token-marker',
  };

  it('persists each actor timezone with that actor bootstrap ETag before creating either language profile', async () => {
    const actors = [
      {
        label: 'primary',
        session,
        bootstrapEtag: '"primary-bootstrap"',
        profileId: 'fake-primary-language-profile-marker',
      },
      {
        label: 'observer',
        session: observerSession,
        bootstrapEtag: '"observer-bootstrap"',
        profileId: 'fake-observer-language-profile-marker',
      },
    ] as const;
    const observed: Array<{
      actor: string;
      route: string;
      method: string;
      headers: Headers;
      body: unknown;
    }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const actor = actors.find(item => headers.get('authorization') === `Bearer ${item.session.accessToken}`);
      if (!actor) return apiResponse(401, { error: { code: 'UNEXPECTED_TEST_ACTOR' } });
      observed.push({ actor: actor.label, route, method, headers, body });

      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: actor.session.userId, timeZone: null } }, {
          etag: actor.bootstrapEtag,
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: actor.session.userId, timeZone: 'Asia/Ho_Chi_Minh' } }, {
          etag: `${actor.bootstrapEtag}-updated`,
        });
      }
      if (route === '/v1/me/languages' && method === 'GET') {
        return apiResponse(200, { data: [] });
      }
      if (route === '/v1/me/languages' && method === 'POST') {
        return apiResponse(201, { data: { id: actor.profileId } });
      }
      return apiResponse(500, { error: { code: 'UNEXPECTED_TEST_REQUEST' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const actor of actors) {
      await expect(createLearnerProfile(config, actor.session)).resolves.toBe(actor.profileId);
    }

    expect(observed.map(({ actor, method, route }) => [actor, method, route])).toEqual([
      ['primary', 'GET', '/v1/me'],
      ['primary', 'PATCH', '/v1/me'],
      ['primary', 'GET', '/v1/me/languages'],
      ['primary', 'POST', '/v1/me/languages'],
      ['observer', 'GET', '/v1/me'],
      ['observer', 'PATCH', '/v1/me'],
      ['observer', 'GET', '/v1/me/languages'],
      ['observer', 'POST', '/v1/me/languages'],
    ]);
    for (const actor of actors) {
      const actorCalls = observed.filter(call => call.actor === actor.label);
      expect(actorCalls[1]?.headers.get('if-match')).toBe(actor.bootstrapEtag);
      expect(actorCalls[1]?.body).toEqual({ timeZone: 'Asia/Ho_Chi_Minh' });
      expect(actorCalls.filter(call => call.method !== 'PATCH')
        .every(call => call.headers.get('if-match') === null)).toBe(true);
    }
  });

  it('stops before profile requests when bootstrap did not supply a usable ETag', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      return apiResponse(200, { data: { id: session.userId, timeZone: null } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe('K2 hosted acceptance learner profile ETag was missing.');
    expect(observed).toEqual([{ method: 'GET', route: '/v1/me' }]);
  });

  it.each([
    ['a stale ETag response', 412],
    ['another API failure', 503],
  ])('stops before language creation after %s and suppresses response details', async (_case, status) => {
    const etag = '"fake-current-profile-version"';
    const responseMarker = 'fake-private-response-marker';
    const observed: Array<{ method: string; route: string; headers: Headers }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      observed.push({ route, method, headers });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, { etag });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(status, { privateDetail: responseMarker });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe(`K2 hosted acceptance staging API returned HTTP ${status}.`);
    expect(error.message).not.toContain(responseMarker);
    expect(error.message).not.toContain(session.userId);
    expect(error.message).not.toContain(session.accessToken);
    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
    ]);
    expect(observed[1]?.headers.get('if-match')).toBe(etag);
    expect(log).not.toHaveBeenCalled();
  });

  it('does not accept an unexpected timezone response before creating a profile', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-profile-version"',
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-updated-profile-version"',
        });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createLearnerProfile(config, session))
      .rejects.toThrow('K2 hosted acceptance learner timezone was not persisted.');

    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
    ]);
  });

  it('continues to require HTTP 201 for language profile creation', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-profile-version"',
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: session.userId, timeZone: 'Asia/Ho_Chi_Minh' } }, {
          etag: '"fake-updated-profile-version"',
        });
      }
      if (route === '/v1/me/languages' && method === 'GET') return apiResponse(200, { data: [] });
      if (route === '/v1/me/languages' && method === 'POST') {
        return apiResponse(409, { privateDetail: 'fake-private-conflict-marker' });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe('K2 hosted acceptance staging API returned HTTP 409.');
    expect(error.message).not.toContain('fake-private-conflict-marker');
    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
      ['GET', '/v1/me/languages'],
      ['POST', '/v1/me/languages'],
    ]);
  });

  it('deletes the marked actor after profile creation committed but its response was lost', async () => {
    const runConfig = {
      githubRepository: 'haizx71/lingua-os',
      githubWorkflow: K2_HOSTED_WORKFLOW,
      githubWorkflowRef: K2_HOSTED_WORKFLOW_REF,
      githubRunId: '123456789',
      githubRunAttempt: '2',
      supabaseProjectRef: K2_HOSTED_STAGING_SUPABASE_REF,
    } as K2HostedConfig;
    const identity: K2FreshActorIdentity = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'k2ha-123456789-2-aaaaaaaaaaaaaaaa@example.invalid',
      ownership: getK2ActorOwnership(runConfig),
    };
    const actorUser = {
      id: identity.id,
      email: identity.email,
      app_metadata: { [K2_HOSTED_MARKER_KEY]: identity.ownership },
      user_metadata: {},
      created_at: identity.ownership.createdAt,
      email_confirmed_at: identity.ownership.createdAt,
      last_sign_in_at: null,
    } as unknown as User;
    let lookup = 0;
    const deleteUser = vi.fn(async (_id: string) => ({ error: null }));
    const admin = {
      auth: { admin: {
        getUserById: vi.fn(async () => {
          lookup += 1;
          return lookup === 1
            ? { data: { user: actorUser }, error: null }
            : { data: { user: null }, error: new AuthApiError('not found', 404, 'user_not_found') };
        }),
        deleteUser,
      } },
    } as never;
    let profileCommitted = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: identity.id, timeZone: 'Asia/Ho_Chi_Minh' } }, {
          etag: '"profile-version"',
        });
      }
      if (route === '/v1/me/languages' && method === 'GET') return apiResponse(200, { data: [] });
      if (route === '/v1/me/languages' && method === 'POST') {
        profileCommitted = true;
        throw new Error('simulated lost response with private provider detail');
      }
      return apiResponse(500, {});
    }));

    await expect(createLearnerProfile(config, {
      userId: identity.id,
      accessToken: 'normal-actor-bearer-marker',
    })).rejects.toThrow('staging API request failed; provider details were suppressed');
    expect(profileCommitted).toBe(true);

    const verifyDeletedActor = vi.fn(async (_actorId: string) => {});
    await expect(cleanupFreshK2HostedActorIdentity(
      runConfig, identity, admin, verifyDeletedActor,
    )).resolves.toBe(true);
    expect(deleteUser).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledWith(identity.id);
    expect(verifyDeletedActor).toHaveBeenCalledExactlyOnceWith(identity.id);
  });
});

function apiResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-lingua-source-sha': 'accepted-source-sha-marker',
      ...headers,
    },
  });
}

describe('runK2ProtectedAuthUiSignIn', () => {
  it('preserves the normal sign-in identity check and destination wait', async () => {
    const steps = interactions();

    await runK2ProtectedAuthUiSignIn(actor, steps);

    expect(steps.waitForSignInResponse).toHaveBeenCalledOnce();
    expect(steps.fillEmail).toHaveBeenCalledWith(actor.email);
    expect(steps.fillPassword).toHaveBeenCalledWith(actor.password);
    expect(steps.clickSubmit).toHaveBeenCalledOnce();
    expect(steps.waitForDestination).toHaveBeenCalledOnce();
  });

  it.each([
    ['a non-200 response', { status: () => 403, json: async () => ({ user: { id: actor.id } }) }],
    ['an unexpected actor identity', { status: () => 200, json: async () => ({ user: { id: 'other-actor-marker' } }) }],
  ])('stops before navigation for %s', async (_case, response) => {
    const steps = interactions({ waitForSignInResponse: vi.fn(async () => response) });

    await expect(runK2ProtectedAuthUiSignIn(actor, steps)).rejects.toThrow(genericFailure);
    expect(steps.waitForDestination).not.toHaveBeenCalled();
  });

  const injectedFailureCases: ReadonlyArray<readonly [string, () => Partial<K2ProtectedAuthUiInteractions>]> = [
    ['email fill', () => ({
      fillEmail: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['password fill', () => ({
      fillPassword: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['submit click', () => ({
      clickSubmit: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['response wait', () => ({
      waitForSignInResponse: vi.fn(async () => {
        throw new Error(`email=${actor.email}; password=${actor.password}; fake-session-marker`);
      }),
    })],
    ['destination wait', () => ({
      waitForDestination: vi.fn(async () => {
        throw new Error(`email=${actor.email}; password=${actor.password}; fake-session-marker`);
      }),
    })],
  ];

  it.each(injectedFailureCases)('suppresses raw Playwright details from %s failures', async (_stage, makeOverrides) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = await rejectedError(runK2ProtectedAuthUiSignIn(actor, interactions(makeOverrides())));
    const reportedText = `${error.message}\n${error.stack ?? ''}`;

    expect(error.message).toBe(genericFailure);
    expect(error).not.toHaveProperty('cause');
    for (const marker of privateMarkers) expect(reportedText).not.toContain(marker);
    expect(log).not.toHaveBeenCalled();
  });

  it('consumes a late response-wait rejection when an earlier credential fill fails', async () => {
    let rejectResponse!: (reason: Error) => void;
    const responseWait = new Promise<K2ProtectedAuthUiResponse>((_resolve, reject) => {
      rejectResponse = reject;
    });
    const steps = interactions({
      fillEmail: vi.fn(async () => { throw new Error(`fill failed for ${actor.email}`); }),
      waitForSignInResponse: vi.fn(() => responseWait),
    });

    const error = await rejectedError(runK2ProtectedAuthUiSignIn(actor, steps));
    rejectResponse(new Error(`late response failure: ${actor.password}; fake-session-marker`));
    await Promise.resolve();
    await Promise.resolve();

    expect(error.message).toBe(genericFailure);
    expect(error).not.toHaveProperty('cause');
    expect(steps.fillPassword).not.toHaveBeenCalled();
    expect(steps.clickSubmit).not.toHaveBeenCalled();
  });
});
