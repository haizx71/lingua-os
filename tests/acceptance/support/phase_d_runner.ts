/**
 * First Real Learning Loop (FRLL) - Phase D Acceptance Runner.
 *
 * Implements the deterministic sequence for:
 * D1. Run Phase C prerequisite setup (real auth, profile, timezone, Save/Learn, Memory lineage, Today target)
 * D2. Confirm pre-Answer database state:
 *     - Exactly 1 review item, 1 FSRS state in 'new', state_version=1, last_review_at=null
 *     - Exactly 0 review events, 1 save learning event
 *     - concept_state has_projectable_evidence=false, production_evidence_count=0
 * D3. Fetch Review Queue via GET /v1/review/queue?languageProfileId=<profileId>
 *     - Assert HTTP 200, items include reviewItemId
 *     - Queue query is read-only and causes 0 mutations
 * D4. Submit real Review Answer via POST /v1/review/{reviewItemId}/answer
 *     - Header Idempotency-Key: <UUID>
 *     - Payload: { rating: 'good', responseTimeMs: 1500 }
 *     - Assert HTTP 200, parse ReviewAnswerResult
 * D5. Observational PostgreSQL probe proving atomic state transition (FRLL-08, FRLL-09):
 *     - A. Scheduler: review_items=1, fsrs_states=1, state_version=2, state!='new', last_review_at!=null, due_at updated
 *     - B. Review event: review_events=1, matching review_item_id, idempotency_key, rating='good', snapshots present
 *     - C. Canonical learning event: learning_events=2, event_type='learning.review.completed.v1', source_type='review_event', ingestion_sequence=2
 *     - D. Competence: concept_state has_projectable_evidence=true, production_evidence_count=1, recognition/listening evidence=0
 *     - E. Atomicity: all 5 components co-exist concurrently in the database
 * D6. Idempotent replay proof (FRLL-10):
 *     - Replay identical POST with same Idempotency-Key
 *     - Assert HTTP 200, response matches first snapshot
 *     - Observational probe: state_version remains 2, zero duplicate rows across all tables
 * D7. Bounded negative assertion (Conflict guard):
 *     - Submit same Idempotency-Key with changed payload (rating: 'hard')
 *     - Assert HTTP 409 Conflict, zero database mutations
 * D8. Post-answer queue reconcile:
 *     - GET /v1/review/queue shows reviewItemId is no longer due
 * Cleanup: Complete teardown of disposable actor and post-cleanup observational verification
 */

import { randomUUID } from 'node:crypto';
import {
  FRLL_ANCHOR_CONCEPT_ID,
  isTeardownVerified,
  teardownRealLearner,
  type FrllCleanupReport,
  type ParsedMeResponse,
  type PhaseBCleanupReport,
} from './phase_b_runner';
import {
  setupRealLearnerThroughTodayTarget,
  type TodayActivityDto,
  type TodayPlanDto,
  type ReviewTargetHandoff,
  type SetupTodayLearnerOptions,
  type TodayLearnerContext,
} from './phase_c_runner';
import {
  captureLearnerDigestFromPostgres,
  type LearnerStateDigest,
} from './postgres_probe_client';

export interface CompetenceScoreDto {
  readonly score: number;
  readonly confidence: number;
  readonly evidenceCount: number;
  readonly updatedAt?: string | null;
}

export interface CompetenceSignalsDto {
  readonly recognition: CompetenceScoreDto;
  readonly listening: CompetenceScoreDto;
  readonly production: CompetenceScoreDto;
}

export interface MemorySnapshotDto {
  readonly state: string;
  readonly dueAt: string;
  readonly lastReviewedAt?: string | null;
  readonly isDue: boolean;
}

export interface ReviewQueueItemDto {
  readonly reviewItemId: string;
  readonly concept: {
    readonly id: string;
    readonly canonicalForm: string;
    readonly partOfSpeech?: string | null;
    readonly status: string;
    readonly isDue: boolean;
  };
  readonly exerciseMode: string;
  readonly prompt: {
    readonly promptText: string;
    readonly contextSentence?: string | null;
    readonly translation?: string | null;
  };
  readonly memory: MemorySnapshotDto;
  readonly competence: CompetenceSignalsDto;
}

export interface ReviewAnswerResultDto {
  readonly reviewItemId: string;
  readonly memory: MemorySnapshotDto;
  readonly competence: CompetenceSignalsDto;
  readonly remainingDueCount: number;
  readonly feedback?: string | null;
}

