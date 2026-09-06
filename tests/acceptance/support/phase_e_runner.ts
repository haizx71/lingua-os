/**
 * First Real Learning Loop (FRLL) - Phase E Acceptance Runner.
 *
 * Implements the deterministic sequence for:
 * E1. Run unbroken prerequisite chain through Review answer (real auth, profile, timezone, Save/Learn, Memory lineage, Today target, Review answer, atomic transition)
 * E2. Observational PostgreSQL probe immediately before Brain API call:
 *     - Same actor, profile, concept
 *     - review_items = 1, fsrs_states = 1
 *     - review_events = 1
 *     - learning_events = 2 (1 save + 1 review completed)
 *     - user_concept_states exists with has_projectable_evidence = true, production_evidence_count = 1, recognition/listening = 0
 * E3. Fetch Brain Concept Detail via GET /v1/brain/concepts/{conceptId}
 *     - Assert HTTP 200, parse BrainConceptResponse
 * E4. Brain projection proof (FRLL-12):
 *     - Identity: conceptId matches deterministic fixture
 *     - Non-synthetic proof: status is not 'unseen', memory is not null, reviewCount = 1, production evidenceCount = 1
 *     - Equality with PostgreSQL authority & Review result:
 *       - status equals concept_state.status ('learning')
 *       - mastery equals concept_state.mastery (null)
 *       - confidence equals concept_state.confidence
 *       - production score, confidence, evidenceCount match concept_state & Review result
 *       - recognition & listening remain at score 0.5, confidence 0, evidenceCount 0
 *       - memory snapshot matches fsrs_states (state, due_at, last_review_at, is_due=false)
 * E5. Brain summary & concept list cross-checks (read-only verification across all Brain endpoints):
 *     - GET /v1/brain/summary?languageProfileId=<profileId>
 *     - GET /v1/brain/concepts?languageProfileId=<profileId>
 * E6. Observational PostgreSQL probe: Read-Only Invariant Proof:
 *     - Capture post-Brain digest
 *     - Assert exact deep equality between pre-Brain and post-Brain digests
 *     - Proves Brain GET produces zero learner-state mutation
 * E7. Teardown & Post-cleanup verification:
 *     - Purge disposable Supabase Auth user
 *     - Observational probe proves 0 auth rows, 0 app rows across all learner tables, catalog anchor intact
 */

import {
  FRLL_ANCHOR_CONCEPT_ID,
  isTeardownVerified,
  teardownRealLearner,
  type FrllCleanupReport,
} from './phase_b_runner';
import {
  setupRealLearnerThroughReviewAnswer,
  type CompetenceScoreDto,
  type CompetenceSignalsDto,
  type MemorySnapshotDto,
  type ReviewAnswerLearnerContext,
  type SetupReviewAnswerLearnerOptions,
  parseCompetenceSignals,
  parseMemorySnapshot,
} from './phase_d_runner';
import {
  captureLearnerDigestFromPostgres,
  type LearnerStateDigest,
} from './postgres_probe_client';

/**
 * Canonical numeric equivalence validator for learner projection values.
 *
 * In Language Brain and Competence projections, metrics like competence scores,
 * confidences, and mastery derive from fractional Bayesian updates (e.g. 1/30 = 0.033333333...)
 * and are persisted in PostgreSQL columns typed as `numeric(10,8)`.
 *
 * The canonical database scale is 8 decimal places (`numeric(10,8)`), where 1/30 is
 * persisted as `0.03333333`. However, when 1/30 is evaluated with 8 significant digits
 * (precision 8), it yields `0.033333333` (9 fractional digits). The difference between
 * the two representations is exactly 3e-9 (0.000000003).
 *
 * Setting the tolerance to the canonical column scale bound (1e-8 = 0.00000001):
 * - Accepts legitimate sub-scale representation differences (3e-9 <= 1e-8).
 * - Rejects any divergence at or beyond the database's scale-8 quantum (diff > 1e-8).
 * - Rejects non-finite values (NaN, Infinity, -Infinity).
 * - Fails closed on materially divergent values (e.g. 0.04 vs 0.03333333).
 */
export const PROJECTION_NUMERIC_TOLERANCE = 1e-8;

