import {
  assertK2RetainedStateUnchanged,
  k2RetainedTableNames,
  type K2HostedActorLineageProof,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';
import {
  collectK2HostedDictionaryConceptIds,
} from './k2_hosted_wave_k2_08_due_only';
import {
  dataObject,
  type K2BoundWaveApi,
  type K2HostedCandidateInputProof,
  type K2HostedCandidateMatrixProof,
  type K2HostedWaveContext,
  type K2HostedWavePlugin,
  type K2WaveActorHandle,
} from './k2_hosted_runner';

const DUE_SEED_SIZE = 20;
const K208_ANCHOR_CONCEPT_HANDLE = 'k2-anchor';
const TODAY_TABLES = new Set([
  'today_plans', 'today_plan_activities', 'today_activity_review_items',
]);
const ROLE_ORDER = ['novel', 'weak', 'forgotten'] as const;

type JsonRecord = Record<string, unknown>;
type ActorScenario = Readonly<{
  handle: K2WaveActorHandle;
  api: K2BoundWaveApi;
  matrix: K2HostedCandidateMatrixProof;
  kind: 'due-only' | 'forgotten' | 'weak' | 'novel';
}>;
type ActivityExpectations = Readonly<{
  type: 'review' | 'read';
  count: number;
  minutes: number;
  reasonCodes: readonly string[];
  contentHandle?: string;
}>;

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function queueItems(payload: unknown): readonly JsonRecord[] {
  const envelope = record(payload, 'K2 hosted acceptance Review queue was invalid.');
  if (!Array.isArray(envelope.data) || envelope.data.length > 100) {
    throw new Error('K2 hosted acceptance Review queue was invalid.');
  }
  return envelope.data.map(item => record(item, 'K2 hosted acceptance Review queue was invalid.'));
}

function expectedDueReviewIds(
  queue: readonly JsonRecord[],
  savedConceptIds: readonly string[],
): readonly string[] {
  if (queue.length !== DUE_SEED_SIZE) {
    throw new Error('K2 hosted acceptance did not create the exact normal-API due backlog.');
  }
  const saved = new Set(savedConceptIds);
  const reviewIds = new Set<string>();
  const concepts = new Set<string>();
  const selected: string[] = [];
  for (const item of queue) {
    const concept = record(item.concept, 'K2 hosted acceptance Review queue was invalid.');
    if (typeof item.reviewItemId !== 'string' || typeof concept.id !== 'string' ||
        reviewIds.has(item.reviewItemId) || concepts.has(concept.id) || !saved.has(concept.id)) {
      throw new Error('K2 hosted acceptance due queue did not match the actor Save/Learn set.');
    }
    reviewIds.add(item.reviewItemId);
    concepts.add(concept.id);
    selected.push(item.reviewItemId);
  }
  if (concepts.size !== saved.size || saved.size !== DUE_SEED_SIZE) {
    throw new Error('K2 hosted acceptance due queue did not match the actor Save/Learn set.');
  }
  return selected;
}

function assertActivity(
  value: unknown,
  expected: ActivityExpectations,
): JsonRecord {
  const activity = record(value, 'K2 hosted acceptance Today activity was invalid.');
  if (activity.activityType !== expected.type || activity.position === undefined ||
      activity.targetCount !== expected.count || activity.estimatedMinutes !== expected.minutes ||
      !Array.isArray(activity.reasonCodes) ||
      JSON.stringify(activity.reasonCodes) !== JSON.stringify(expected.reasonCodes) ||
      (expected.contentHandle !== undefined && activity.contentId !== expected.contentHandle)) {
    throw new Error('K2 hosted acceptance Today activity did not match its exact policy result.');
  }
  return activity;
}

function assertPlan(
  payload: unknown,
  expected: readonly ActivityExpectations[],
): JsonRecord {
  const plan = dataObject(payload, 'K2 hosted acceptance Today response was invalid.');
  const activities = plan.activities;
  if (plan.engineVersion !== 'today-heuristic-v2' || plan.targetMinutes !== 15 ||
      !Array.isArray(activities) || activities.length !== expected.length) {
    throw new Error('K2 hosted acceptance did not persist the expected v2 Today plan.');
  }
  expected.forEach((activity, index) => {
    if (assertActivity(activities[index], activity).position !== index) {
      throw new Error('K2 hosted acceptance Today activity order did not match the persisted plan.');
    }
  });
  const usedMinutes = expected.reduce((sum, activity) => sum + activity.minutes, 0);
  if (usedMinutes > 15) throw new Error('K2 hosted acceptance Today plan exceeded the daily budget.');
  return plan;
}

function firstPendingActivityTarget(plan: JsonRecord): Readonly<{
  planHandle: string;
  activityHandle: string;
}> {
  const activities = plan.activities;
  if (typeof plan.id !== 'string' || /^[0-9a-f-]{36}$/i.test(plan.id) ||
      !Array.isArray(activities) || activities.length === 0) {
    throw new Error('K2 hosted acceptance persisted Today target handles were invalid.');
  }
  const first = record(activities[0], 'K2 hosted acceptance persisted Today target handles were invalid.');
  if (typeof first.id !== 'string' || /^[0-9a-f-]{36}$/i.test(first.id) || first.status !== 'pending') {
    throw new Error('K2 hosted acceptance persisted Today target handles were invalid.');
  }
  return { planHandle: plan.id, activityHandle: first.id };
}

function assertReplay(first: unknown, replay: unknown): void {
  if (JSON.stringify(dataObject(first, 'K2 hosted acceptance Today response was invalid.')) !==
      JSON.stringify(dataObject(replay, 'K2 hosted acceptance Today response was invalid.'))) {
    throw new Error('K2 hosted acceptance Today replay changed persisted plan identity or order.');
  }
}

function assertLineageUnchanged(
  before: K2HostedActorLineageProof,
  after: K2HostedActorLineageProof,
): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('K2 hosted acceptance Today generation changed learner competence or Review evidence.');
  }
}