function parseCompetenceScore(item: unknown, label: string): CompetenceScoreDto {
  if (!item || typeof item !== 'object') {
    throw new Error(`Invalid Review response: ${label} is not an object`);
  }
  const scoreObj = item as Record<string, unknown>;
  if (typeof scoreObj.score !== 'number') {
    throw new Error(`Invalid Review response: ${label}.score is not a number`);
  }
  if (typeof scoreObj.confidence !== 'number') {
    throw new Error(`Invalid Review response: ${label}.confidence is not a number`);
  }
  if (typeof scoreObj.evidenceCount !== 'number') {
    throw new Error(`Invalid Review response: ${label}.evidenceCount is not a number`);
  }
  return {
    score: scoreObj.score,
    confidence: scoreObj.confidence,
    evidenceCount: scoreObj.evidenceCount,
    updatedAt: typeof scoreObj.updatedAt === 'string' ? scoreObj.updatedAt : null,
  };
}

export function parseCompetenceSignals(item: unknown): CompetenceSignalsDto {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid Review response: competence is not an object');
  }
  const comp = item as Record<string, unknown>;
  return {
    recognition: parseCompetenceScore(comp.recognition, 'competence.recognition'),
    listening: parseCompetenceScore(comp.listening, 'competence.listening'),
    production: parseCompetenceScore(comp.production, 'competence.production'),
  };
}

export function parseMemorySnapshot(item: unknown): MemorySnapshotDto {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid Review response: memory is not an object');
  }
  const mem = item as Record<string, unknown>;
  if (typeof mem.state !== 'string' || !mem.state) {
    throw new Error('Invalid Review response: missing or invalid memory.state');
  }
  if (typeof mem.dueAt !== 'string' || !mem.dueAt) {
    throw new Error('Invalid Review response: missing or invalid memory.dueAt');
  }
  if (typeof mem.isDue !== 'boolean') {
    throw new Error('Invalid Review response: memory.isDue is not a boolean');
  }
  return {
    state: mem.state,
    dueAt: mem.dueAt,
    lastReviewedAt: typeof mem.lastReviewedAt === 'string' ? mem.lastReviewedAt : null,
    isDue: mem.isDue,
  };
}

