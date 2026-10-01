import {
  assertK2RetainedStateUnchanged,
  type K2HostedActorLineageProof,
  type K2HostedAnchorMaterial,
} from './k2_hosted_probe_client';
import { dataObject, type K2HostedWaveContext, type K2HostedWavePlugin } from './k2_hosted_runner';

type ExerciseMode = 'self_recall' | 'typing' | 'cloze' | 'listening';
type DimensionName = 'recognition' | 'listening' | 'production';

const DIMENSION_ORDER: readonly DimensionName[] = ['recognition', 'listening', 'production'];
const ANCHOR_ID = 'k2-anchor';
const ANCHOR_LEMMA = 'frll-anchor';

export const K2_07_PRIMARY_AFTER_SAVE_ROWS = {
  users: 1,
  learner_profiles: 1,
  user_languages: 1,
  concept_save_intents: 1,
  learning_events: 1,
  user_concept_states: 1,
  review_items: 1,
  fsrs_states: 1,
  review_events: 0,
} as const;

export const K2_07_OBSERVER_AFTER_PRIMARY_SAVE_ROWS = {
  users: 1,
  learner_profiles: 1,
  user_languages: 1,
  concept_save_intents: 0,
  learning_events: 0,
  user_concept_states: 0,
  review_items: 0,
  fsrs_states: 0,
  review_events: 0,
} as const;

export const K2_07_PRIMARY_AFTER_SAVE_LINEAGE = {
  stateRows: 1,
  reviewItems: 1,
  fsrsStates: 1,
  productionEvidence: 0,
  negativeMass: 0,
  events: 0,
} as const;

const K2_07_OBSERVER_AFTER_PRIMARY_SAVE_LINEAGE = {
  stateRows: 0,
  reviewItems: 0,
  fsrsStates: 0,
  productionEvidence: 0,
  negativeMass: 0,
  events: 0,
} as const;

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

/** Mirrors the accepted selector: weakest observed dimension, skipping unavailable material. */
export function selectK2HostedExerciseMode(
  rawSignals: unknown,
  material: K2HostedAnchorMaterial,
): ExerciseMode {
  const signals = record(rawSignals, 'K2 hosted acceptance competence signals were invalid.');
  const ranked = DIMENSION_ORDER.map((dimension, order) => {
    const signal = record(signals[dimension], 'K2 hosted acceptance competence signals were invalid.');
    const score = signal.score;
    const evidenceCount = signal.evidenceCount;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1 ||
        !Number.isSafeInteger(evidenceCount) || (evidenceCount as number) < 0) {
      throw new Error('K2 hosted acceptance competence signals were invalid.');
    }
    return { dimension, order, score, evidenceCount: evidenceCount as number };
  }).filter(signal => signal.evidenceCount > 0)
    .sort((left, right) => left.score - right.score || left.order - right.order);

  for (const signal of ranked) {
    if (signal.dimension === 'recognition' && material.hasPublishedClozeTarget) return 'cloze';
    if (signal.dimension === 'listening' && material.hasHttpsAudio) return 'listening';
    if (signal.dimension === 'production' && material.hasTranslatedDefinition) return 'typing';
  }
  return 'self_recall';
}

export function requireK2HostedLineage(
  proof: K2HostedActorLineageProof,
  expected: {
    readonly stateRows: number;
    readonly reviewItems: number;
    readonly fsrsStates: number;
    readonly productionEvidence: number;
    readonly negativeMass: number;
    readonly events: number;
  },
): void {
  const numericMass = Number(proof.productionNegativeMass);
  if (proof.userConceptStateRows !== expected.stateRows ||
      proof.reviewItemRows !== expected.reviewItems ||
      proof.fsrsStateRows !== expected.fsrsStates ||
      proof.recognitionEvidenceCount !== 0 ||
      proof.listeningEvidenceCount !== 0 ||
      proof.productionEvidenceCount !== expected.productionEvidence ||
      !Number.isFinite(numericMass) || Math.abs(numericMass - expected.negativeMass) > 0.0001 ||
      Number(proof.productionPositiveMass) !== 0 ||
      proof.events.length !== expected.events) {
    throw new Error('K2 hosted acceptance did not preserve one expected competence and FSRS lineage.');
  }
}

