import {
  assertK2RetainedStateUnchanged,
  type K2HostedActorLineageProof,
  type K2RetainedSnapshot,
  type K2HostedTodayReviewTargets,
  k2RetainedTableNames,
} from './k2_hosted_probe_client';
import { dataObject, type K2BoundWaveApi, type K2HostedWaveContext, type K2HostedWavePlugin } from './k2_hosted_runner';

const DUE_SEED_SIZE = 20;
const REVIEW_PREFIX_SIZE = 15;
const OPAQUE_HANDLE_PATTERN = /^opaque-[0-9a-f]{32}$/i;
const TODAY_TABLE_DELTAS = {
  today_plans: 1,
  today_plan_activities: 1,
  today_activity_review_items: REVIEW_PREFIX_SIZE,
} as const;
const TODAY_TABLES = new Set(Object.keys(TODAY_TABLE_DELTAS));

type JsonRecord = Record<string, unknown>;

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

export function collectK2HostedDictionaryConceptIds(
  pages: readonly unknown[],
  requiredCount = DUE_SEED_SIZE,
  excludedConceptIds: readonly string[] = [],
): readonly string[] {
  if (!Number.isSafeInteger(requiredCount) || requiredCount < 1 || requiredCount > DUE_SEED_SIZE ||
      excludedConceptIds.length > 80 || excludedConceptIds.some(id => !OPAQUE_HANDLE_PATTERN.test(id))) {
    throw new Error('K2 hosted acceptance due-only dictionary selection was invalid.');
  }
  const excluded = new Set(excludedConceptIds);
  const selected: string[] = [];
  const selectedSet = new Set<string>();
  for (const rawPage of pages) {
    const envelope = record(rawPage, 'K2 hosted acceptance due-only dictionary response was invalid.');
    if (!Array.isArray(envelope.data) || envelope.data.length > 100) {
      throw new Error('K2 hosted acceptance due-only dictionary response was invalid.');
    }
    const pageIds = new Set<string>();
    for (const rawItem of envelope.data) {
      const item = record(rawItem, 'K2 hosted acceptance due-only dictionary response was invalid.');
      if (typeof item.id !== 'string' || !OPAQUE_HANDLE_PATTERN.test(item.id) || pageIds.has(item.id)) {
        throw new Error('K2 hosted acceptance due-only dictionary response was invalid.');
      }
      pageIds.add(item.id);
      if (!excluded.has(item.id) && !selectedSet.has(item.id)) {
        selected.push(item.id);
        selectedSet.add(item.id);
      }
      if (selected.length === requiredCount) return selected;
    }
  }
  return selected;
}

export function assertK2HostedDueOnlySeed(
  snapshot: K2RetainedSnapshot,
  lineage: K2HostedActorLineageProof,
): void {
  const expectedRows: Readonly<Record<string, number>> = {
    users: 1,
    learner_profiles: 1,
    user_languages: 1,
    concept_save_intents: DUE_SEED_SIZE,
    user_saved_concepts: DUE_SEED_SIZE,
    learning_events: DUE_SEED_SIZE,
    user_concept_states: DUE_SEED_SIZE,
    review_items: DUE_SEED_SIZE,
    fsrs_states: DUE_SEED_SIZE,
    review_events: 0,
    today_plans: 0,
    today_plan_activities: 0,
    today_activity_review_items: 0,
  };
  for (const [table, expected] of Object.entries(expectedRows)) {
    if (snapshot.tables[table as keyof K2RetainedSnapshot['tables']].rows !== expected) {
      throw new Error('K2 hosted acceptance due-only seed did not match its expected actor rows.');
    }
  }
  if (lineage.userConceptStateRows !== DUE_SEED_SIZE ||
      lineage.reviewItemRows !== DUE_SEED_SIZE ||
      lineage.fsrsStateRows !== DUE_SEED_SIZE ||
      lineage.recognitionEvidenceCount !== 0 ||
      lineage.listeningEvidenceCount !== 0 ||
      lineage.productionEvidenceCount !== 0 ||
      Number(lineage.productionPositiveMass) !== 0 ||
      Number(lineage.productionNegativeMass) !== 0 ||
      lineage.events.length !== 0) {
    throw new Error('K2 hosted acceptance due-only seed changed competence or review evidence.');
  }
}

export function assertK2HostedDueOnlyTodayDelta(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
): void {
  for (const table of k2RetainedTableNames()) {
    const tableName = table as keyof K2RetainedSnapshot['tables'];
    const previous = before.tables[tableName];
    const current = after.tables[tableName];
    if (TODAY_TABLES.has(table)) {
      const expectedRows = TODAY_TABLE_DELTAS[table as keyof typeof TODAY_TABLE_DELTAS];
      if (previous.rows !== 0 || current.rows !== expectedRows || previous.sha256 === current.sha256) {
        throw new Error('K2 hosted acceptance due-only generation did not add the exact Today rows.');
      }
    } else if (previous.rows !== current.rows || previous.sha256 !== current.sha256) {
      throw new Error('K2 hosted acceptance due-only generation changed non-Today learner state.');
    }
  }
  const expectedTotalDelta = Object.values(TODAY_TABLE_DELTAS).reduce((sum, count) => sum + count, 0);
  if (after.totalRows - before.totalRows !== expectedTotalDelta) {
    throw new Error('K2 hosted acceptance due-only generation changed an unexpected number of rows.');
  }
}