export function parseReviewQueueResponse(json: unknown): ReviewQueueItemDto[] {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/review/queue response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error('Invalid /v1/review/queue response: data is not an array');
  }

  return data.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} is not an object`);
    }
    const qItem = item as Record<string, unknown>;
    if (typeof qItem.reviewItemId !== 'string' || !qItem.reviewItemId) {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} missing reviewItemId`);
    }
    if (!qItem.concept || typeof qItem.concept !== 'object') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} missing concept`);
    }
    const conceptObj = qItem.concept as Record<string, unknown>;
    if (typeof conceptObj.id !== 'string' || !conceptObj.id) {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} concept missing id`);
    }
    if (typeof conceptObj.canonicalForm !== 'string') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} concept missing canonicalForm`);
    }
    if (typeof qItem.exerciseMode !== 'string') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} missing exerciseMode`);
    }
    if (!qItem.prompt || typeof qItem.prompt !== 'object') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} missing prompt`);
    }
    const promptObj = qItem.prompt as Record<string, unknown>;
    if (typeof promptObj.promptText !== 'string') {
      throw new Error(`Invalid /v1/review/queue response: item at index ${index} prompt missing promptText`);
    }

    return {
      reviewItemId: qItem.reviewItemId,
      concept: {
        id: conceptObj.id,
        canonicalForm: conceptObj.canonicalForm,
        partOfSpeech: typeof conceptObj.partOfSpeech === 'string' ? conceptObj.partOfSpeech : null,
        status: typeof conceptObj.status === 'string' ? conceptObj.status : 'discovered',
        isDue: typeof conceptObj.isDue === 'boolean' ? conceptObj.isDue : true,
      },
      exerciseMode: qItem.exerciseMode,
      prompt: {
        promptText: promptObj.promptText,
        contextSentence: typeof promptObj.contextSentence === 'string' ? promptObj.contextSentence : null,
        translation: typeof promptObj.translation === 'string' ? promptObj.translation : null,
      },
      memory: parseMemorySnapshot(qItem.memory),
      competence: parseCompetenceSignals(qItem.competence),
    };
  });
}

export function parseReviewAnswerResponse(json: unknown): ReviewAnswerResultDto {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/review/{reviewItemId}/answer response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /v1/review/{reviewItemId}/answer response: data is not an object');
  }
  const d = data as Record<string, unknown>;

  if (typeof d.reviewItemId !== 'string' || !d.reviewItemId) {
    throw new Error('Invalid /v1/review/{reviewItemId}/answer response: missing or invalid data.reviewItemId');
  }
  if (typeof d.remainingDueCount !== 'number') {
    throw new Error('Invalid /v1/review/{reviewItemId}/answer response: data.remainingDueCount is not a number');
  }

  return {
    reviewItemId: d.reviewItemId,
    memory: parseMemorySnapshot(d.memory),
    competence: parseCompetenceSignals(d.competence),
    remainingDueCount: d.remainingDueCount,
    feedback: typeof d.feedback === 'string' ? d.feedback : null,
  };
}

export interface PhaseDExecutionSeams {
  readonly setupThroughToday?: (options: SetupTodayLearnerOptions) => Promise<TodayLearnerContext>;
  readonly fetchFn?: typeof fetch;
  readonly captureDigest?: (userId: string, conceptId: string) => Promise<LearnerStateDigest>;
  readonly teardownLearner?: (userId: string, conceptId: string) => Promise<FrllCleanupReport>;
}

export interface PhaseDOptions {
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly goal?: string;
  readonly dailyMinutes?: number;
  readonly rating?: 'again' | 'hard' | 'good' | 'easy';
  readonly responseTimeMs?: number;
  readonly seams?: PhaseDExecutionSeams;
}

export interface PhaseDReport {
  readonly success: boolean;
  readonly userId: string;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly reviewItemId: string;
  readonly idempotencyKey: string;
  readonly todayPlan: TodayPlanDto;
  readonly reviewActivity: TodayActivityDto;
  readonly handoff: ReviewTargetHandoff;
  readonly queueItem: ReviewQueueItemDto;
  readonly firstAnswerResponse: ReviewAnswerResultDto;
  readonly replayedAnswerResponse: ReviewAnswerResultDto;
  readonly preAnswerDigest: LearnerStateDigest;
  readonly postAnswerDigest: LearnerStateDigest;
  readonly postReplayDigest: LearnerStateDigest;
  readonly postConflictDigest: LearnerStateDigest;
  readonly durationMs: number;
  readonly cleanupVerified: boolean;
  readonly cleanupReport?: FrllCleanupReport;
}

export interface SetupReviewAnswerLearnerOptions extends PhaseDOptions {
  readonly tag?: string;
  readonly onUserCreated?: (userId: string) => void;
}

export interface ReviewAnswerLearnerContext extends TodayLearnerContext {
  readonly actorId: string;
  readonly reviewItemId: string;
  readonly reviewEventId: string;
  readonly reviewLearningEventId: string;
  readonly postReviewDigest: LearnerStateDigest;
  readonly preAnswerDigest: LearnerStateDigest;
  readonly queueItem: ReviewQueueItemDto;
  readonly firstAnswerResponse: ReviewAnswerResultDto;
  readonly idempotencyKey: string;
}

export async function setupRealLearnerThroughReviewAnswer(
  options: SetupReviewAnswerLearnerOptions = {}
): Promise<ReviewAnswerLearnerContext> {
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;
  const rating = options.rating ?? 'good';
  const responseTimeMs = options.responseTimeMs ?? 1500;
  const idempotencyKey = randomUUID();

  const setupThroughToday = options.seams?.setupThroughToday ?? setupRealLearnerThroughTodayTarget;
  const fetchFn = options.seams?.fetchFn ?? globalThis.fetch;
  const captureDigest = options.seams?.captureDigest ?? captureLearnerDigestFromPostgres;

  // -------------------------------------------------------------------------
  // D1. Execute unbroken prerequisite chain through Today target
  // -------------------------------------------------------------------------
  console.log(`[${options.tag ?? 'Review Answer Prerequisite'}][1/5] Executing unbroken prerequisite chain through Today target...`);
  const context = await setupThroughToday({
    ...options,
    tag: options.tag ?? 'review-prereq',
    onUserCreated: options.onUserCreated,
  });

  const reviewItemId = context.reviewItemId;
  const preAnswerDigest = context.postTodayDigest;

  // -------------------------------------------------------------------------
  // D2. Confirm pre-Answer database invariants
  // -------------------------------------------------------------------------
  console.log(`[${options.tag ?? 'Review Answer Prerequisite'}][2/5] Validating pre-Answer database invariants...`);
  if (preAnswerDigest.review_item_count !== 1) {
    throw new Error(`FRLL-08 failure: pre-Answer review_item_count is ${preAnswerDigest.review_item_count} (expected 1).`);
  }
  if (preAnswerDigest.fsrs_state_count !== 1) {
    throw new Error(`FRLL-08 failure: pre-Answer fsrs_state_count is ${preAnswerDigest.fsrs_state_count} (expected 1).`);
  }
  const preFsrs = preAnswerDigest.fsrs_states[0];
  if (preFsrs.state !== 'new') {
    throw new Error(`FRLL-08 failure: pre-Answer FSRS state is '${preFsrs.state}' (expected 'new').`);
  }
  if (preFsrs.state_version !== 1) {
    throw new Error(`FRLL-08 failure: pre-Answer FSRS state_version is ${preFsrs.state_version} (expected 1).`);
  }
  if (!preFsrs.due_at) {
    throw new Error('FRLL-08 failure: pre-Answer FSRS due_at is null.');
  }
  if (preFsrs.last_review_at !== null) {
    throw new Error('FRLL-08 failure: pre-Answer FSRS last_review_at must be null.');
  }
  if (preAnswerDigest.review_event_count !== 0) {
    throw new Error(`FRLL-08 failure: pre-Answer review_event_count is ${preAnswerDigest.review_event_count} (expected 0).`);
  }
  if (preAnswerDigest.learning_event_count !== 1) {
    throw new Error(`FRLL-08 failure: pre-Answer learning_event_count is ${preAnswerDigest.learning_event_count} (expected 1).`);
  }
  if (preAnswerDigest.concept_state?.has_projectable_evidence !== false) {
    throw new Error('FRLL-08 failure: pre-Answer concept_state has_projectable_evidence must be false.');
  }
  if ((preAnswerDigest.concept_state?.production_evidence_count ?? 0) !== 0) {
    throw new Error('FRLL-08 failure: pre-Answer production_evidence_count must be 0.');
  }

  console.log(`  [OK] Pre-Answer invariants verified: reviewItemId=${reviewItemId}, FSRS state=new, state_version=1, review_events=0.`);

  // -------------------------------------------------------------------------
  // D3. Real Review Queue Load via GET /v1/review/queue
  // -------------------------------------------------------------------------
  console.log(`[${options.tag ?? 'Review Answer Prerequisite'}][3/5] Fetching Review queue via GET /v1/review/queue...`);
  const queueUrl = `${context.apiBaseUrl}/v1/review/queue?languageProfileId=${encodeURIComponent(context.languageProfileId)}`;
  const queueRes = await fetchFn(queueUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${context.session.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (queueRes.status !== 200) {
    const errBody = await queueRes.text();
    throw new Error(`FRLL-08 failure: GET /v1/review/queue returned HTTP ${queueRes.status}: ${errBody}`);
  }

  const queueItems = parseReviewQueueResponse(await queueRes.json());
  console.log(`  [OK] Review queue returned ${queueItems.length} item(s).`);

  const targetQueueItem = queueItems.find((item) => item.reviewItemId === reviewItemId);
  if (!targetQueueItem) {
    throw new Error(`FRLL-08 failure: Review queue did not contain target reviewItemId ${reviewItemId}.`);
  }
  if (targetQueueItem.concept.id !== conceptId) {
    throw new Error(`FRLL-08 failure: Queue item concept.id (${targetQueueItem.concept.id}) != ${conceptId}.`);
  }
  if (!targetQueueItem.memory.isDue) {
    throw new Error('FRLL-08 failure: Queue item memory.isDue is false.');
  }

  console.log(`  [OK] Target review item verified in queue: reviewItemId=${reviewItemId}, conceptId=${conceptId}, prompt="${targetQueueItem.prompt.promptText}".`);

  // Verify queue fetch caused zero state mutations
  const postQueueDigest = await captureDigest(context.user.id, conceptId);
  if (postQueueDigest.review_event_count !== 0) {
    throw new Error('FRLL-08 failure: Queue fetch created unexpected review_event.');
  }
  if (postQueueDigest.learning_event_count !== 1) {
    throw new Error('FRLL-08 failure: Queue fetch mutated learning_events.');
  }
  if (postQueueDigest.fsrs_states[0]?.state_version !== 1) {
    throw new Error('FRLL-08 failure: Queue fetch mutated FSRS state_version.');
  }

  // -------------------------------------------------------------------------
  // D4. Submit Authoritative Review Answer via POST /v1/review/{reviewItemId}/answer
  // -------------------------------------------------------------------------
  console.log(`[${options.tag ?? 'Review Answer Prerequisite'}][4/5] Submitting Review answer (rating='${rating}', responseTimeMs=${responseTimeMs}, idempotencyKey=${idempotencyKey})...`);
  const answerUrl = `${context.apiBaseUrl}/v1/review/${encodeURIComponent(reviewItemId)}/answer`;
  const answerRes = await fetchFn(answerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.session.accessToken}`,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      rating,
      responseTimeMs,
    }),
  });

  if (answerRes.status !== 200) {
    const errBody = await answerRes.text();
    throw new Error(`FRLL-08 failure: POST /v1/review/${reviewItemId}/answer returned HTTP ${answerRes.status}: ${errBody}`);
  }

  const firstAnswer = parseReviewAnswerResponse(await answerRes.json());
  console.log(`  [OK] Answer response received: reviewItemId=${firstAnswer.reviewItemId}, state=${firstAnswer.memory.state}, dueAt=${firstAnswer.memory.dueAt}, remainingDueCount=${firstAnswer.remainingDueCount}`);

  if (firstAnswer.reviewItemId !== reviewItemId) {
    throw new Error(`FRLL-08 failure: Answer response reviewItemId (${firstAnswer.reviewItemId}) != ${reviewItemId}.`);
  }
  if (firstAnswer.memory.state === 'new') {
    throw new Error('FRLL-08 failure: Answer response memory.state is still "new".');
  }
  if (firstAnswer.memory.lastReviewedAt === null) {
    throw new Error('FRLL-08 failure: Answer response memory.lastReviewedAt is null.');
  }
  if (firstAnswer.competence.production.evidenceCount !== 1) {
    throw new Error(`FRLL-09 failure: Answer response production evidenceCount is ${firstAnswer.competence.production.evidenceCount} (expected 1).`);
  }

  // -------------------------------------------------------------------------
  // D5. Observational PostgreSQL Probe: Atomic State Transition Proof (FRLL-08, FRLL-09)
  // -------------------------------------------------------------------------
  console.log(`[${options.tag ?? 'Review Answer Prerequisite'}][5/5] Observational PostgreSQL proof: verifying atomic state transition (FRLL-08, FRLL-09)...`);
  const postAnswerDigest = await captureDigest(context.user.id, conceptId);

  // A. Scheduler Transition
  if (postAnswerDigest.review_item_count !== 1) {
    throw new Error(`FRLL-08 failure: review_item_count is ${postAnswerDigest.review_item_count} (expected 1).`);
  }
  if (postAnswerDigest.fsrs_state_count !== 1) {
    throw new Error(`FRLL-08 failure: fsrs_state_count is ${postAnswerDigest.fsrs_state_count} (expected 1).`);
  }
  const postFsrs = postAnswerDigest.fsrs_states[0];
  if (postFsrs.review_item_id !== reviewItemId) {
    throw new Error(`FRLL-08 failure: post-answer FSRS review_item_id mismatch.`);
  }
  if (postFsrs.state_version !== 2) {
    throw new Error(`FRLL-08 failure: FSRS state_version is ${postFsrs.state_version} (expected exactly 2, advanced from 1).`);
  }
  if (postFsrs.state === 'new') {
    throw new Error(`FRLL-08 failure: FSRS state is still '${postFsrs.state}' (expected transition from 'new').`);
  }
  if (postFsrs.last_review_at === null) {
    throw new Error('FRLL-08 failure: FSRS last_review_at must be populated after review.');
  }
  if (postFsrs.due_at === preFsrs.due_at) {
    throw new Error(`FRLL-08 failure: FSRS due_at was not rescheduled: ${postFsrs.due_at} == ${preFsrs.due_at}`);
  }

  // B. Review Event Creation
  if (postAnswerDigest.review_event_count !== 1) {
    throw new Error(`FRLL-08 failure: review_event_count is ${postAnswerDigest.review_event_count} (expected exactly 1).`);
  }
  const revEvent = postAnswerDigest.review_events[0];
  if (revEvent.review_item_id !== reviewItemId) {
    throw new Error(`FRLL-08 failure: review_event review_item_id (${revEvent.review_item_id}) != ${reviewItemId}.`);
  }
  if (revEvent.idempotency_key !== idempotencyKey) {
    throw new Error(`FRLL-08 failure: review_event idempotency_key (${revEvent.idempotency_key}) != ${idempotencyKey}.`);
  }
  if (revEvent.rating !== rating) {
    throw new Error(`FRLL-08 failure: review_event rating (${revEvent.rating}) != ${rating}.`);
  }
  if (revEvent.response_time_ms !== responseTimeMs) {
    throw new Error(`FRLL-08 failure: review_event response_time_ms (${revEvent.response_time_ms}) != ${responseTimeMs}.`);
  }
  if (!revEvent.has_memory_snapshot) {
    throw new Error('FRLL-08 failure: review_event has_memory_snapshot is false.');
  }
  if (!revEvent.has_competence_snapshot) {
    throw new Error('FRLL-08 failure: review_event has_competence_snapshot is false.');
  }
  if (!revEvent.result_memory_snapshot || typeof revEvent.result_memory_snapshot !== 'object') {
    throw new Error('FRLL-08 failure: review_event result_memory_snapshot is missing or not an object.');
  }
  if (!revEvent.result_competence_snapshot || typeof revEvent.result_competence_snapshot !== 'object') {
    throw new Error('FRLL-08 failure: review_event result_competence_snapshot is missing or not an object.');
  }

  // C. Canonical Learning Event Creation
  if (postAnswerDigest.learning_event_count !== 2) {
    throw new Error(`FRLL-08/FRLL-09 failure: learning_event_count is ${postAnswerDigest.learning_event_count} (expected exactly 2: 1 save + 1 review).`);
  }
  const reviewLearningEvent = postAnswerDigest.learning_events.find(
    (ev) => ev.source_type === 'review_event'
  );
  if (!reviewLearningEvent) {
    throw new Error('FRLL-08 failure: No learning_event found with source_type="review_event".');
  }
  if (reviewLearningEvent.event_type !== 'learning.review.completed.v1') {
    throw new Error(`FRLL-08 failure: Review learning_event event_type is '${reviewLearningEvent.event_type}' (expected 'learning.review.completed.v1').`);
  }
  if (reviewLearningEvent.source_event_id !== revEvent.id) {
    throw new Error(`FRLL-08 failure: learning_event source_event_id (${reviewLearningEvent.source_event_id}) != review_event.id (${revEvent.id}).`);
  }
  if (reviewLearningEvent.ingestion_sequence !== 2) {
    throw new Error(`FRLL-08 failure: learning_event ingestion_sequence is ${reviewLearningEvent.ingestion_sequence} (expected 2).`);
  }

  // D. Competence Update
  const conceptState = postAnswerDigest.concept_state;
  if (!conceptState) {
    throw new Error('FRLL-09 failure: concept_state row missing in PostgreSQL.');
  }
  if (conceptState.has_projectable_evidence !== true) {
    throw new Error('FRLL-09 failure: concept_state has_projectable_evidence is not true.');
  }
  if ((conceptState.production_evidence_count ?? 0) !== 1) {
    throw new Error(`FRLL-09 failure: production_evidence_count is ${conceptState.production_evidence_count} (expected 1).`);
  }
  if ((conceptState.recognition_evidence_count ?? 0) !== 0) {
    throw new Error(`FRLL-09 failure: recognition_evidence_count is ${conceptState.recognition_evidence_count} (expected 0).`);
  }
  if ((conceptState.listening_evidence_count ?? 0) !== 0) {
    throw new Error(`FRLL-09 failure: listening_evidence_count is ${conceptState.listening_evidence_count} (expected 0).`);
  }

  console.log('  [OK] FRLL-08 & FRLL-09 verified: Atomic transaction updated FSRS (v1->v2), inserted review_event, inserted learning_event (seq=2), updated competence (prod_evidence=1).');

  return {
    ...context,
    actorId: context.user.id,
    reviewItemId,
    reviewEventId: revEvent.id,
    reviewLearningEventId: reviewLearningEvent.id,
    postReviewDigest: postAnswerDigest,
    preAnswerDigest,
    queueItem: targetQueueItem,
    firstAnswerResponse: firstAnswer,
    idempotencyKey,
  };
}