function requireEvent(
  proof: K2HostedActorLineageProof,
  mode: 'self_recall' | 'typing',
  expectedCount: number,
): void {
  const event = proof.events.find(item => item.exerciseMode === mode);
  if (!event || event.evidenceMode !== 'production' ||
      event.resultProductionEvidenceCount !== expectedCount) {
    throw new Error('K2 hosted acceptance review event evidence did not match the selected mode.');
  }
  if (mode === 'self_recall' && event.correct !== false) {
    throw new Error('K2 hosted acceptance self-recall evidence did not preserve caller-reported correctness.');
  }
  if (mode === 'typing' && (event.correct !== null || !event.responseTextMatchesAnchor)) {
    throw new Error('K2 hosted acceptance typing evidence was not stored as ungraded production input.');
  }
}

function queueItems(payload: unknown): readonly Record<string, unknown>[] {
  const envelope = record(payload, 'K2 hosted acceptance review queue response was invalid.');
  const data = envelope.data;
  if (!Array.isArray(data)) throw new Error('K2 hosted acceptance review queue response was invalid.');
  return data.map(item => record(item, 'K2 hosted acceptance review item was invalid.'));
}

function onlyAnchorItem(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  if (items.length !== 1) throw new Error('K2 hosted acceptance expected one due canonical review item.');
  const item = items[0];
  const concept = record(item.concept, 'K2 hosted acceptance review item was invalid.');
  if (concept.id !== ANCHOR_ID || typeof item.reviewItemId !== 'string') {
    throw new Error('K2 hosted acceptance canonical review identity was invalid.');
  }
  return item;
}

async function answerAndReplay(
  context: K2HostedWaveContext,
  item: Record<string, unknown>,
  mode: 'self_recall' | 'typing',
): Promise<Record<string, unknown>> {
  const answerPhase = mode === 'self_recall' ? 'fixture_self_recall_answer' : 'fixture_typing_answer';
  const replayPhase = mode === 'self_recall' ? 'fixture_self_recall_replay' : 'fixture_typing_replay';
  const body = mode === 'self_recall'
    ? { rating: 'again', exerciseMode: mode, correct: false, responseTimeMs: 1200 }
    : { rating: 'again', exerciseMode: mode, responseText: ANCHOR_LEMMA, responseTimeMs: 1200 };
  const answerPath = `/v1/review/${item.reviewItemId}/answer`;
  const idempotencyKey = mode === 'self_recall' ? 'self-recall-answer' : 'typing-answer';
  context.checkpoint(answerPhase, 'start');
  const first = dataObject((await context.api.primary.request(answerPath, {
    method: 'POST', idempotencyKey, body,
  })).payload, 'K2 hosted acceptance review answer response was invalid.');
  const competence = record(first.competence, 'K2 hosted acceptance review answer competence was invalid.');
  const production = record(competence.production, 'K2 hosted acceptance review answer competence was invalid.');
  if (production.evidenceCount !== (mode === 'self_recall' ? 1 : 2)) {
    throw new Error('K2 hosted acceptance answer result did not report the expected production evidence count.');
  }
  context.checkpoint(answerPhase, 'pass');
  context.checkpoint('fixture_answer_persistence_snapshot', 'start');
  const afterAnswer = await context.actorSnapshot(context.actors.primary);
  context.checkpoint('fixture_answer_persistence_snapshot', 'pass');

  context.checkpoint(replayPhase, 'start');
  const replay = dataObject((await context.api.primary.request(answerPath, {
    method: 'POST', idempotencyKey, body,
  })).payload, 'K2 hosted acceptance replay response was invalid.');
  if (JSON.stringify(first) !== JSON.stringify(replay)) {
    throw new Error('K2 hosted acceptance exact replay returned a different saved result.');
  }
  context.checkpoint(replayPhase, 'pass');
  context.checkpoint('fixture_replay_snapshot', 'start');
  const afterReplay = await context.actorSnapshot(context.actors.primary);
  assertK2RetainedStateUnchanged(afterAnswer, afterReplay);
  context.checkpoint('fixture_replay_snapshot', 'pass');
  return first;
}