export function isProjectionNumberEquivalent(
  actual: number | string | null | undefined,
  expected: number | string | null | undefined,
  tolerance: number = PROJECTION_NUMERIC_TOLERANCE
): boolean {
  if (actual === null || actual === undefined) {
    return expected === null || expected === undefined;
  }
  if (expected === null || expected === undefined) {
    return false;
  }

  const numActual = typeof actual === 'number' ? actual : Number(actual);
  const numExpected = typeof expected === 'number' ? expected : Number(expected);

  if (!Number.isFinite(numActual) || !Number.isFinite(numExpected)) {
    return false;
  }

  return Math.abs(numActual - numExpected) <= tolerance;
}

export function expectProjectionNumberEquivalent(
  actual: number | string | null | undefined,
  expected: number | string | null | undefined,
  fieldName: string,
  tolerance: number = PROJECTION_NUMERIC_TOLERANCE
): void {
  if (actual === null || actual === undefined) {
    if (expected !== null && expected !== undefined) {
      throw new Error(`FRLL-12 failure: ${fieldName} is ${actual} (expected ${expected}).`);
    }
    return;
  }
  if (expected === null || expected === undefined) {
    throw new Error(`FRLL-12 failure: ${fieldName} is ${actual} (expected ${expected}).`);
  }

  const numActual = typeof actual === 'number' ? actual : Number(actual);
  const numExpected = typeof expected === 'number' ? expected : Number(expected);

  if (!Number.isFinite(numActual)) {
    throw new Error(`FRLL-12 failure: ${fieldName} actual value is not a finite number (${actual}).`);
  }
  if (!Number.isFinite(numExpected)) {
    throw new Error(`FRLL-12 failure: ${fieldName} expected value is not a finite number (${expected}).`);
  }

  const diff = Math.abs(numActual - numExpected);
  if (diff > tolerance) {
    throw new Error(
      `FRLL-12 failure: ${fieldName} ${numActual} != PostgreSQL ${numExpected} (difference ${diff} > tolerance ${tolerance}).`
    );
  }
}

export interface BrainConceptDetailDto {
  readonly concept: {
    readonly id: string;
    readonly languageCode: string;
    readonly canonicalForm: string;
    readonly partOfSpeech?: string | null;
    readonly level?: {
      readonly frameworkCode: string;
      readonly code: string;
      readonly label?: string | null;
    } | null;
    readonly definitions: readonly {
      readonly definition: string;
      readonly translation?: string | null;
      readonly languageCode: string;
      readonly order: number;
    }[];
    readonly examples: readonly {
      readonly sentenceId: string;
      readonly text: string;
      readonly translation?: string | null;
      readonly audioUrl?: string | null;
    }[];
    readonly relations: readonly {
      readonly conceptId: string;
      readonly relationType: string;
      readonly canonicalForm: string;
    }[];
    readonly learner: {
      readonly status: string;
      readonly isDue: boolean;
      readonly exposureCount: number;
      readonly lastSeenAt?: string | null;
      readonly memory?: MemorySnapshotDto | null;
      readonly competence: CompetenceSignalsDto;
    };
    readonly attribution?: {
      readonly sourceName: string;
      readonly licenseCode: string;
      readonly attributionText?: string | null;
      readonly sourceUrl?: string | null;
    } | null;
  };
  readonly status: string;
  readonly competence: CompetenceSignalsDto;
  readonly mastery: number | null;
  readonly confidence: number;
  readonly memory: MemorySnapshotDto | null;
  readonly evidence: {
    readonly exposureCount: number;
    readonly reviewCount: number;
    readonly lastSeenAt?: string | null;
    readonly lastReviewedAt?: string | null;
  };
}

export interface BrainConceptSummaryDto {
  readonly concept: {
    readonly id: string;
    readonly canonicalForm: string;
    readonly partOfSpeech?: string | null;
    readonly status: string;
    readonly isDue: boolean;
  };
  readonly competence: CompetenceSignalsDto;
  readonly mastery: number | null;
  readonly confidence: number;
  readonly memory?: MemorySnapshotDto | null;
  readonly exposureCount: number;
  readonly lastSeenAt?: string | null;
}