export async function runPhaseDLearningLoop(
  options: PhaseDOptions = {}
): Promise<PhaseDReport> {
  const startTime = Date.now();
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;
  const rating = options.rating ?? 'good';
  const responseTimeMs = options.responseTimeMs ?? 1500;

  let provisionedUserId: string | null = null;
  let resultReport: PhaseDReport | null = null;

  const fetchFn = options.seams?.fetchFn ?? globalThis.fetch;
  const captureDigest = options.seams?.captureDigest ?? captureLearnerDigestFromPostgres;
  const teardownLearner = options.seams?.teardownLearner ?? teardownRealLearner;

  try {
    // -------------------------------------------------------------------------
    // D1-D5. Execute unbroken prerequisite chain through Review answer
    // -------------------------------------------------------------------------
    const context = await setupRealLearnerThroughReviewAnswer({
      ...options,
      tag: 'phase-d',
      onUserCreated: (uid) => {
        provisionedUserId = uid;
      },
    });

    const reviewItemId = context.reviewItemId;
    const idempotencyKey = context.idempotencyKey;
    const firstAnswer = context.firstAnswerResponse;
    const answerUrl = `${context.apiBaseUrl}/v1/review/${encodeURIComponent(reviewItemId)}/answer`;
    const queueUrl = `${context.apiBaseUrl}/v1/review/queue?languageProfileId=${encodeURIComponent(context.languageProfileId)}`;

    // -------------------------------------------------------------------------
    // D6. Idempotent Replay Proof (FRLL-10)
    // -------------------------------------------------------------------------
    console.log('[Phase D][6/8] Testing idempotent replay with identical Idempotency-Key and payload (FRLL-10)...');
    const replayRes = await fetchFn(answerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        rating,
        responseTimeMs,
      }),
    });

    if (replayRes.status !== 200) {
      const errBody = await replayRes.text();
      throw new Error(`FRLL-10 failure: Replay POST returned HTTP ${replayRes.status}: ${errBody}`);
    }

    const replayedAnswer = parseReviewAnswerResponse(await replayRes.json());
    if (replayedAnswer.reviewItemId !== firstAnswer.reviewItemId) {
      throw new Error('FRLL-10 failure: Replay reviewItemId mismatch.');
    }
    if (replayedAnswer.memory.state !== firstAnswer.memory.state) {
      throw new Error(`FRLL-10 failure: Replay memory.state (${replayedAnswer.memory.state}) != (${firstAnswer.memory.state}).`);
    }
    if (replayedAnswer.memory.dueAt !== firstAnswer.memory.dueAt) {
      throw new Error(`FRLL-10 failure: Replay memory.dueAt (${replayedAnswer.memory.dueAt}) != (${firstAnswer.memory.dueAt}).`);
    }
    if (replayedAnswer.memory.lastReviewedAt !== firstAnswer.memory.lastReviewedAt) {
      throw new Error(`FRLL-10 failure: Replay memory.lastReviewedAt (${replayedAnswer.memory.lastReviewedAt}) != (${firstAnswer.memory.lastReviewedAt}).`);
    }
    if (replayedAnswer.competence.production.evidenceCount !== firstAnswer.competence.production.evidenceCount) {
      throw new Error('FRLL-10 failure: Replay competence production evidenceCount mismatch.');
    }

    // Probe DB: Verify 0 duplicate rows and state_version remains 2
    const postReplayDigest = await captureDigest(context.user.id, conceptId);
    if (postReplayDigest.review_item_count !== 1) {
      throw new Error(`FRLL-10 failure: post-replay review_item_count is ${postReplayDigest.review_item_count} (expected 1).`);
    }
    if (postReplayDigest.fsrs_state_count !== 1) {
      throw new Error(`FRLL-10 failure: post-replay fsrs_state_count is ${postReplayDigest.fsrs_state_count} (expected 1).`);
    }
    if (postReplayDigest.fsrs_states[0]?.state_version !== 2) {
      throw new Error(`FRLL-10 failure: post-replay state_version is ${postReplayDigest.fsrs_states[0]?.state_version} (expected 2).`);
    }
    if (postReplayDigest.review_event_count !== 1) {
      throw new Error(`FRLL-10 failure: post-replay review_event_count is ${postReplayDigest.review_event_count} (expected 1, duplicate created).`);
    }
    if (postReplayDigest.learning_event_count !== 2) {
      throw new Error(`FRLL-10 failure: post-replay learning_event_count is ${postReplayDigest.learning_event_count} (expected 2, duplicate created).`);
    }
    if ((postReplayDigest.concept_state?.production_evidence_count ?? 0) !== 1) {
      throw new Error(`FRLL-10 failure: post-replay production_evidence_count is ${postReplayDigest.concept_state?.production_evidence_count} (expected 1).`);
    }

    console.log('  [OK] FRLL-10 verified: Idempotent replay returned committed snapshot and produced zero duplicate mutations in DB.');

    // -------------------------------------------------------------------------
    // D7. Bounded Negative Assertion: Conflict Guard
    // -------------------------------------------------------------------------
    console.log('[Phase D][7/8] Testing conflict guard: reusing same Idempotency-Key with different rating ("hard")...');
    const conflictRating = rating === 'good' ? 'hard' : 'good';
    const conflictRes = await fetchFn(answerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        rating: conflictRating,
        responseTimeMs,
      }),
    });

    if (conflictRes.status !== 409) {
      const respBody = await conflictRes.text();
      throw new Error(`Conflict guard failure: Reusing Idempotency-Key with changed rating returned HTTP ${conflictRes.status} (expected 409 Conflict): ${respBody}`);
    }

    console.log('  [OK] Conflict guard verified: Server rejected reused Idempotency-Key with HTTP 409.');

    // Probe DB: verify conflict produced zero state mutations
    const postConflictDigest = await captureDigest(context.user.id, conceptId);
    if (postConflictDigest.fsrs_states[0]?.state_version !== 2) {
      throw new Error('Conflict guard failure: FSRS state_version mutated on 409.');
    }
    if (postConflictDigest.review_event_count !== 1) {
      throw new Error('Conflict guard failure: review_event_count mutated on 409.');
    }
    if (postConflictDigest.learning_event_count !== 2) {
      throw new Error('Conflict guard failure: learning_event_count mutated on 409.');
    }

    console.log('  [OK] Conflict guard verified: PostgreSQL confirmed zero database mutations on 409.');

    // -------------------------------------------------------------------------
    // D8. Post-Answer Queue Reconcile
    // -------------------------------------------------------------------------
    console.log('[Phase D][8/8] Re-checking Review queue: verifying reviewed item is no longer immediately due...');
    const postQueueRes = await fetchFn(queueUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (postQueueRes.status === 200) {
      const remainingQueueItems = parseReviewQueueResponse(await postQueueRes.json());
      const stillDue = remainingQueueItems.some((item) => item.reviewItemId === reviewItemId);
      if (stillDue) {
        throw new Error(`Review queue reconcile failure: reviewItemId ${reviewItemId} is still present in queue after being answered.`);
      }
      console.log(`  [OK] Queue reconciled: reviewItemId is no longer due (remaining items in queue: ${remainingQueueItems.length}).`);
    }

    const durationMs = Date.now() - startTime;
    resultReport = {
      success: true,
      userId: context.user.id,
      languageProfileId: context.languageProfileId,
      conceptId,
      reviewItemId,
      idempotencyKey,
      todayPlan: context.todayPlan,
      reviewActivity: context.reviewActivity,
      handoff: context.handoff,
      queueItem: context.queueItem,
      firstAnswerResponse: firstAnswer,
      replayedAnswerResponse: replayedAnswer,
      preAnswerDigest: context.preAnswerDigest,
      postAnswerDigest: context.postReviewDigest,
      postReplayDigest,
      postConflictDigest,
      durationMs,
      cleanupVerified: false,
    };
  } finally {
    if (provisionedUserId) {
      console.log(`[Phase D] Tearing down disposable test user ${provisionedUserId}...`);
      try {
        const cleanupReport = await teardownLearner(provisionedUserId, conceptId);
        const cleanupVerified = isTeardownVerified(cleanupReport);
        if (resultReport) {
          resultReport = {
            ...resultReport,
            cleanupVerified,
            cleanupReport,
          };
        }
        if (!cleanupVerified) {
          console.error(
            '[Phase D] CLEANUP WARNING: Database or auth was not completely clean after teardown:',
            cleanupReport?.postgresDetails?.counts
          );
          throw new Error(
            `FRLL Phase D cleanup failure: Teardown verification failed: ${JSON.stringify(cleanupReport?.postgresDetails?.counts)}`
          );
        } else {
          console.log('  [OK] Disposable test user completely purged; 0 rows remain across all learner tables; anchor concept intact.');
        }
      } catch (err) {
        console.error('[Phase D] Error during teardown:', err);
        throw err;
      }
    }
  }

  if (!resultReport) {
    throw new Error('FRLL Phase D failed: resultReport was not constructed before teardown.');
  }

  return resultReport;
}