function assertTodayOnlyDelta(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
  expected: Readonly<{ plans: number; activities: number; targets: number }>,
): void {
  const rowDeltas: Readonly<Record<string, number>> = {
    today_plans: expected.plans,
    today_plan_activities: expected.activities,
    today_activity_review_items: expected.targets,
  };
  for (const table of k2RetainedTableNames()) {
    const tableName = table as keyof K2RetainedSnapshot['tables'];
    const oldRow = before.tables[tableName];
    const newRow = after.tables[tableName];
    const delta = TODAY_TABLES.has(table)
      ? rowDeltas[table as keyof typeof rowDeltas]
      : 0;
    if (newRow.rows - oldRow.rows !== delta ||
        (delta === 0 && newRow.sha256 !== oldRow.sha256) ||
        (delta > 0 && newRow.sha256 === oldRow.sha256)) {
      throw new Error('K2 hosted acceptance Today generation changed a non-allowlisted actor table.');
    }
  }
  const totalDelta = expected.plans + expected.activities + expected.targets;
  if (after.totalRows - before.totalRows !== totalDelta) {
    throw new Error('K2 hosted acceptance Today generation added an unexpected actor row count.');
  }
}

function assertCandidateMatrix(matrix: K2HostedCandidateMatrixProof): void {
  const entries = [matrix.novel, matrix.weak, matrix.forgotten];
  if (matrix.novel.unseenConceptCount > 4 || matrix.novel.linkedConceptHandles.length > 4 ||
      matrix.weak.unseenConceptCount > 4 || matrix.weak.linkedConceptHandles.length > 4 ||
      matrix.forgotten.unseenConceptCount > 4 || matrix.forgotten.linkedConceptHandles.length > 4 ||
      matrix.weak.estimatedMinutes !== 5 || matrix.forgotten.estimatedMinutes !== 5 ||
      new Set(entries.map(row => row.contentHandle)).size !== 3) {
    throw new Error('K2 hosted acceptance did not prove all N/W/F competitors are eligible.');
  }
}

function assertCandidateInputProof(
  proof: K2HostedCandidateInputProof,
  scenario: ActorScenario['kind'],
): void {
  const expectedStatus = scenario === 'forgotten'
    ? { novel: 'none', weak: 'weak', forgotten: 'forgotten' }
    : scenario === 'weak'
      ? { novel: 'none', weak: 'weak', forgotten: 'none' }
      : { novel: 'none', weak: 'none', forgotten: 'none' };
  if (!proof.allCompetitorsEligible ||
      JSON.stringify(proof.baselineRoleOrder) !== JSON.stringify(ROLE_ORDER) ||
      JSON.stringify(proof.effectiveStatus) !== JSON.stringify(expectedStatus)) {
    throw new Error('K2 hosted acceptance candidate input proof did not match its scenario.');
  }
}