async function waitForPrimaryDueItem(
  context: K2HostedWaveContext,
  queuePath: string,
  previousItemId: string,
  material: K2HostedAnchorMaterial,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const items = queueItems((await context.api.primary.request(queuePath)).payload);
    if (items.length > 0) {
      const item = onlyAnchorItem(items);
      if (item.reviewItemId !== previousItemId) {
        throw new Error('K2 hosted acceptance review lineage changed unexpectedly after an answer.');
      }
      const expected = selectK2HostedExerciseMode(item.competence, material);
      if (item.exerciseMode !== expected) {
        throw new Error('K2 hosted acceptance Review mode did not match weakest observed competence and available material.');
      }
      return item;
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
  throw new Error('K2 hosted acceptance expected review item did not become due within the bounded wait.');
}

export const k2HostedWaveK207: K2HostedWavePlugin = {
  waveId: 'K2-07',
  actorCount: 2,
  async run(context) {
    context.checkpoint('fixture_anchor_material', 'start');
    const material = await context.anchorMaterial();
    context.checkpoint('fixture_anchor_material', 'pass');
    if (!material.hasTranslatedDefinition || material.hasHttpsAudio || material.hasPublishedClozeTarget) {
      throw new Error('K2 hosted acceptance canonical material inventory changed; K2-07 fixture needs review.');
    }
    context.report('k2-07-untested-modalities');

    context.checkpoint('fixture_canonical_concept_fetch', 'start');
    const concept = dataObject((await context.api.primary.request(
      `/v1/concepts/${ANCHOR_ID}`,
    )).payload, 'K2 hosted acceptance canonical anchor was not available.');
    if (concept.id !== ANCHOR_ID) throw new Error('K2 hosted acceptance canonical anchor identity was invalid.');
    context.checkpoint('fixture_canonical_concept_fetch', 'pass');
    context.checkpoint('fixture_primary_save', 'start');
    const saved = dataObject((await context.api.primary.request(
      `/v1/library/concepts/${ANCHOR_ID}`,
      { method: 'PUT' },
    )).payload, 'K2 hosted acceptance anchor save response was invalid.');
    if (saved.isSaved !== true) throw new Error('K2 hosted acceptance canonical anchor was not saved.');
    context.checkpoint('fixture_primary_save', 'pass');

    context.checkpoint('fixture_post_save_primary_snapshot', 'start');
    const savedState = await context.actorSnapshot(context.actors.primary);
    context.requireSnapshotRows(savedState, K2_07_PRIMARY_AFTER_SAVE_ROWS);
    context.checkpoint('fixture_post_save_primary_snapshot', 'pass');
    context.checkpoint('fixture_post_save_observer_snapshot', 'start');
    const observerState = await context.actorSnapshot(context.actors.observer);
    context.requireSnapshotRows(observerState, K2_07_OBSERVER_AFTER_PRIMARY_SAVE_ROWS);
    context.checkpoint('fixture_post_save_observer_snapshot', 'pass');
    context.checkpoint('fixture_post_save_lineage', 'start');
    requireK2HostedLineage(await context.actorLineage(context.actors.primary), K2_07_PRIMARY_AFTER_SAVE_LINEAGE);
    requireK2HostedLineage(
      await context.actorLineage(context.actors.observer),
      K2_07_OBSERVER_AFTER_PRIMARY_SAVE_LINEAGE,
    );
    context.checkpoint('fixture_post_save_lineage', 'pass');

    context.checkpoint('fixture_observer_review_queue', 'start');
    const observerItems = queueItems((await context.api.observer.request(
      '/v1/review/queue?languageProfileId=actor:observer',
    )).payload);
    if (observerItems.length !== 0) throw new Error('K2 hosted acceptance observer received a review item.');
    context.checkpoint('fixture_observer_review_queue', 'pass');

    const queuePath = '/v1/review/queue?languageProfileId=actor:primary';
    context.checkpoint('fixture_primary_review_queue', 'start');
    const initialItem = onlyAnchorItem(queueItems((await context.api.primary.request(queuePath)).payload));
    const initialMode = selectK2HostedExerciseMode(initialItem.competence, material);
    if (initialMode !== 'self_recall' || initialItem.exerciseMode !== initialMode) {
      throw new Error('K2 hosted acceptance initial Review mode did not follow zero-evidence selection policy.');
    }
    context.report('k2-07-selected-modes');
    context.checkpoint('fixture_primary_review_queue', 'pass');

    // Prove a second disposable actor cannot mutate the first actor's review item.
    context.checkpoint('fixture_cross_actor_isolation', 'start');
    const primaryBeforeIsolation = await context.actorSnapshot(context.actors.primary);
    const observerBeforeIsolation = await context.actorSnapshot(context.actors.observer);
    await context.api.observer.request(
      `/v1/review/${initialItem.reviewItemId}/answer`,
      {
        method: 'POST',
        idempotencyKey: 'cross-actor-answer',
        body: { rating: 'again', exerciseMode: initialMode, responseTimeMs: 50 },
      },
      [403, 404],
    );
    assertK2RetainedStateUnchanged(primaryBeforeIsolation,
      await context.actorSnapshot(context.actors.primary));
    assertK2RetainedStateUnchanged(observerBeforeIsolation,
      await context.actorSnapshot(context.actors.observer));
    context.checkpoint('fixture_cross_actor_isolation', 'pass');

    await answerAndReplay(context, initialItem, 'self_recall');
    context.checkpoint('fixture_self_recall_verification', 'start');
    const afterSelfRecall = await context.actorSnapshot(context.actors.primary);
    context.requireSnapshotRows(afterSelfRecall, {
      user_concept_states: 1, review_items: 1, fsrs_states: 1, review_events: 1,
    });
    const selfRecallLineage = await context.actorLineage(context.actors.primary);
    requireK2HostedLineage(selfRecallLineage, {
      stateRows: 1, reviewItems: 1, fsrsStates: 1, productionEvidence: 1, negativeMass: 0.5, events: 1,
    });
    requireEvent(selfRecallLineage, 'self_recall', 1);
    context.checkpoint('fixture_self_recall_verification', 'pass');

    context.checkpoint('fixture_due_item_wait', 'start');
    const typingItem = await waitForPrimaryDueItem(context, queuePath, String(initialItem.reviewItemId), material);
    context.checkpoint('fixture_due_item_wait', 'pass');
    if (typingItem.exerciseMode !== 'typing') {
      throw new Error('K2 hosted acceptance weakest production dimension did not select available typing material.');
    }
    await answerAndReplay(context, typingItem, 'typing');
    context.checkpoint('fixture_typing_verification', 'start');
    const afterTyping = await context.actorSnapshot(context.actors.primary);
    context.requireSnapshotRows(afterTyping, {
      user_concept_states: 1, review_items: 1, fsrs_states: 1, review_events: 2,
    });
    const finalLineage = await context.actorLineage(context.actors.primary);
    requireK2HostedLineage(finalLineage, {
      stateRows: 1, reviewItems: 1, fsrsStates: 1, productionEvidence: 2, negativeMass: 1, events: 2,
    });
    requireEvent(finalLineage, 'self_recall', 1);
    requireEvent(finalLineage, 'typing', 2);
    context.checkpoint('fixture_typing_verification', 'pass');

    context.checkpoint('fixture_final_observer_verification', 'start');
    const finalObserverState = await context.actorSnapshot(context.actors.observer);
    assertK2RetainedStateUnchanged(observerState, finalObserverState);
    context.checkpoint('fixture_final_observer_verification', 'pass');
  },
};