function reviewQueueItems(payload: unknown): readonly JsonRecord[] {
  const envelope = record(payload, 'K2 hosted acceptance due-only Review queue was invalid.');
  if (!Array.isArray(envelope.data) || envelope.data.length > 100) {
    throw new Error('K2 hosted acceptance due-only Review queue was invalid.');
  }
  return envelope.data.map(item => record(item, 'K2 hosted acceptance due-only Review queue was invalid.'));
}

function expectedDueReviewIds(
  queue: readonly JsonRecord[],
  savedConceptIds: readonly string[],
): readonly string[] {
  if (queue.length !== DUE_SEED_SIZE) {
    throw new Error('K2 hosted acceptance due-only Review queue did not contain the full seeded backlog.');
  }
  const saved = new Set(savedConceptIds);
  const itemIds = new Set<string>();
  const conceptIds = new Set<string>();
  const result: string[] = [];
  for (const item of queue) {
    const concept = record(item.concept, 'K2 hosted acceptance due-only Review queue was invalid.');
    if (typeof item.reviewItemId !== 'string' || !OPAQUE_HANDLE_PATTERN.test(item.reviewItemId) ||
        typeof concept.id !== 'string' || !saved.has(concept.id) ||
        itemIds.has(item.reviewItemId) || conceptIds.has(concept.id)) {
      throw new Error('K2 hosted acceptance due-only Review queue did not match the saved actor concepts.');
    }
    itemIds.add(item.reviewItemId);
    conceptIds.add(concept.id);
    result.push(item.reviewItemId);
  }
  if (conceptIds.size !== saved.size) {
    throw new Error('K2 hosted acceptance due-only Review queue did not match the saved actor concepts.');
  }
  return result;
}

export function assertK2HostedDueOnlyTodayPlan(
  payload: unknown,
  expectedReviewIds: readonly string[],
): void {
  const plan = dataObject(payload, 'K2 hosted acceptance due-only Today response was invalid.');
  if (expectedReviewIds.length !== DUE_SEED_SIZE ||
      plan.engineVersion !== 'today-heuristic-v2' || plan.targetMinutes !== 15 ||
      !Array.isArray(plan.activities) || plan.activities.length !== 1) {
    throw new Error('K2 hosted acceptance did not create the expected due-only Today plan.');
  }
  const activity = record(plan.activities[0], 'K2 hosted acceptance due-only Today activity was invalid.');
  if (activity.activityType !== 'review' || activity.position !== 0 ||
      activity.targetCount !== REVIEW_PREFIX_SIZE || activity.estimatedMinutes !== REVIEW_PREFIX_SIZE ||
      activity.reviewItemId !== expectedReviewIds[0]) {
    throw new Error('K2 hosted acceptance did not allocate the expected due-only Review prefix.');
  }
}

export function assertK2HostedDueOnlyPlanReplay(firstPayload: unknown, replayPayload: unknown): void {
  const first = dataObject(firstPayload, 'K2 hosted acceptance due-only Today response was invalid.');
  const replay = dataObject(replayPayload, 'K2 hosted acceptance due-only Today response was invalid.');
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error('K2 hosted acceptance due-only Today replay changed the persisted plan.');
  }
}

export function assertK2HostedDueOnlyTargetProbe(
  proof: K2HostedTodayReviewTargets,
  expectedReviewIds: readonly string[],
): void {
  const expected = expectedReviewIds.slice(0, REVIEW_PREFIX_SIZE);
  if (expectedReviewIds.length !== DUE_SEED_SIZE || proof.engineVersion !== 'today-heuristic-v2' || proof.activityCount !== 1 ||
      proof.reviewActivityCount !== 1 || proof.targetCount !== REVIEW_PREFIX_SIZE ||
      JSON.stringify(proof.reviewItemIds) !== JSON.stringify(expected)) {
    throw new Error('K2 hosted acceptance Today targets did not match the due-only Review prefix.');
  }
}

async function readReviewQueue(api: K2BoundWaveApi, profile: 'primary' | 'observer') {
  return api.request(`/v1/review/queue?languageProfileId=actor:${profile}&limit=100`);
}