export interface BrainSummaryDto {
  readonly languageProfileId: string;
  readonly statusCounts: {
    readonly total: number;
    readonly unseen: number;
    readonly discovered: number;
    readonly learning: number;
    readonly active: number;
    readonly retained: number;
    readonly mastered: number;
    readonly due?: number;
    readonly weak?: number;
    readonly forgotten?: number;
  };
  readonly dueCount: number;
  readonly memoryHealth: number | null;
  readonly competence: CompetenceSignalsDto;
  readonly startingLevelEstimate?: unknown | null;
  readonly recentConcepts: readonly BrainConceptSummaryDto[];
  readonly calculatedAt: string;
}

export interface BrainConceptListResponseDto {
  readonly items: readonly BrainConceptSummaryDto[];
  readonly meta: {
    readonly requestId: string;
    readonly nextCursor?: string | null;
    readonly hasMore: boolean;
    readonly pageSize: number;
  };
}

export function parseBrainConceptResponse(json: unknown): BrainConceptDetailDto {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data is not an object');
  }
  const d = data as Record<string, unknown>;

  if (!d.concept || typeof d.concept !== 'object') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: missing or invalid data.concept');
  }
  const c = d.concept as Record<string, unknown>;
  if (typeof c.id !== 'string' || !c.id) {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.concept.id is missing or invalid');
  }
  if (typeof c.canonicalForm !== 'string') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.concept.canonicalForm is missing or invalid');
  }
  if (typeof d.status !== 'string' || !d.status) {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.status is missing or invalid');
  }
  if (typeof d.confidence !== 'number') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.confidence is not a number');
  }
  if (d.mastery !== null && typeof d.mastery !== 'number') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.mastery must be a number or null');
  }
  if (!d.evidence || typeof d.evidence !== 'object') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: missing or invalid data.evidence');
  }
  const ev = d.evidence as Record<string, unknown>;
  if (typeof ev.exposureCount !== 'number') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.evidence.exposureCount is not a number');
  }
  if (typeof ev.reviewCount !== 'number') {
    throw new Error('Invalid /v1/brain/concepts/{conceptId} response: data.evidence.reviewCount is not a number');
  }

  const memory = d.memory ? parseMemorySnapshot(d.memory) : null;
  const competence = parseCompetenceSignals(d.competence);

  const learnerObj = (c.learner as Record<string, unknown>) ?? {};

  return {
    concept: {
      id: c.id,
      languageCode: typeof c.languageCode === 'string' ? c.languageCode : 'en',
      canonicalForm: c.canonicalForm,
      partOfSpeech: typeof c.partOfSpeech === 'string' ? c.partOfSpeech : null,
      level: (c.level as any) ?? null,
      definitions: Array.isArray(c.definitions) ? (c.definitions as any) : [],
      examples: Array.isArray(c.examples) ? (c.examples as any) : [],
      relations: Array.isArray(c.relations) ? (c.relations as any) : [],
      learner: {
        status: typeof learnerObj.status === 'string' ? learnerObj.status : d.status,
        isDue: typeof learnerObj.isDue === 'boolean' ? learnerObj.isDue : (memory?.isDue ?? false),
        exposureCount: typeof learnerObj.exposureCount === 'number' ? learnerObj.exposureCount : ev.exposureCount,
        lastSeenAt: typeof learnerObj.lastSeenAt === 'string' ? learnerObj.lastSeenAt : null,
        memory: learnerObj.memory ? parseMemorySnapshot(learnerObj.memory) : memory,
        competence: learnerObj.competence ? parseCompetenceSignals(learnerObj.competence) : competence,
      },
      attribution: (c.attribution as any) ?? null,
    },
    status: d.status,
    competence,
    mastery: d.mastery,
    confidence: d.confidence,
    memory,
    evidence: {
      exposureCount: ev.exposureCount,
      reviewCount: ev.reviewCount,
      lastSeenAt: typeof ev.lastSeenAt === 'string' ? ev.lastSeenAt : null,
      lastReviewedAt: typeof ev.lastReviewedAt === 'string' ? ev.lastReviewedAt : null,
    },
  };
}