function scenarioMatrix(context: K2HostedWaveContext): readonly ActorScenario[] {
  const candidates = [
    [context.actors.primary, context.api.primary, 'due-only'],
    [context.actors.observer, context.api.observer, 'forgotten'],
    [context.actors.scenarioC, context.api.scenarioC, 'weak'],
    [context.actors.scenarioD, context.api.scenarioD, 'novel'],
  ] as const;
  return candidates.map(([handle, api, kind]) => {
    const matrix = handle ? context.candidateMatrix?.[handle] : undefined;
    if (!handle || !api || !matrix) {
      throw new Error('K2 hosted acceptance full-wave four-actor matrix was incomplete.');
    }
    assertCandidateMatrix(matrix);
    return { handle, api, matrix, kind };
  });
}

async function seedDueBacklog(
  api: K2BoundWaveApi,
  excludedConceptHandles: readonly string[],
): Promise<readonly string[]> {
  const pages: unknown[] = [];
  let concepts: readonly string[] = [];
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const query = new URLSearchParams({ query: letter, languageCode: 'en', limit: '100' });
    const envelope = record(
      (await api.request(`/v1/dictionary/search?${query}`)).payload,
      'K2 hosted acceptance due-only dictionary response was invalid.',
    );
    if (!Array.isArray(envelope.data) || envelope.data.length > 100) {
      throw new Error('K2 hosted acceptance due-only dictionary response was invalid.');
    }
    let anchorCount = 0;
    for (const rawItem of envelope.data) {
      if (record(rawItem, 'K2 hosted acceptance due-only dictionary response was invalid.').id ===
          K208_ANCHOR_CONCEPT_HANDLE) {
        anchorCount += 1;
      }
    }
    if (anchorCount > 1) {
      throw new Error('K2 hosted acceptance due-only dictionary response was invalid.');
    }
    pages.push({
      data: envelope.data.filter(rawItem =>
        record(rawItem, 'K2 hosted acceptance due-only dictionary response was invalid.').id !==
        K208_ANCHOR_CONCEPT_HANDLE),
    });
    concepts = collectK2HostedDictionaryConceptIds(pages, DUE_SEED_SIZE, excludedConceptHandles);
    if (concepts.length === DUE_SEED_SIZE) break;
  }
  if (concepts.length !== DUE_SEED_SIZE) {
    throw new Error('K2 hosted acceptance could not select twenty Dictionary concepts.');
  }
  for (const conceptHandle of concepts) {
    const result = dataObject((await api.request(`/v1/library/concepts/${conceptHandle}`, {
      method: 'PUT',
    })).payload, 'K2 hosted acceptance normal Save/Learn response was invalid.');
    if (result.isSaved !== true) {
      throw new Error('K2 hosted acceptance normal Save/Learn did not confirm a due input.');
    }
  }
  return concepts;
}

async function readQueue(api: K2BoundWaveApi): Promise<readonly JsonRecord[]> {
  const response = await api.request('/v1/review/queue?limit=100');
  return queueItems(response.payload);
}

async function checkProfileIsolation(
  scenarios: readonly ActorScenario[],
  planTargets: ReadonlyMap<K2WaveActorHandle, Readonly<{ planHandle: string; activityHandle: string }>>,
): Promise<void> {
  for (const actor of scenarios) {
    for (const other of scenarios) {
      if (actor.handle === other.handle) continue;
      const result = await actor.api.request(
        `/v1/today?languageProfileId=actor:${other.handle}`,
        {},
        [404],
      );
      if (result.status !== 404) {
        throw new Error('K2 hosted acceptance cross-actor profile access was not hidden.');
      }
      const target = planTargets.get(other.handle);
      if (!target) throw new Error('K2 hosted acceptance cross-actor plan target was unavailable.');
      const completion = await actor.api.request(
        `/v1/today/${target.planHandle}/activities/${target.activityHandle}/complete`,
        {
          method: 'POST',
          idempotencyKey: `k208-denial-${actor.handle}-${other.handle}`,
          body: {},
        },
        [403, 404],
      );
      if (completion.status !== 403 && completion.status !== 404) {
        throw new Error('K2 hosted acceptance cross-actor Today completion was not denied.');
      }
    }
  }
}