export const k2HostedWaveK208DueOnly: K2HostedWavePlugin = {
  waveId: 'K2-08-DUE-ONLY',
  actorCount: 2,
  async run(context) {
    context.report('k2-08-due-only-scope');

    context.checkpoint('fixture_k208_due_only_dictionary_search', 'start');
    const pages: unknown[] = [];
    let conceptIds: readonly string[] = [];
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const query = new URLSearchParams({ query: letter, languageCode: 'en', limit: '100' });
      const response = await context.api.primary.request(`/v1/dictionary/search?${query}`);
      pages.push(response.payload);
      conceptIds = collectK2HostedDictionaryConceptIds(pages);
      if (conceptIds.length === DUE_SEED_SIZE) break;
    }
    if (conceptIds.length !== DUE_SEED_SIZE) {
      throw new Error('K2 hosted acceptance could not select 20 distinct Dictionary concepts for the due-only subcase.');
    }
    context.checkpoint('fixture_k208_due_only_dictionary_search', 'pass');

    context.checkpoint('fixture_k208_due_only_save_backlog', 'start');
    for (const conceptId of conceptIds) {
      const response = await context.api.primary.request(
        `/v1/library/concepts/${conceptId}`,
        { method: 'PUT' },
      );
      const saved = dataObject(response.payload,
        'K2 hosted acceptance due-only Save/Learn response was invalid.');
      if (saved.isSaved !== true) {
        throw new Error('K2 hosted acceptance due-only Save/Learn did not save a selected concept.');
      }
    }
    context.checkpoint('fixture_k208_due_only_save_backlog', 'pass');

    context.checkpoint('fixture_k208_due_only_review_queue', 'start');
    const queue = reviewQueueItems((await readReviewQueue(context.api.primary, 'primary')).payload);
    const expectedReviewIds = expectedDueReviewIds(queue, conceptIds);
    const observerQueue = reviewQueueItems((await readReviewQueue(context.api.observer, 'observer')).payload);
    if (observerQueue.length !== 0) {
      throw new Error('K2 hosted acceptance due-only backlog crossed actor profiles.');
    }
    context.checkpoint('fixture_k208_due_only_review_queue', 'pass');

    context.checkpoint('fixture_k208_due_only_seed_snapshot', 'start');
    const primaryBefore = await context.actorSnapshot(context.actors.primary);
    const primaryLineageBefore = await context.actorLineage(context.actors.primary);
    assertK2HostedDueOnlySeed(primaryBefore, primaryLineageBefore);
    const observerBefore = await context.actorSnapshot(context.actors.observer);
    context.requireSnapshotRows(observerBefore, {
      users: 1,
      learner_profiles: 1,
      user_languages: 1,
      concept_save_intents: 0,
      learning_events: 0,
      user_concept_states: 0,
      review_items: 0,
      fsrs_states: 0,
      review_events: 0,
      today_plans: 0,
      today_plan_activities: 0,
      today_activity_review_items: 0,
    });
    context.checkpoint('fixture_k208_due_only_seed_snapshot', 'pass');

    context.checkpoint('fixture_k208_due_only_today_generate', 'start');
    const todayRoute = '/v1/today';
    const generated = (await context.api.primary.request(todayRoute)).payload;
    assertK2HostedDueOnlyTodayPlan(generated, expectedReviewIds);
    const generatedSnapshot = await context.actorSnapshot(context.actors.primary);
    assertK2HostedDueOnlyTodayDelta(primaryBefore, generatedSnapshot);
    const primaryLineageAfter = await context.actorLineage(context.actors.primary);
    if (JSON.stringify(primaryLineageAfter) !== JSON.stringify(primaryLineageBefore)) {
      throw new Error('K2 hosted acceptance due-only generation changed competence or Review evidence.');
    }
    context.checkpoint('fixture_k208_due_only_today_generate', 'pass');

    context.checkpoint('fixture_k208_due_only_target_mapping', 'start');
    assertK2HostedDueOnlyTargetProbe(
      await context.actorTodayReviewTargets(context.actors.primary),
      expectedReviewIds,
    );
    context.checkpoint('fixture_k208_due_only_target_mapping', 'pass');

    context.checkpoint('fixture_k208_due_only_replay', 'start');
    const replay = (await context.api.primary.request(todayRoute)).payload;
    assertK2HostedDueOnlyPlanReplay(generated, replay);
    const afterReplay = await context.actorSnapshot(context.actors.primary);
    assertK2RetainedStateUnchanged(generatedSnapshot, afterReplay);
    if (JSON.stringify(await context.actorLineage(context.actors.primary)) !==
        JSON.stringify(primaryLineageBefore)) {
      throw new Error('K2 hosted acceptance due-only replay changed competence or Review evidence.');
    }
    context.checkpoint('fixture_k208_due_only_replay', 'pass');

    context.checkpoint('fixture_k208_due_only_profile_isolation', 'start');
    await context.api.observer.request(
      '/v1/today?languageProfileId=actor:primary',
      {},
      [404],
    );
    const observerAfter = await context.actorSnapshot(context.actors.observer);
    assertK2RetainedStateUnchanged(observerBefore, observerAfter);
    assertK2RetainedStateUnchanged(generatedSnapshot, await context.actorSnapshot(context.actors.primary));
    context.checkpoint('fixture_k208_due_only_profile_isolation', 'pass');
  },
};