export function parseBrainSummaryResponse(json: unknown): BrainSummaryDto {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/brain/summary response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /v1/brain/summary response: data is not an object');
  }
  const d = data as Record<string, unknown>;

  if (typeof d.languageProfileId !== 'string' || !d.languageProfileId) {
    throw new Error('Invalid /v1/brain/summary response: data.languageProfileId is missing or invalid');
  }
  if (!d.statusCounts || typeof d.statusCounts !== 'object') {
    throw new Error('Invalid /v1/brain/summary response: data.statusCounts is missing or invalid');
  }
  if (typeof d.dueCount !== 'number') {
    throw new Error('Invalid /v1/brain/summary response: data.dueCount is not a number');
  }

  const sc = d.statusCounts as Record<string, number>;
  const recent = Array.isArray(d.recentConcepts) ? d.recentConcepts : [];

  return {
    languageProfileId: d.languageProfileId,
    statusCounts: {
      total: sc.total ?? 0,
      unseen: sc.unseen ?? 0,
      discovered: sc.discovered ?? 0,
      learning: sc.learning ?? 0,
      active: sc.active ?? 0,
      retained: sc.retained ?? 0,
      mastered: sc.mastered ?? 0,
      due: sc.due,
      weak: sc.weak,
      forgotten: sc.forgotten,
    },
    dueCount: d.dueCount,
    memoryHealth: typeof d.memoryHealth === 'number' ? d.memoryHealth : null,
    competence: parseCompetenceSignals(d.competence),
    startingLevelEstimate: d.startingLevelEstimate,
    recentConcepts: recent.map((item: any) => ({
      concept: {
        id: item.concept?.id,
        canonicalForm: item.concept?.canonicalForm,
        partOfSpeech: item.concept?.partOfSpeech ?? null,
        status: item.concept?.status,
        isDue: item.concept?.isDue ?? false,
      },
      competence: parseCompetenceSignals(item.competence),
      mastery: typeof item.mastery === 'number' ? item.mastery : null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      memory: item.memory ? parseMemorySnapshot(item.memory) : null,
      exposureCount: typeof item.exposureCount === 'number' ? item.exposureCount : 0,
      lastSeenAt: typeof item.lastSeenAt === 'string' ? item.lastSeenAt : null,
    })),
    calculatedAt: typeof d.calculatedAt === 'string' ? d.calculatedAt : new Date().toISOString(),
  };
}

export function parseBrainConceptListResponse(json: unknown): BrainConceptListResponseDto {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/brain/concepts response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error('Invalid /v1/brain/concepts response: data is not an array');
  }
  const meta = ((json as { meta?: unknown }).meta as Record<string, unknown>) ?? {};

  return {
    items: data.map((item: any) => ({
      concept: {
        id: item.concept?.id,
        canonicalForm: item.concept?.canonicalForm,
        partOfSpeech: item.concept?.partOfSpeech ?? null,
        status: item.concept?.status,
        isDue: item.concept?.isDue ?? false,
      },
      competence: parseCompetenceSignals(item.competence),
      mastery: typeof item.mastery === 'number' ? item.mastery : null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      memory: item.memory ? parseMemorySnapshot(item.memory) : null,
      exposureCount: typeof item.exposureCount === 'number' ? item.exposureCount : 0,
      lastSeenAt: typeof item.lastSeenAt === 'string' ? item.lastSeenAt : null,
    })),
    meta: {
      requestId: typeof meta.requestId === 'string' ? meta.requestId : '',
      nextCursor: typeof meta.nextCursor === 'string' ? meta.nextCursor : null,
      hasMore: Boolean(meta.hasMore),
      pageSize: typeof meta.pageSize === 'number' ? meta.pageSize : data.length,
    },
  };
}

export interface PhaseEExecutionSeams {
  readonly setupThroughReviewAnswer?: (options: SetupReviewAnswerLearnerOptions) => Promise<ReviewAnswerLearnerContext>;
  readonly fetchFn?: typeof fetch;
  readonly captureDigest?: (userId: string, conceptId: string) => Promise<LearnerStateDigest>;
  readonly teardownLearner?: (userId: string, conceptId: string) => Promise<FrllCleanupReport>;
}

export interface PhaseEOptions {
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly seams?: PhaseEExecutionSeams;
}

export interface PhaseEReport {
  readonly success: boolean;
  readonly userId: string;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly reviewItemId: string;
  readonly reviewEventId: string;
  readonly reviewLearningEventId: string;
  readonly preBrainDigest: LearnerStateDigest;
  readonly brainConceptDetail: BrainConceptDetailDto;
  readonly brainSummary?: BrainSummaryDto;
  readonly brainConceptList?: BrainConceptListResponseDto;
  readonly postBrainDigest: LearnerStateDigest;
  readonly durationMs: number;
  readonly cleanupVerified: boolean;
  readonly cleanupReport?: FrllCleanupReport;
}