export const k2HostedWaveK208: K2HostedWavePlugin = {
  waveId: 'K2-08',
  actorCount: 4,
  async run(context) {
    context.report('k2-08-full-scope');
    const scenarios = scenarioMatrix(context);
    const [dueOnly, forgotten, weak, novel] = scenarios;
    if (!context.verifyDueCandidateIsolation || !context.fixtureSetup || !context.candidateProof) {
      throw new Error('K2 hosted acceptance full-wave runner capabilities were incomplete.');
    }

    const remediationConceptHandles = [...new Set(scenarios.flatMap(scenario => [
      ...scenario.matrix.novel.linkedConceptHandles,
      ...scenario.matrix.weak.linkedConceptHandles,
      ...scenario.matrix.forgotten.linkedConceptHandles,
    ]))];
    if (remediationConceptHandles.includes(K208_ANCHOR_CONCEPT_HANDLE)) {
      throw new Error('K2 hosted acceptance K2-08 remediation graph included the fixed anchor concept.');
    }
    context.checkpoint('fixture_k208_due_seed', 'start');
    const duePrimary = await seedDueBacklog(dueOnly.api, remediationConceptHandles);
    const dueForgotten = await seedDueBacklog(forgotten.api, remediationConceptHandles);
    const primaryQueue = await readQueue(dueOnly.api);
    const forgottenQueue = await readQueue(forgotten.api);
    const primaryReviewIds = expectedDueReviewIds(primaryQueue, duePrimary);
    const forgottenReviewIds = expectedDueReviewIds(forgottenQueue, dueForgotten);
    if ((await readQueue(weak.api)).length !== 0 || (await readQueue(novel.api)).length !== 0) {
      throw new Error('K2 hosted acceptance due backlog crossed a fresh actor boundary.');
    }
    await context.verifyDueCandidateIsolation();
    context.checkpoint('fixture_k208_due_seed', 'pass');

    context.checkpoint('fixture_k208_forgotten_weak_pair', 'start');
    await context.fixtureSetup.seedForgottenWeakPair();
    context.checkpoint('fixture_k208_forgotten_weak_pair', 'pass');
    context.checkpoint('fixture_k208_weak_only', 'start');
    await context.fixtureSetup.seedWeakOnly();
    context.checkpoint('fixture_k208_weak_only', 'pass');

    context.checkpoint('fixture_k208_candidate_matrix', 'start');
    for (const scenario of scenarios) {
      const proof = await context.candidateProof(scenario.handle);
      assertCandidateInputProof(proof, scenario.kind);
    }
    context.checkpoint('fixture_k208_candidate_matrix', 'pass');

    const baseSnapshots = new Map<K2WaveActorHandle, K2RetainedSnapshot>();
    const baseLineages = new Map<K2WaveActorHandle, K2HostedActorLineageProof>();
    context.checkpoint('fixture_k208_post_setup_snapshots', 'start');
    for (const scenario of scenarios) {
      const snapshot = await context.actorSnapshot(scenario.handle);
      const lineage = await context.actorLineage(scenario.handle);
      const expectedStateRows = scenario.kind === 'due-only' ? 20
        : scenario.kind === 'forgotten' ? 22
          : scenario.kind === 'weak' ? 1 : 0;
      const expectedReviewRows = scenario.kind === 'due-only' || scenario.kind === 'forgotten' ? 20 : 0;
      context.requireSnapshotRows(snapshot, {
        users: 1,
        learner_profiles: 1,
        user_languages: 1,
        concept_save_intents: expectedReviewRows,
        user_saved_concepts: expectedReviewRows,
        learning_events: expectedReviewRows,
        user_concept_states: expectedStateRows,
        review_items: expectedReviewRows,
        fsrs_states: expectedReviewRows,
        review_events: 0,
        today_plans: 0,
        today_plan_activities: 0,
        today_activity_review_items: 0,
      });
      // `_actor_lineage` is anchor-scoped; actor-wide row totals are checked in the snapshot above.
      if (lineage.userConceptStateRows !== 0 || lineage.reviewItemRows !== 0 || lineage.fsrsStateRows !== 0 ||
          lineage.recognitionEvidenceCount !== 0 || lineage.listeningEvidenceCount !== 0 ||
          lineage.productionEvidenceCount !== 0 || Number(lineage.productionPositiveMass) !== 0 ||
          Number(lineage.productionNegativeMass) !== 0 || lineage.events.length !== 0) {
        throw new Error('K2 hosted acceptance fixture setup changed unexpected learner evidence.');
      }
      baseSnapshots.set(scenario.handle, snapshot);
      baseLineages.set(scenario.handle, lineage);
    }
    context.checkpoint('fixture_k208_post_setup_snapshots', 'pass');

    const novelHandle = forgotten.matrix.novel.contentHandle;
    const weakHandle = forgotten.matrix.weak.contentHandle;
    const forgottenHandle = forgotten.matrix.forgotten.contentHandle;
    if (weak.matrix.novel.contentHandle !== novelHandle || novel.matrix.novel.contentHandle !== novelHandle ||
        weak.matrix.weak.contentHandle !== weakHandle || novel.matrix.weak.contentHandle !== weakHandle ||
        weak.matrix.forgotten.contentHandle !== forgottenHandle || novel.matrix.forgotten.contentHandle !== forgottenHandle) {
      throw new Error('K2 hosted acceptance actor candidate handles were not a single shared matrix.');
    }

    const afterSnapshots = new Map<K2WaveActorHandle, K2RetainedSnapshot>();
    const planTargets = new Map<K2WaveActorHandle, Readonly<{
      planHandle: string;
      activityHandle: string;
    }>>();
    context.checkpoint('fixture_k208_today_generation', 'start');
    for (const scenario of scenarios) {
      const expected: ActivityExpectations[] = scenario.kind === 'due-only'
        ? [{ type: 'review', count: 15, minutes: 15, reasonCodes: ['FSRS_DUE'] }]
        : scenario.kind === 'forgotten'
          ? [
              { type: 'review', count: 10, minutes: 10, reasonCodes: ['FSRS_DUE'] },
              { type: 'read', count: 1, minutes: 5, contentHandle: forgottenHandle,
                reasonCodes: ['FORGOTTEN_REMEDIATION', 'CONTENT_FIT', 'WEAK_RECOGNITION'] },
            ]
          : scenario.kind === 'weak'
            ? [{ type: 'read', count: 1, minutes: 5, contentHandle: weakHandle,
                reasonCodes: ['WEAK_REMEDIATION', 'CONTENT_FIT', 'NEW_CONCEPT_BUDGET'] }]
            : [{ type: 'read', count: 1, minutes: Math.min(10, Math.max(5, novel.matrix.novel.estimatedMinutes)),
                contentHandle: novelHandle, reasonCodes: ['CONTENT_FIT', 'NEW_CONCEPT_BUDGET'] }];
      const generated = (await scenario.api.request('/v1/today')).payload;
      const persistedPlan = assertPlan(generated, expected);
      planTargets.set(scenario.handle, firstPendingActivityTarget(persistedPlan));
      if (scenario.kind === 'due-only' || scenario.kind === 'forgotten') {
        const queue = scenario.kind === 'due-only' ? primaryReviewIds : forgottenReviewIds;
        const targetCount = scenario.kind === 'due-only' ? 15 : 10;
        const reviewIds = await context.actorTodayReviewTargets(scenario.handle);
        const wanted = queue.slice(0, targetCount);
        if (reviewIds.engineVersion !== 'today-heuristic-v2' || reviewIds.activityCount !== expected.length ||
            reviewIds.reviewActivityCount !== 1 || reviewIds.targetCount !== targetCount ||
            JSON.stringify(reviewIds.reviewItemIds) !== JSON.stringify(wanted)) {
          throw new Error('K2 hosted acceptance Today review targets did not match the due prefix.');
        }
      }
      const firstSnapshot = await context.actorSnapshot(scenario.handle);
      const before = baseSnapshots.get(scenario.handle);
      const beforeLineage = baseLineages.get(scenario.handle);
      if (!before || !beforeLineage) throw new Error('K2 hosted acceptance actor baseline was incomplete.');
      const deltas = scenario.kind === 'due-only' ? { plans: 1, activities: 1, targets: 15 }
        : scenario.kind === 'forgotten' ? { plans: 1, activities: 2, targets: 10 }
          : { plans: 1, activities: 1, targets: 0 };
      assertTodayOnlyDelta(before, firstSnapshot, deltas);
      assertLineageUnchanged(beforeLineage, await context.actorLineage(scenario.handle));
      const replay = (await scenario.api.request('/v1/today')).payload;
      assertReplay(generated, replay);
      const afterReplay = await context.actorSnapshot(scenario.handle);
      assertK2RetainedStateUnchanged(firstSnapshot, afterReplay);
      assertLineageUnchanged(beforeLineage, await context.actorLineage(scenario.handle));
      afterSnapshots.set(scenario.handle, afterReplay);
    }
    context.checkpoint('fixture_k208_today_generation', 'pass');

    context.checkpoint('fixture_k208_cross_actor_isolation', 'start');
    await checkProfileIsolation(scenarios, planTargets);
    for (const scenario of scenarios) {
      const after = afterSnapshots.get(scenario.handle);
      if (!after) throw new Error('K2 hosted acceptance actor isolation snapshot was incomplete.');
      assertK2RetainedStateUnchanged(after, await context.actorSnapshot(scenario.handle));
    }
    context.checkpoint('fixture_k208_cross_actor_isolation', 'pass');
  },
};