/**
 * Asserts exact deep equality of learner state between pre-Brain and post-Brain digests.
 * Brain GET is strictly read-only and must produce zero mutations.
 */
function assertDigestsIdentical(pre: LearnerStateDigest, post: LearnerStateDigest): void {
  if (pre.review_item_count !== post.review_item_count) {
    throw new Error(`Read-only invariant violated: review_item_count mutated (${pre.review_item_count} -> ${post.review_item_count})`);
  }
  if (pre.fsrs_state_count !== post.fsrs_state_count) {
    throw new Error(`Read-only invariant violated: fsrs_state_count mutated (${pre.fsrs_state_count} -> ${post.fsrs_state_count})`);
  }
  if (JSON.stringify(pre.fsrs_states) !== JSON.stringify(post.fsrs_states)) {
    throw new Error('Read-only invariant violated: fsrs_states mutated during Brain GET');
  }
  if (pre.review_event_count !== post.review_event_count) {
    throw new Error(`Read-only invariant violated: review_event_count mutated (${pre.review_event_count} -> ${post.review_event_count})`);
  }
  if (JSON.stringify(pre.review_events) !== JSON.stringify(post.review_events)) {
    throw new Error('Read-only invariant violated: review_events mutated during Brain GET');
  }
  if (pre.learning_event_count !== post.learning_event_count) {
    throw new Error(`Read-only invariant violated: learning_event_count mutated (${pre.learning_event_count} -> ${post.learning_event_count})`);
  }
  if (JSON.stringify(pre.learning_events) !== JSON.stringify(post.learning_events)) {
    throw new Error('Read-only invariant violated: learning_events mutated during Brain GET');
  }
  if (JSON.stringify(pre.concept_state) !== JSON.stringify(post.concept_state)) {
    throw new Error('Read-only invariant violated: concept_state mutated during Brain GET');
  }
  if (JSON.stringify(pre.skill_states) !== JSON.stringify(post.skill_states)) {
    throw new Error('Read-only invariant violated: skill_states mutated during Brain GET');
  }
  if (pre.today_plan_count !== post.today_plan_count) {
    throw new Error(`Read-only invariant violated: today_plan_count mutated (${pre.today_plan_count} -> ${post.today_plan_count})`);
  }
  if (JSON.stringify(pre.today_plans) !== JSON.stringify(post.today_plans)) {
    throw new Error('Read-only invariant violated: today_plans mutated during Brain GET');
  }
  if (JSON.stringify(pre.today_activities) !== JSON.stringify(post.today_activities)) {
    throw new Error('Read-only invariant violated: today_activities mutated during Brain GET');
  }
}

export async function runPhaseELearningLoop(
  options: PhaseEOptions = {}
): Promise<PhaseEReport> {
  const startTime = Date.now();
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;

  let provisionedUserId: string | null = null;
  let resultReport: PhaseEReport | null = null;

  const setupThroughReviewAnswer =
    options.seams?.setupThroughReviewAnswer ?? setupRealLearnerThroughReviewAnswer;
  const fetchFn = options.seams?.fetchFn ?? globalThis.fetch;
  const captureDigest = options.seams?.captureDigest ?? captureLearnerDigestFromPostgres;
  const teardownLearner = options.seams?.teardownLearner ?? teardownRealLearner;

  try {
    // -------------------------------------------------------------------------
    // E1. Execute unbroken prerequisite chain through Review answer
    // -------------------------------------------------------------------------
    console.log('[Phase E][1/6] Executing unbroken prerequisite chain through Review answer...');
    const context = await setupThroughReviewAnswer({
      ...options,
      tag: 'phase-e',
      onUserCreated: (uid) => {
        provisionedUserId = uid;
      },
    });

    const actorId = context.actorId;
    const languageProfileId = context.languageProfileId;
    const reviewItemId = context.reviewItemId;
    const reviewEventId = context.reviewEventId;
    const reviewLearningEventId = context.reviewLearningEventId;

    // -------------------------------------------------------------------------
    // E2. Pre-Brain Observational PostgreSQL Probe
    // -------------------------------------------------------------------------
    console.log('[Phase E][2/6] Validating pre-Brain PostgreSQL state invariants (FRLL-08, FRLL-09 persistence)...');
    const preBrainDigest = await captureDigest(actorId, conceptId);

    if (preBrainDigest.review_item_count !== 1) {
      throw new Error(`Pre-Brain invariant failure: review_item_count is ${preBrainDigest.review_item_count} (expected 1).`);
    }
    if (preBrainDigest.fsrs_state_count !== 1) {
      throw new Error(`Pre-Brain invariant failure: fsrs_state_count is ${preBrainDigest.fsrs_state_count} (expected 1).`);
    }
    if (preBrainDigest.review_event_count !== 1) {
      throw new Error(`Pre-Brain invariant failure: review_event_count is ${preBrainDigest.review_event_count} (expected 1).`);
    }
    if (preBrainDigest.learning_event_count !== 2) {
      throw new Error(`Pre-Brain invariant failure: learning_event_count is ${preBrainDigest.learning_event_count} (expected 2).`);
    }
    const preConceptState = preBrainDigest.concept_state;
    if (!preConceptState) {
      throw new Error('Pre-Brain invariant failure: concept_state is missing in PostgreSQL.');
    }
    if (preConceptState.has_projectable_evidence !== true) {
      throw new Error('Pre-Brain invariant failure: has_projectable_evidence must be true after Review.');
    }
    if ((preConceptState.production_evidence_count ?? 0) !== 1) {
      throw new Error(`Pre-Brain invariant failure: production_evidence_count is ${preConceptState.production_evidence_count} (expected 1).`);
    }
    if ((preConceptState.recognition_evidence_count ?? 0) !== 0) {
      throw new Error(`Pre-Brain invariant failure: recognition_evidence_count is ${preConceptState.recognition_evidence_count} (expected 0).`);
    }
    if ((preConceptState.listening_evidence_count ?? 0) !== 0) {
      throw new Error(`Pre-Brain invariant failure: listening_evidence_count is ${preConceptState.listening_evidence_count} (expected 0).`);
    }

    console.log('  [OK] Pre-Brain database state verified: review_items=1, fsrs_states=1, review_events=1, learning_events=2, prod_evidence=1.');

    // -------------------------------------------------------------------------
    // E3. Fetch Brain Concept Detail via GET /v1/brain/concepts/{conceptId}
    // -------------------------------------------------------------------------
    console.log(`[Phase E][3/6] Fetching Brain concept detail via GET /v1/brain/concepts/${conceptId}...`);
    const brainConceptUrl = `${context.apiBaseUrl}/v1/brain/concepts/${encodeURIComponent(conceptId)}`;
    const brainConceptRes = await fetchFn(brainConceptUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (brainConceptRes.status !== 200) {
      const errBody = await brainConceptRes.text();
      throw new Error(`FRLL-12 failure: GET /v1/brain/concepts/${conceptId} returned HTTP ${brainConceptRes.status}: ${errBody}`);
    }

    const brainConceptDetail = parseBrainConceptResponse(await brainConceptRes.json());
    console.log(`  [OK] Brain concept detail received: id=${brainConceptDetail.concept.id}, status=${brainConceptDetail.status}, prod_evidence=${brainConceptDetail.competence.production.evidenceCount}.`);

    // -------------------------------------------------------------------------
    // E4. Brain Projection Proof (FRLL-12) & Synthetic-Zero Distinction
    // -------------------------------------------------------------------------
    console.log('[Phase E][4/6] Verifying Brain projection equality and synthetic-zero distinction (FRLL-12)...');

    // A. Concept Identity
    if (brainConceptDetail.concept.id !== conceptId) {
      throw new Error(`FRLL-12 failure: Brain returned concept.id (${brainConceptDetail.concept.id}) != expected (${conceptId}).`);
    }
    if (brainConceptDetail.concept.canonicalForm !== 'frll-anchor') {
      throw new Error(`FRLL-12 failure: Brain returned canonicalForm '${brainConceptDetail.concept.canonicalForm}' != 'frll-anchor'.`);
    }

    // B. Synthetic-Zero Distinction: Prove result is backed by persisted learner projection, NOT synthetic zero
    if (brainConceptDetail.status === 'unseen') {
      throw new Error('FRLL-12 failure: Brain returned synthetic-zero status "unseen" despite persisted Review evidence.');
    }
    if (!brainConceptDetail.memory) {
      throw new Error('FRLL-12 failure: Brain returned memory=null (synthetic zero) despite active FSRS state in PostgreSQL.');
    }
    if (brainConceptDetail.evidence.reviewCount === 0) {
      throw new Error('FRLL-12 failure: Brain returned evidence.reviewCount=0 despite committed review_event.');
    }
    if (brainConceptDetail.competence.production.evidenceCount === 0) {
      throw new Error('FRLL-12 failure: Brain returned production evidenceCount=0 despite persisted competence update.');
    }

    // C. Equality with PostgreSQL Authoritative Projection
    if (brainConceptDetail.status !== preConceptState.status) {
      throw new Error(`FRLL-12 failure: Brain status '${brainConceptDetail.status}' != PostgreSQL status '${preConceptState.status}'.`);
    }
    expectProjectionNumberEquivalent(brainConceptDetail.mastery, preConceptState.mastery, 'Brain mastery');
    expectProjectionNumberEquivalent(brainConceptDetail.confidence, preConceptState.confidence, 'Brain confidence');

    // Competence dimensions
    const brainProd = brainConceptDetail.competence.production;
    expectProjectionNumberEquivalent(brainProd.score, preConceptState.production, 'Brain production score');
    if (brainProd.evidenceCount !== 1) {
      throw new Error(`FRLL-12 failure: Brain production evidenceCount is ${brainProd.evidenceCount} (expected 1).`);
    }

    const brainRec = brainConceptDetail.competence.recognition;
    expectProjectionNumberEquivalent(brainRec.score, 0.5, 'Brain recognition score');
    if (brainRec.confidence !== 0 || brainRec.evidenceCount !== 0) {
      throw new Error(`FRLL-12 failure: Brain recognition dimension is not at zero-evidence prior (got confidence=${brainRec.confidence}, evidence=${brainRec.evidenceCount}).`);
    }

    const brainList = brainConceptDetail.competence.listening;
    expectProjectionNumberEquivalent(brainList.score, 0.5, 'Brain listening score');
    if (brainList.confidence !== 0 || brainList.evidenceCount !== 0) {
      throw new Error(`FRLL-12 failure: Brain listening dimension is not at zero-evidence prior (got confidence=${brainList.confidence}, evidence=${brainList.evidenceCount}).`);
    }

    // Memory snapshot
    const dbFsrs = preBrainDigest.fsrs_states[0];
    if (brainConceptDetail.memory.state !== dbFsrs.state) {
      throw new Error(`FRLL-12 failure: Brain memory.state '${brainConceptDetail.memory.state}' != PostgreSQL FSRS state '${dbFsrs.state}'.`);
    }
    if (new Date(brainConceptDetail.memory.dueAt).getTime() !== new Date(dbFsrs.due_at).getTime()) {
      throw new Error(`FRLL-12 failure: Brain memory.dueAt '${brainConceptDetail.memory.dueAt}' != PostgreSQL FSRS due_at '${dbFsrs.due_at}'.`);
    }
    if (brainConceptDetail.memory.lastReviewedAt === null || dbFsrs.last_review_at === null) {
      throw new Error('FRLL-12 failure: Brain memory.lastReviewedAt or PostgreSQL last_review_at is unexpectedly null.');
    }
    if (new Date(brainConceptDetail.memory.lastReviewedAt).getTime() !== new Date(dbFsrs.last_review_at).getTime()) {
      throw new Error(`FRLL-12 failure: Brain memory.lastReviewedAt '${brainConceptDetail.memory.lastReviewedAt}' != PostgreSQL last_review_at '${dbFsrs.last_review_at}'.`);
    }

    // Evidence
    if (brainConceptDetail.evidence.reviewCount !== 1) {
      throw new Error(`FRLL-12 failure: Brain evidence.reviewCount is ${brainConceptDetail.evidence.reviewCount} (expected 1).`);
    }
    if (brainConceptDetail.evidence.exposureCount !== 0) {
      throw new Error(`FRLL-12 failure: Brain evidence.exposureCount is ${brainConceptDetail.evidence.exposureCount} (expected 0).`);
    }

    console.log('  [OK] FRLL-12 verified: Brain concept detail matches PostgreSQL competence & memory authority exactly without synthetic fallback.');

    // -------------------------------------------------------------------------
    // E5. Brain Summary & Concept List Cross-Checks
    // -------------------------------------------------------------------------
    console.log('[Phase E][5/6] Cross-checking Brain summary and concept list projections...');

    // A. Brain Summary
    const summaryUrl = `${context.apiBaseUrl}/v1/brain/summary?languageProfileId=${encodeURIComponent(languageProfileId)}`;
    const summaryRes = await fetchFn(summaryUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    let brainSummary: BrainSummaryDto | undefined;
    if (summaryRes.status === 200) {
      brainSummary = parseBrainSummaryResponse(await summaryRes.json());
      if (brainSummary.languageProfileId !== languageProfileId) {
        throw new Error(`Brain summary failure: languageProfileId (${brainSummary.languageProfileId}) != ${languageProfileId}.`);
      }
      if (brainSummary.statusCounts.learning < 1) {
        throw new Error(`Brain summary failure: statusCounts.learning is ${brainSummary.statusCounts.learning} (expected >= 1).`);
      }
      console.log(`  [OK] Brain summary verified: languageProfileId=${brainSummary.languageProfileId}, total=${brainSummary.statusCounts.total}, learning=${brainSummary.statusCounts.learning}.`);
    } else {
      const errBody = await summaryRes.text();
      throw new Error(`Brain summary fetch failed with HTTP ${summaryRes.status}: ${errBody}`);
    }

    // B. Brain Concept List
    const listUrl = `${context.apiBaseUrl}/v1/brain/concepts?languageProfileId=${encodeURIComponent(languageProfileId)}&limit=10`;
    const listRes = await fetchFn(listUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    let brainConceptList: BrainConceptListResponseDto | undefined;
    if (listRes.status === 200) {
      brainConceptList = parseBrainConceptListResponse(await listRes.json());
      const anchorItem = brainConceptList.items.find((item) => item.concept.id === conceptId);
      if (!anchorItem) {
        throw new Error(`Brain concept list failure: anchor concept ${conceptId} not found in collection.`);
      }
      if (anchorItem.concept.status !== 'learning') {
        throw new Error(`Brain concept list failure: anchor item status is '${anchorItem.concept.status}' (expected 'learning').`);
      }
      if (anchorItem.competence.production.evidenceCount !== 1) {
        throw new Error(`Brain concept list failure: anchor item production evidenceCount is ${anchorItem.competence.production.evidenceCount} (expected 1).`);
      }
      console.log(`  [OK] Brain concept list verified: item count=${brainConceptList.items.length}, anchor concept found with status="learning".`);
    } else {
      const errBody = await listRes.text();
      throw new Error(`Brain concept list fetch failed with HTTP ${listRes.status}: ${errBody}`);
    }

    // -------------------------------------------------------------------------
    // E6. Observational PostgreSQL Probe: Read-Only Invariant Proof
    // -------------------------------------------------------------------------
    console.log('[Phase E][6/6] Proving Brain read-only invariant: verifying zero database mutations after all Brain GET calls...');
    const postBrainDigest = await captureDigest(actorId, conceptId);
    assertDigestsIdentical(preBrainDigest, postBrainDigest);
    console.log('  [OK] Read-only invariant proven: pre-Brain and post-Brain database digests are strictly identical.');

    const durationMs = Date.now() - startTime;
    resultReport = {
      success: true,
      userId: actorId,
      languageProfileId,
      conceptId,
      reviewItemId,
      reviewEventId,
      reviewLearningEventId,
      preBrainDigest,
      brainConceptDetail,
      brainSummary,
      brainConceptList,
      postBrainDigest,
      durationMs,
      cleanupVerified: false,
    };
  } finally {
    if (provisionedUserId) {
      console.log(`[Phase E] Tearing down disposable test user ${provisionedUserId}...`);
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
            '[Phase E] CLEANUP WARNING: Database or auth was not completely clean after teardown:',
            cleanupReport?.postgresDetails?.counts
          );
          throw new Error(
            `FRLL Phase E cleanup failure: Teardown verification failed: ${JSON.stringify(cleanupReport?.postgresDetails?.counts)}`
          );
        } else {
          console.log('  [OK] Disposable test user completely purged; 0 rows remain across all learner tables; anchor concept intact.');
        }
      } catch (err) {
        console.error('[Phase E] Error during teardown:', err);
        throw err;
      }
    }
  }

  if (!resultReport) {
    throw new Error('FRLL Phase E failed: resultReport was not constructed before teardown.');
  }

  return resultReport;
}
