import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertNoK2ActorsRemain,
  K2_HOSTED_STAGING_SUPABASE_REF,
  assertK2HostedAuthAbsent,
  authenticateK2HostedActor,
  cleanupK2HostedFixtureWithRecovery,
  cleanupK2RunActors,
  cleanupFreshK2HostedActorIdentity,
  createGithubTrustedSourceToken,
  createK2HostedFixtureOidcToken,
  createK2AdminClient,
  createK2HostedActor,
  createK2LearnerClient,
  reapExpiredK2Actors,
  requestK2HostedFixtureControl,
  setupK2HostedFixtureWithRecovery,
  validateK2HostedEnvironment,
  verifyK2HostedDeploymentAttestations,
  verifyK2HostedCurrentMasterSha,
  verifyK2StagingApiHealth,
  verifyProtectedVercelOrigin,
  verifyK2FreshActorOwnership,
  type K2AdminClient,
  type K2AuthenticatedActor,
  type K2HostedActor,
  type K2HostedFixtureDto,
  type K2HostedFixtureControlResult,
  type K2FreshActorIdentity,
  type K2HostedConfig,
} from './k2_hosted_actors';
import {
  assertK2RetainedStateUnchanged,
  K2_APPROVED_APP_MIGRATION_HEAD,
  runK2HostedProbe,
  type K2HostedActorLineageProof,
  type K2HostedAnchorMaterial,
  type K2HostedTodayReviewTargets,
  type K2HostedCandidateBaseProof,
  type K2HostedFrllSemanticProof,
  type K2RetainedSnapshot,
  type K2RetainedTableName,
  k2RetainedTableNames,
} from './k2_hosted_probe_client';
import {
  createK2FrllHeldBrainResponseGate,
  createK2FrllTodayDiagnostic,
  createK2FrllAuthBindingBarrier,
  createK2FrllReplayController,
  installK2BrowserRequestGuard,
  forwardK2FrllBrowserRequest,
  k2FrllDiagnosticStatus,
  type K2FrllConflictProof,
  type K2FrllHeldBrainResponseGate,
  type K2FrllReplayProof,
  type K2FrllActorSession,
  type K2FrllAuthBindingBarrier,
  type K2FrllBrowserRequest,
  type K2FrllNavigationRoute,
} from './k2_playwright_network';
import { createK2TrustedSourceTokenSupplier } from './k2_vercel_header';
import { signInK2BrowserActor } from './browser_actor_switch';
import {
  assertK2CreatedLanguageProfileReadback,
  parseK2LanguageProfileList,
} from './k2_hosted_acceptance_helpers';
import { validateContract } from './contract_validation';

export type K2HostedApiResult = {
  readonly response: Response;
  readonly payload: unknown;
};

export type K2HostedApiRequest = (
  accessToken: string,
  route: string,
  options?: {
    readonly method?: string;
    readonly body?: unknown;
    readonly idempotencyKey?: string;
    readonly ifMatch?: string;
  },
  expectedStatuses?: readonly number[],
) => Promise<K2HostedApiResult>;

export type K2WaveActorHandle = 'primary' | 'observer' | 'scenario-c' | 'scenario-d';
export type K2WaveReport = 'k2-07-untested-modalities' | 'k2-07-selected-modes' |
  'k2-08-due-only-scope' | 'k2-08-full-scope' | 'k2-09-bridge-dictionary';
export type K2WaveApiResult = Readonly<{ status: number; payload: unknown }>;
export type K2WaveApiOptions = Readonly<{
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}>;
export type K2FrllApiOptions = Readonly<{
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  ifMatch?: string;
}>;
export type K2BoundWaveApi = Readonly<{
  request(route: string, options?: K2WaveApiOptions, expectedStatuses?: readonly number[]):
    Promise<K2WaveApiResult>;
}>;

export type K2HostedCandidateRoleProof = Readonly<{
  contentHandle: string;
  estimatedMinutes: number;
  unseenConceptCount: number;
  linkedConceptHandles: readonly string[];
}>;
export type K2HostedCandidateRole = 'novel' | 'weak' | 'forgotten';
export type K2HostedCandidateMatrixProof = Readonly<{
  forgotten: K2HostedCandidateRoleProof;
  weak: K2HostedCandidateRoleProof;
  novel: K2HostedCandidateRoleProof;
}>;
export type K2HostedCandidateInputProof = Readonly<{
  baselineRoleOrder: readonly K2HostedCandidateRole[];
  effectiveStatus: Readonly<Record<K2HostedCandidateRole, 'none' | 'weak' | 'forgotten'>>;
  allCompetitorsEligible: boolean;
}>;

const WAVE_ACTOR_HANDLES: readonly K2WaveActorHandle[] = [
  'primary', 'observer', 'scenario-c', 'scenario-d',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WAVE_CANONICAL_CONCEPT_HANDLE = 'k2-anchor';
const WAVE_CANONICAL_CONCEPT_ID = '7f110000-0000-4000-8000-000000000004';
const FRLL_ANCHOR_LEMMA = 'frll-anchor';

const K2_HOSTED_PHASES = [
  'preflight_master_sha',
  'preflight_deployment_attestation',
  'preflight_oidc_token',
  'preflight_protected_origin',
  'preflight_api_health',
  'preflight_migration_probe',
  'preflight_k208_fixture_capability',
  'preflight_k208_catalog',
  'preflight_k208_empty_head',
  'preflight_k208_actor_candidates',
  'preflight_k209_ownership_graph',
  'preflight_k209_fixture_inspect',
  'prior_expired_actor_cleanup',
  'prior_interrupted_actor_cleanup',
  'prior_actor_absence_check',
  'retained_baseline_snapshot',
  'primary_actor_create',
  'observer_actor_create',
  'scenario_c_actor_create',
  'scenario_d_actor_create',
  'primary_actor_authentication',
  'observer_actor_authentication',
  'scenario_c_actor_authentication',
  'scenario_d_actor_authentication',
  'primary_prebootstrap_snapshot',
  'observer_prebootstrap_snapshot',
  'scenario_c_prebootstrap_snapshot',
  'scenario_d_prebootstrap_snapshot',
  'browser_oidc_token',
  'browser_protected_origin',
  'browser_request_guard',
  'browser_sign_in',
  'primary_profile_bootstrap',
  'observer_profile_bootstrap',
  'scenario_c_profile_bootstrap',
  'scenario_d_profile_bootstrap',
  'primary_postbootstrap_snapshot',
  'observer_postbootstrap_snapshot',
  'scenario_c_postbootstrap_snapshot',
  'scenario_d_postbootstrap_snapshot',
  'wave_k2_07',
  'wave_k2_08',
  'wave_k2_08_due_only',
  'wave_k2_09',
  'wave_k2_10',
  'fixture_frll_anchor_readback',
  'fixture_frll_onboarding_readback',
  'fixture_frll_passive_zero_write',
  'fixture_frll_save_learn',
  'fixture_frll_today_projection',
  'fixture_frll_review_answer',
  'fixture_frll_response_loss',
  'fixture_frll_exact_replay',
  'fixture_frll_changed_payload_conflict',
  'fixture_frll_brain_persisted_parity',
  'fixture_frll_actor_b_isolation',
  'fixture_frll_late_actor_response',
  'fixture_k208_due_only_dictionary_search',
  'fixture_k208_due_only_save_backlog',
  'fixture_k208_due_only_seed_snapshot',
  'fixture_k208_due_only_review_queue',
  'fixture_k208_due_only_today_generate',
  'fixture_k208_due_only_target_mapping',
  'fixture_k208_due_only_replay',
  'fixture_k208_due_only_profile_isolation',
  'fixture_k208_due_seed',
  'fixture_k208_forgotten_weak_pair',
  'fixture_k208_weak_only',
  'fixture_k208_candidate_matrix',
  'fixture_k208_post_setup_snapshots',
  'fixture_k209_setup',
  'fixture_k209_review_answer',
  'fixture_k209_review_replay',
  'fixture_k208_today_generation',
  'fixture_k208_cross_actor_isolation',
  'fixture_anchor_material',
  'fixture_canonical_concept_fetch',
  'fixture_primary_save',
  'fixture_post_save_primary_snapshot',
  'fixture_post_save_observer_snapshot',
  'fixture_post_save_lineage',
  'fixture_observer_review_queue',
  'fixture_primary_review_queue',
  'fixture_cross_actor_isolation',
  'fixture_self_recall_answer',
  'fixture_typing_answer',
  'fixture_answer_persistence_snapshot',
  'fixture_self_recall_replay',
  'fixture_typing_replay',
  'fixture_replay_snapshot',
  'fixture_self_recall_verification',
  'fixture_due_item_wait',
  'fixture_typing_verification',
  'fixture_final_observer_verification',
  'finalizer_begin',
  'finalizer_actor_cleanup',
  'finalizer_fresh_identity_cleanup',
  'finalizer_k209_actor_absence_before_fixture_cleanup',
  'finalizer_k209_fixture_cleanup',
  'finalizer_k209_fixture_closed_proof',
  'finalizer_k209_fixture_absent_proof',
  'finalizer_k209_actor_absence_after_fixture_cleanup',
  'finalizer_retained_comparison',
  'finalizer_complete',
] as const;
const K2_HOSTED_CHECKPOINT_EVENTS = ['start', 'pass'] as const;
const k2HostedPhaseSet = new Set<string>(K2_HOSTED_PHASES);
const k2HostedCheckpointEventSet = new Set<string>(K2_HOSTED_CHECKPOINT_EVENTS);

export type K2HostedPhase = typeof K2_HOSTED_PHASES[number];
export type K2HostedCheckpointEvent = typeof K2_HOSTED_CHECKPOINT_EVENTS[number];

export function markK2HostedCheckpoint(
  testInfo: Pick<TestInfo, 'annotations'>,
  phase: string,
  event: string,
): void {
  if (!k2HostedPhaseSet.has(phase) || !k2HostedCheckpointEventSet.has(event)) {
    throw new Error('K2 hosted acceptance diagnostic checkpoint was invalid.');
  }
  testInfo.annotations.push({ type: 'k2-hosted-phase', description: `${phase}:${event}` });
  console.log(JSON.stringify({ type: 'k2_hosted_phase', phase, event }));
}

export function markK2HostedFinalizerComplete(
  testInfo: Pick<TestInfo, 'annotations'>,
  proof: Readonly<{
    cleanupError: boolean;
    actorCleanupPassed: boolean;
    freshIdentityCleanupPassed: boolean;
    retainedComparisonPassed: boolean;
  }>,
): boolean {
  if (proof.cleanupError || !proof.actorCleanupPassed ||
      !proof.freshIdentityCleanupPassed || !proof.retainedComparisonPassed) {
    return false;
  }
  markK2HostedCheckpoint(testInfo, 'finalizer_complete', 'pass');
  return true;
}

export interface K2HostedWaveContext {
  readonly actors: Readonly<{
    primary: K2WaveActorHandle;
    observer: K2WaveActorHandle;
    scenarioC?: K2WaveActorHandle;
    scenarioD?: K2WaveActorHandle;
  }>;
  readonly api: Readonly<{
    primary: K2BoundWaveApi;
    observer: K2BoundWaveApi;
    scenarioC?: K2BoundWaveApi;
    scenarioD?: K2BoundWaveApi;
  }>;
  readonly frll?: K2HostedFrllHarness;
  readonly actorSnapshot: (actor: K2WaveActorHandle) => Promise<K2RetainedSnapshot>;
  readonly actorLineage: (actor: K2WaveActorHandle) => Promise<K2HostedActorLineageProof>;
  readonly actorTodayReviewTargets: (actor: K2WaveActorHandle) => Promise<K2HostedTodayReviewTargets>;
  readonly candidateMatrix?: Readonly<Partial<Record<K2WaveActorHandle, K2HostedCandidateMatrixProof>>>;
  readonly candidateProof?: (actor: K2WaveActorHandle) => Promise<K2HostedCandidateInputProof>;
  readonly verifyDueCandidateIsolation?: () => Promise<void>;
  readonly fixtureSetup?: Readonly<{
    seedForgottenWeakPair(): Promise<void>;
    seedWeakOnly(): Promise<void>;
  }>;
  readonly fixture?: K2HostedFixtureDto;
  readonly anchorMaterial: () => Promise<K2HostedAnchorMaterial>;
  readonly requireSnapshotRows: (snapshot: K2RetainedSnapshot, expected: Readonly<Record<string, number>>) => void;
  readonly report: (kind: K2WaveReport) => void;
  readonly checkpoint: (phase: K2HostedPhase, event: K2HostedCheckpointEvent) => void;
}

export interface K2HostedFrllHarness {
  readonly page: Page;
  readonly ui: K2HostedFrllUi;
  createPage(): Promise<Page>;
  signInAs(actor: K2WaveActorHandle): Promise<void>;
  switchToActor(actor: K2WaveActorHandle, page: Page): Promise<void>;
  request(
    actor: K2WaveActorHandle,
    route: string,
    options?: K2FrllApiOptions,
    expectedStatuses?: readonly number[],
  ): Promise<K2HostedApiResult>;
  semanticProof(actor: K2WaveActorHandle, idempotencyKeySha256?: string):
    Promise<K2HostedFrllSemanticProof>;
  todayTargetMatches(actor: K2WaveActorHandle, reviewItemId: string): Promise<boolean>;
  pendingReviewReceipt(page: Page): Promise<boolean>;
  dropNextAnswerResponse(): void;
  replayProof(): K2FrllReplayProof;
  conflictingReviewReplay(): Promise<K2FrllConflictProof>;
  holdNextBrainResponse(actor: K2WaveActorHandle): void;
  waitForHeldBrainResponse(): Promise<void>;
  releaseHeldBrainResponse(): void;
}

export interface K2HostedFrllUi {
  searchAnchor(page: Page): Promise<void>;
  saveAnchor(page: Page): Promise<void>;
  openToday(page: Page): Promise<void>;
  openPassiveToday(page: Page): Promise<void>;
  openReview(page: Page): Promise<void>;
  submitGood(page: Page): Promise<import('@playwright/test').Response>;
  submitGoodAndWaitForRetry(page: Page): Promise<void>;
  reloadForRetry(page: Page): Promise<void>;
  retryAnswer(page: Page): Promise<import('@playwright/test').Response>;
  waitForReviewComplete(page: Page): Promise<void>;
  openBrain(page: Page): Promise<void>;
  selectAnchorInBrain(page: Page): Promise<import('@playwright/test').Response>;
  waitForBrainAnchor(page: Page): Promise<void>;
  clickBrainAnchor(page: Page): Promise<void>;
  waitForEmptyBrain(page: Page): Promise<void>;
  assertNoBrainDetail(page: Page): Promise<void>;
}

export interface K2HostedWavePlugin {
  readonly waveId: 'K2-07' | 'K2-08-DUE-ONLY' | 'K2-08' | 'K2-09' | 'K2-10';
  readonly actorCount: 2 | 4;
  run(context: K2HostedWaveContext): Promise<void>;
}

export function k2HostedWaveCheckpoint(waveId: K2HostedWavePlugin['waveId']): K2HostedPhase {
  if (waveId === 'K2-07') return 'wave_k2_07';
  if (waveId === 'K2-08-DUE-ONLY') return 'wave_k2_08_due_only';
  if (waveId === 'K2-08') return 'wave_k2_08';
  if (waveId === 'K2-09') return 'wave_k2_09';
  if (waveId === 'K2-10') return 'wave_k2_10';
  throw new Error('K2 hosted acceptance wave is not implemented.');
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonObject;
}

export function dataObject(value: unknown, message: string): JsonObject {
  return object(object(value, message).data, message);
}

export async function requestK2HostedApi(
  config: K2HostedConfig,
  accessToken: string,
  route: string,
  options: {
    readonly method?: string;
    readonly body?: unknown;
    readonly idempotencyKey?: string;
    readonly ifMatch?: string;
  } = {},
  expectedStatuses: readonly number[] = [200],
): Promise<K2HostedApiResult> {
  let response: Response;
  try {
    response = await fetch(new URL(route, config.apiOrigin), {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        ...(options.ifMatch === undefined ? {} : { 'If-Match': options.ifMatch }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
  } catch {
    throw new Error('K2 hosted acceptance staging API request failed; provider details were suppressed.');
  }
  if (response.headers.get('x-lingua-source-sha') !== config.githubSha) {
    throw new Error('K2 hosted acceptance staging API source SHA did not match this protected source revision.');
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`K2 hosted acceptance staging API returned HTTP ${response.status}.`);
  }
  try { return { response, payload: await response.json() }; }
  catch { throw new Error('K2 hosted acceptance staging API returned invalid JSON.'); }
}

function requireK2FrllApiRoute(
  route: string,
  options: K2FrllApiOptions,
  profileId: string,
): string {
  let url: URL;
  try { url = new URL(route, 'https://k2-frll.invalid'); }
  catch { throw new Error('K2 hosted acceptance FRLL API route was not allowlisted.'); }
  if (url.origin !== 'https://k2-frll.invalid' || !url.pathname.startsWith('/v1/') || url.hash) {
    throw new Error('K2 hosted acceptance FRLL API route was not allowlisted.');
  }
  const method = options.method ?? 'GET';
  const queryKeys = [...url.searchParams.keys()];
  if (new Set(queryKeys).size !== queryKeys.length) {
    throw new Error('K2 hosted acceptance FRLL API route was not allowlisted.');
  }
  const noMutationFields = options.body === undefined && options.idempotencyKey === undefined &&
    options.ifMatch === undefined;
  const ownProfileQuery = (allowed: readonly string[]) =>
    queryKeys.every(key => allowed.includes(key)) &&
    (url.searchParams.get('languageProfileId') === null ||
     url.searchParams.get('languageProfileId') === profileId);
  if ((url.pathname === '/v1/me' || url.pathname === '/v1/me/languages') &&
      method === 'GET' && url.search === '' && noMutationFields) return `${url.pathname}`;
  if (url.pathname === '/v1/dictionary/search' && method === 'GET' && noMutationFields &&
      JSON.stringify([...queryKeys].sort()) === JSON.stringify(['languageCode', 'limit', 'query']) &&
      url.searchParams.get('query') === 'frll-anchor' &&
      url.searchParams.get('languageCode') === 'en' && url.searchParams.get('limit') === '100') {
    return `${url.pathname}?${url.searchParams.toString()}`;
  }
  if (url.pathname === `/v1/concepts/${WAVE_CANONICAL_CONCEPT_ID}` && method === 'GET' &&
      url.search === '' && noMutationFields) return url.pathname;
  if (url.pathname === `/v1/library/concepts/${WAVE_CANONICAL_CONCEPT_ID}` &&
      method === 'PUT' && url.search === '' && options.body === undefined &&
      options.idempotencyKey === undefined && options.ifMatch === undefined) return url.pathname;
  if (url.pathname === '/v1/library/items' && method === 'GET' && noMutationFields &&
      url.searchParams.get('itemType') === 'concept' && ownProfileQuery(['itemType', 'cursor']) &&
      queryKeys.includes('itemType') && [...url.searchParams.keys()].every(key => ['itemType', 'cursor'].includes(key))) {
    return `${url.pathname}?${url.searchParams.toString()}`;
  }
  if ((url.pathname === '/v1/today' || url.pathname === '/v1/review/queue' ||
       url.pathname === '/v1/brain/summary' || url.pathname === '/v1/brain/concepts') &&
      method === 'GET' && noMutationFields) {
    const allowed = url.pathname === '/v1/today' ? ['languageProfileId', 'date']
      : url.pathname === '/v1/review/queue' ? ['languageProfileId', 'limit', 'cursor']
        : ['languageProfileId', 'cursor'];
    if (ownProfileQuery(allowed) && queryKeys.every(key => allowed.includes(key)) &&
        (url.pathname !== '/v1/review/queue' || url.searchParams.get('limit') === null ||
         /^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit') ?? '')) &&
        (url.pathname !== '/v1/brain/concepts' || !url.searchParams.has('cursor'))) {
      return `${url.pathname}${url.search}`;
    }
  }
  if (url.pathname === `/v1/brain/concepts/${WAVE_CANONICAL_CONCEPT_ID}` &&
      method === 'GET' && url.search === '' && noMutationFields) return url.pathname;
  if (/^\/v1\/review\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/answer$/i.test(url.pathname) &&
      method === 'POST' && url.search === '' && options.body !== undefined &&
      options.idempotencyKey !== undefined && UUID_PATTERN.test(options.idempotencyKey) &&
      options.ifMatch === undefined && typeof options.body === 'object' && options.body !== null &&
      !Array.isArray(options.body)) {
    const body = options.body as Record<string, unknown>;
    const keys = Object.keys(body).sort();
    if (keys.join(',') === 'correct,exerciseMode,rating,responseTimeMs' &&
        body.correct === true && body.exerciseMode === 'self_recall' &&
        ['again', 'hard', 'good', 'easy'].includes(String(body.rating)) &&
        Number.isSafeInteger(body.responseTimeMs) && (body.responseTimeMs as number) >= 0) {
      return url.pathname;
    }
  }
  throw new Error('K2 hosted acceptance FRLL API route was not allowlisted.');
}

export function createK2OpaqueIdProjector(randomId: () => string = randomUUID): Readonly<{
  project(value: unknown): unknown;
  resolve(handle: string): string;
  bind(handle: string, id: string): void;
}> {
  const idToHandle = new Map<string, string>();
  const handleToId = new Map<string, string>();
  const bind = (handle: string, id: string) => {
    if (!handle || UUID_PATTERN.test(handle) || !UUID_PATTERN.test(id)) {
      throw new Error('K2 hosted acceptance opaque identity binding was invalid.');
    }
    const existing = handleToId.get(handle);
    if (existing !== undefined && existing !== id) {
      throw new Error('K2 hosted acceptance opaque identity binding was ambiguous.');
    }
    const prior = idToHandle.get(id);
    if (prior !== undefined && prior !== handle) {
      throw new Error('K2 hosted acceptance opaque identity binding was ambiguous.');
    }
    handleToId.set(handle, id);
    idToHandle.set(id, handle);
  };
  const project = (value: unknown): unknown => {
    if (typeof value === 'string' && UUID_PATTERN.test(value)) {
      let handle = idToHandle.get(value);
      if (!handle) {
        handle = `opaque-${randomId().replaceAll('-', '')}`;
        bind(handle, value);
      }
      return handle;
    }
    if (Array.isArray(value)) return value.map(project);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, project(item)]));
    }
    return value;
  };
  return {
    project,
    resolve(handle) {
      if (!handle || UUID_PATTERN.test(handle)) {
        throw new Error('K2 hosted acceptance refused a raw identity in the wave request.');
      }
      const id = handleToId.get(handle);
      if (!id) throw new Error('K2 hosted acceptance wave referenced an unknown opaque identity.');
      return id;
    },
    bind,
  };
}

function resolveWaveProfileHandle(
  value: string | null,
  ownHandle: K2WaveActorHandle,
  profiles: Readonly<Partial<Record<K2WaveActorHandle, string>>>,
): string | null {
  if (value === null) return profiles[ownHandle] ?? null;
  const match = /^actor:(primary|observer|scenario-c|scenario-d)$/.exec(value);
  if (!match) return null;
  return profiles[match[1] as K2WaveActorHandle] ?? null;
}

export function normalizeK2WaveRequest(
  ownHandle: K2WaveActorHandle,
  profiles: Readonly<Partial<Record<K2WaveActorHandle, string>>>,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
  route: string,
  options: K2WaveApiOptions,
  fixture?: K2HostedFixtureDto,
): Readonly<{ route: string; options: Parameters<typeof requestK2HostedApi>[3] }> {
  if (!route.startsWith('/v1/') || route.startsWith('//')) {
    throw new Error('K2 hosted acceptance refused an unapproved wave route.');
  }
  let url: URL;
  try { url = new URL(route, 'https://k2-wave.invalid'); }
  catch { throw new Error('K2 hosted acceptance refused an invalid wave route.'); }
  if (url.origin !== 'https://k2-wave.invalid' || url.hash) {
    throw new Error('K2 hosted acceptance refused an unapproved wave route.');
  }
  const optionKeys = Object.keys(options).sort();
  if (optionKeys.some(key => !['body', 'idempotencyKey', 'method'].includes(key))) {
    throw new Error('K2 hosted acceptance refused an unapproved wave request option.');
  }
  const method = options.method ?? 'GET';
  const queryKeys = [...new Set(url.searchParams.keys())].sort();
  if ([...url.searchParams.entries()].length !== queryKeys.length) {
    throw new Error('K2 hosted acceptance refused a repeated wave query parameter.');
  }
  let normalizedPath = url.pathname;
  if (url.pathname === '/v1/dictionary/search') {
    const query = url.searchParams.get('query');
    const grouped = url.searchParams.get('includeLemmaGroups');
    const baseKeys = ['languageCode', 'limit', 'query'];
    const allowedKeys = grouped === null ? baseKeys : [...baseKeys, 'includeLemmaGroups'];
    const isFixtureQuery = !!fixture && [fixture.lemma, fixture.inflectedForm].includes(query ?? '');
    if (method !== 'GET' || JSON.stringify(queryKeys) !== JSON.stringify(allowedKeys.sort()) ||
        url.searchParams.get('languageCode') !== 'en' || url.searchParams.get('limit') !== '100' ||
        query === null || (!/^[a-z]$/.test(query) && !isFixtureQuery) ||
        (grouped !== null && (!isFixtureQuery || grouped !== 'true')) || options.body !== undefined ||
        options.idempotencyKey !== undefined) {
      throw new Error('K2 hosted acceptance refused an unapproved Dictionary operation.');
    }
    normalizedPath = `${url.pathname}?${new URLSearchParams({
      query,
      languageCode: 'en',
      limit: '100',
      ...(grouped === null ? {} : { includeLemmaGroups: 'true' }),
    })}`;
  } else if (url.pathname.startsWith('/v1/concepts/')) {
    if (method !== 'GET' || queryKeys.length !== 0 || options.body !== undefined ||
        options.idempotencyKey !== undefined) {
      throw new Error('K2 hosted acceptance refused an unapproved concept operation.');
    }
    const handle = decodeURIComponent(url.pathname.slice('/v1/concepts/'.length));
    const id = handle === WAVE_CANONICAL_CONCEPT_HANDLE
      ? WAVE_CANONICAL_CONCEPT_ID
      : opaqueIds.resolve(handle);
    normalizedPath = `/v1/concepts/${encodeURIComponent(id)}`;
  } else if (url.pathname.startsWith('/v1/brain/concepts/')) {
    if (!fixture || method !== 'GET' || queryKeys.length !== 0 || options.body !== undefined ||
        options.idempotencyKey !== undefined) {
      throw new Error('K2 hosted acceptance refused an unapproved Brain concept operation.');
    }
    const handle = decodeURIComponent(url.pathname.slice('/v1/brain/concepts/'.length));
    if (handle !== 'k2-09-owner' && handle !== 'k2-09-secondary') {
      throw new Error('K2 hosted acceptance refused an unapproved Brain concept operation.');
    }
    normalizedPath = `/v1/brain/concepts/${encodeURIComponent(opaqueIds.resolve(handle))}`;
  } else if (url.pathname.startsWith('/v1/library/concepts/')) {
    if (method !== 'PUT' || queryKeys.length !== 0 || options.body !== undefined ||
        options.idempotencyKey !== undefined) {
      throw new Error('K2 hosted acceptance refused an unapproved Library operation.');
    }
    const handle = decodeURIComponent(url.pathname.slice('/v1/library/concepts/'.length));
    normalizedPath = `/v1/library/concepts/${encodeURIComponent(opaqueIds.resolve(handle))}`;
  } else if (url.pathname === '/v1/review/queue' || url.pathname === '/v1/today') {
    const allowed = url.pathname === '/v1/review/queue'
      ? ['languageProfileId', 'limit']
      : ['languageProfileId'];
    if (method !== 'GET' || queryKeys.some(key => !allowed.includes(key)) ||
        (url.pathname === '/v1/review/queue' && url.searchParams.has('limit') &&
         url.searchParams.get('limit') !== '100') || options.body !== undefined ||
        options.idempotencyKey !== undefined) {
      throw new Error('K2 hosted acceptance refused an unapproved learner projection.');
    }
    const profileId = resolveWaveProfileHandle(
      url.searchParams.get('languageProfileId'), ownHandle, profiles,
    );
    if (!profileId) throw new Error('K2 hosted acceptance wave profile binding was invalid.');
    normalizedPath = `${url.pathname}?${new URLSearchParams({
      languageProfileId: profileId,
      ...(url.searchParams.has('limit') ? { limit: '100' } : {}),
    })}`;
  } else {
    const completion = /^\/v1\/today\/([^/]+)\/activities\/([^/]+)\/complete$/.exec(url.pathname);
    if (completion) {
      if (method !== 'POST' || queryKeys.length !== 0 || !options.body ||
          typeof options.body !== 'object' || Array.isArray(options.body) || !options.idempotencyKey ||
          UUID_PATTERN.test(options.idempotencyKey) || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(options.idempotencyKey)) {
        throw new Error('K2 hosted acceptance refused an unapproved Today completion probe.');
      }
      const body = options.body as Record<string, unknown>;
      const keys = Object.keys(body);
      if (keys.some(key => key !== 'durationSeconds') ||
          (keys.includes('durationSeconds') && (!Number.isSafeInteger(body.durationSeconds) ||
            (body.durationSeconds as number) < 0 || (body.durationSeconds as number) > 86400))) {
        throw new Error('K2 hosted acceptance refused an unapproved Today completion probe.');
      }
      normalizedPath = `/v1/today/${encodeURIComponent(opaqueIds.resolve(decodeURIComponent(completion[1])))}` +
        `/activities/${encodeURIComponent(opaqueIds.resolve(decodeURIComponent(completion[2])))}/complete`;
    } else {
      const answer = /^\/v1\/review\/([^/]+)\/answer$/.exec(url.pathname);
      if (!answer || method !== 'POST' || queryKeys.length !== 0 || !options.body ||
          typeof options.body !== 'object' || Array.isArray(options.body) || !options.idempotencyKey ||
          UUID_PATTERN.test(options.idempotencyKey) || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(options.idempotencyKey)) {
        throw new Error('K2 hosted acceptance refused an unapproved Review operation.');
      }
      const body = options.body as Record<string, unknown>;
      const keys = Object.keys(body).sort();
      const mode = body.exerciseMode;
      if (!['self_recall', 'typing'].includes(String(mode)) ||
          !['again', 'hard', 'good', 'easy'].includes(String(body.rating)) ||
          !Number.isSafeInteger(body.responseTimeMs) ||
          (mode === 'typing' && (keys.join(',') !== 'exerciseMode,rating,responseText,responseTimeMs' ||
            typeof body.responseText !== 'string' || body.responseText.length > 80)) ||
          (mode === 'self_recall' && keys.join(',') !== 'correct,exerciseMode,rating,responseTimeMs') ||
          (mode === 'self_recall' && typeof body.correct !== 'boolean')) {
        throw new Error('K2 hosted acceptance refused an unapproved Review answer payload.');
      }
      normalizedPath = `/v1/review/${encodeURIComponent(opaqueIds.resolve(decodeURIComponent(answer[1])))}/answer`;
    }
  }
  return {
    route: normalizedPath,
    options: {
      method,
      ...(options.body === undefined ? {} : { body: options.body }),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    },
  };
}

function createBoundWaveApi(
  config: K2HostedConfig,
  session: K2AuthenticatedActor,
  actorHandle: K2WaveActorHandle,
  profiles: Readonly<Partial<Record<K2WaveActorHandle, string>>>,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
  onConceptSaved: (actor: K2WaveActorHandle, conceptId: string) => void,
  fixture?: K2HostedFixtureDto,
): K2BoundWaveApi {
  const expectedOwnProfileId = profiles[actorHandle];
  if (!expectedOwnProfileId || !UUID_PATTERN.test(expectedOwnProfileId)) {
    throw new Error('K2 hosted acceptance actor profile binding was incomplete.');
  }
  const idempotencyKeys = new Map<string, string>();
  return {
    async request(route, options = {}, expectedStatuses = [200]) {
      if (expectedStatuses.some(status => ![200, 403, 404].includes(status))) {
        throw new Error('K2 hosted acceptance refused an unapproved expected status.');
      }
      const request = normalizeK2WaveRequest(actorHandle, profiles, opaqueIds, route, options, fixture);
      const idempotencyKey = options.idempotencyKey
        ? (idempotencyKeys.get(options.idempotencyKey) ?? randomUUID())
        : undefined;
      if (options.idempotencyKey && idempotencyKey) {
        idempotencyKeys.set(options.idempotencyKey, idempotencyKey);
      }
      const result = await requestK2HostedApi(config, session.accessToken, request.route, {
        ...request.options,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }, expectedStatuses);
      if (result.response.status !== 200) {
        return { status: result.response.status, payload: null };
      }
      if (request.options?.method === 'PUT' && request.route.startsWith('/v1/library/concepts/')) {
        onConceptSaved(actorHandle, decodeURIComponent(request.route.slice('/v1/library/concepts/'.length)));
      }
      return {
        status: result.response.status,
        payload: projectK2WaveApiPayload(
          request.route, result.payload, opaqueIds, expectedOwnProfileId, fixture,
        ),
      };
    },
  };
}

const TODAY_REASON_CODES = new Set([
  'FSRS_DUE', 'FORGOTTEN_REMEDIATION', 'WEAK_REMEDIATION', 'CONTENT_FIT',
  'WEAK_RECOGNITION', 'WEAK_LISTENING', 'LOW_PRODUCTION_EVIDENCE',
  'RECENT_EXPOSURE', 'NEW_CONCEPT_BUDGET',
]);
const TODAY_PROFILE_BINDING_ERROR = 'K2 hosted acceptance Today profile binding was invalid.';

function assertOwnTodayProfile(data: JsonObject, expectedOwnProfileId: string | undefined): void {
  const responseProfileId = data.languageProfileId;
  if (!expectedOwnProfileId || !UUID_PATTERN.test(expectedOwnProfileId) ||
      typeof responseProfileId !== 'string' || !UUID_PATTERN.test(responseProfileId) ||
      responseProfileId !== expectedOwnProfileId) {
    throw new Error(TODAY_PROFILE_BINDING_ERROR);
  }
}

function projectedId(
  value: unknown,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  const projected = opaqueIds.project(value);
  if (typeof projected !== 'string' || UUID_PATTERN.test(projected)) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return projected;
}

function projectedCount(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return value as number;
}

function projectedFraction(value: unknown, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return value;
}

function projectK209Competence(raw: unknown): JsonObject {
  const competence = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  const result: JsonObject = {};
  for (const dimension of ['recognition', 'listening', 'production']) {
    const score = object(competence[dimension], 'K2 hosted acceptance learner response projection was invalid.');
    result[dimension] = {
      score: projectedFraction(score.score),
      confidence: projectedFraction(score.confidence),
      evidenceCount: projectedCount(score.evidenceCount, 1_000_000),
      ...(typeof score.updatedAt === 'string' ? { updatedAt: score.updatedAt } : {}),
    };
  }
  return result;
}

function projectK209Memory(raw: unknown): JsonObject | null {
  if (raw === undefined || raw === null) return null;
  const memory = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  if (typeof memory.state !== 'string' || typeof memory.dueAt !== 'string' ||
      typeof memory.isDue !== 'boolean' ||
      (memory.lastReviewedAt !== undefined && typeof memory.lastReviewedAt !== 'string')) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return {
    state: memory.state,
    dueAt: memory.dueAt,
    isDue: memory.isDue,
    ...(typeof memory.lastReviewedAt === 'string' ? { lastReviewedAt: memory.lastReviewedAt } : {}),
  };
}

function projectK209LinkedConcept(
  raw: unknown,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): JsonObject {
  const item = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  const concept = object(item.concept, 'K2 hosted acceptance learner response projection was invalid.');
  if (typeof concept.canonicalForm !== 'string' ||
      !['unseen', 'discovered', 'learning', 'familiar', 'active', 'mastered', 'weak', 'forgotten']
        .includes(String(concept.status)) || typeof concept.isDue !== 'boolean' ||
      typeof item.isSaved !== 'boolean' ||
      (item.lastSeenAt !== undefined && typeof item.lastSeenAt !== 'string')) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return {
    concept: {
      id: projectedId(concept.id, opaqueIds),
      canonicalForm: concept.canonicalForm,
      status: concept.status,
      isDue: concept.isDue,
    },
    competence: projectK209Competence(item.competence),
    mastery: projectedFraction(item.mastery, true),
    confidence: projectedFraction(item.confidence),
    memory: projectK209Memory(item.memory),
    exposureCount: projectedCount(item.exposureCount, 1_000_000),
    lastSeenAt: typeof item.lastSeenAt === 'string' ? item.lastSeenAt : null,
    isSaved: item.isSaved,
  };
}

function projectK209DictionaryGroup(
  raw: unknown,
  fixture: K2HostedFixtureDto,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): JsonObject {
  const group = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  if (group.lemma !== fixture.lemma || typeof group.lexemeId !== 'string' ||
      !Array.isArray(group.matchedForms) || group.matchedForms.length < 1 ||
      group.matchedForms.length > 20 || group.matchedForms.some(form => typeof form !== 'string') ||
      !Array.isArray(group.senses) || group.senses.length > 100 ||
      (group.partOfSpeech !== undefined && group.partOfSpeech !== null && typeof group.partOfSpeech !== 'string')) {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return {
    lexemeId: projectedId(group.lexemeId, opaqueIds),
    lemma: group.lemma,
    ...(typeof group.partOfSpeech === 'string' ? { partOfSpeech: group.partOfSpeech } : {}),
    matchedForms: [...group.matchedForms],
    senses: group.senses.map(rawSense => {
      const sense = object(rawSense, 'K2 hosted acceptance learner response projection was invalid.');
      if (!Number.isSafeInteger(sense.senseOrder) || (sense.senseOrder as number) < 1 ||
          typeof sense.definition !== 'string' || typeof sense.definitionLanguageCode !== 'string' ||
          !Array.isArray(sense.concepts) || sense.concepts.length > 100 ||
          (sense.translatedDefinition !== undefined && typeof sense.translatedDefinition !== 'string') ||
          (sense.translationLanguageCode !== undefined && typeof sense.translationLanguageCode !== 'string')) {
        throw new Error('K2 hosted acceptance learner response projection was invalid.');
      }
      return {
        senseId: projectedId(sense.senseId, opaqueIds),
        senseOrder: sense.senseOrder,
        definition: sense.definition,
        definitionLanguageCode: sense.definitionLanguageCode,
        ...(typeof sense.translatedDefinition === 'string'
          ? { translatedDefinition: sense.translatedDefinition } : {}),
        ...(typeof sense.translationLanguageCode === 'string'
          ? { translationLanguageCode: sense.translationLanguageCode } : {}),
        concepts: sense.concepts.map(concept => projectK209LinkedConcept(concept, opaqueIds)),
      };
    }),
  };
}

function projectK209CursorMeta(raw: unknown): JsonObject {
  const meta = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  if (typeof meta.requestId !== 'string' || !UUID_PATTERN.test(meta.requestId) || meta.apiVersion !== '1.0' ||
      !(meta.nextCursor === null || (typeof meta.nextCursor === 'string' && meta.nextCursor.length <= 512)) ||
      typeof meta.hasMore !== 'boolean') {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  return {
    apiVersion: '1.0',
    hasMore: meta.hasMore,
    pageSize: projectedCount(meta.pageSize, 100),
    hasNextCursor: meta.nextCursor !== null,
  };
}

function projectTodayActivity(
  raw: unknown,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): JsonObject {
  const activity = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
  const reasonCodes = activity.reasonCodes;
  if (!Array.isArray(reasonCodes) || reasonCodes.length > TODAY_REASON_CODES.size ||
      reasonCodes.some(code => typeof code !== 'string' || !TODAY_REASON_CODES.has(code)) ||
      !['review', 'read', 'listen', 'learn'].includes(String(activity.activityType)) ||
      !['pending', 'completed', 'skipped'].includes(String(activity.status)) ||
      typeof activity.createdAt !== 'string') {
    throw new Error('K2 hosted acceptance learner response projection was invalid.');
  }
  const projectOptionalId = (value: unknown) => value == null ? null : projectedId(value, opaqueIds);
  return {
    id: projectedId(activity.id, opaqueIds),
    activityType: activity.activityType,
    position: projectedCount(activity.position, 20),
    targetCount: activity.targetCount == null ? null : projectedCount(activity.targetCount, 181),
    completedCount: projectedCount(activity.completedCount, 1_000_000),
    estimatedMinutes: projectedCount(activity.estimatedMinutes, 240),
    status: activity.status,
    reasonCodes: [...reasonCodes],
    contentId: projectOptionalId(activity.contentId),
    conceptId: projectOptionalId(activity.conceptId),
    reviewItemId: projectOptionalId(activity.reviewItemId),
    completedAt: typeof activity.completedAt === 'string' ? activity.completedAt : null,
    createdAt: activity.createdAt,
  };
}

/** Returns fixed route-specific fields only; arbitrary API and error payloads stay runner-private. */
export function projectK2WaveApiPayload(
  route: string,
  payload: unknown,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
  expectedOwnProfileId?: string,
  fixture?: K2HostedFixtureDto,
): unknown {
  const envelope = object(payload, 'K2 hosted acceptance learner response projection was invalid.');
  const rawData = envelope.data;
  const routeUrl = new URL(route, 'https://k2-wave.invalid');
  const pathname = routeUrl.pathname;
  if (pathname === '/v1/dictionary/search') {
    if (!Array.isArray(rawData) || rawData.length > 100) {
      throw new Error('K2 hosted acceptance learner response projection was invalid.');
    }
    const query = routeUrl.searchParams.get('query');
    const fixtureQuery = !!fixture && [fixture.lemma, fixture.inflectedForm].includes(query ?? '');
    if (fixtureQuery) {
      const data = rawData.map(raw => ({
        id: projectedId(object(raw, 'K2 hosted acceptance learner response projection was invalid.').id, opaqueIds),
      }));
      const meta = projectK209CursorMeta(envelope.meta);
      if (routeUrl.searchParams.get('includeLemmaGroups') === 'true') {
        if (!Array.isArray(envelope.lemmaGroups) || envelope.lemmaGroups.length > 100) {
          throw new Error('K2 hosted acceptance learner response projection was invalid.');
        }
        return {
          data,
          meta,
          lemmaGroups: envelope.lemmaGroups.map(group => projectK209DictionaryGroup(group, fixture, opaqueIds)),
        };
      }
      if (Object.hasOwn(envelope, 'lemmaGroups')) {
        throw new Error('K2 hosted acceptance learner response projection was invalid.');
      }
      return { data, meta };
    }
    return { data: rawData.map(raw => ({
      id: projectedId(object(raw, 'K2 hosted acceptance learner response projection was invalid.').id, opaqueIds),
    })) };
  }
  if (pathname.startsWith('/v1/concepts/')) {
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    if (fixture) {
      if (!Array.isArray(data.definitions) || data.definitions.length > 100) {
        throw new Error('K2 hosted acceptance learner response projection was invalid.');
      }
      return { data: {
        id: projectedId(data.id, opaqueIds),
        definitions: data.definitions.map(raw => {
          const definition = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
          if (typeof definition.definition !== 'string' || typeof definition.languageCode !== 'string' ||
              !Number.isSafeInteger(definition.order) ||
              (definition.translation !== undefined && typeof definition.translation !== 'string')) {
            throw new Error('K2 hosted acceptance learner response projection was invalid.');
          }
          return {
            definition: definition.definition,
            languageCode: definition.languageCode,
            order: definition.order,
            ...(typeof definition.translation === 'string' ? { translation: definition.translation } : {}),
          };
        }),
      } };
    }
    return { data: { id: projectedId(data.id, opaqueIds) } };
  }
  if (pathname.startsWith('/v1/brain/concepts/')) {
    if (!fixture) throw new Error('K2 hosted acceptance learner response projection was invalid.');
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    const concept = object(data.concept, 'K2 hosted acceptance learner response projection was invalid.');
    const learner = object(concept.learner, 'K2 hosted acceptance learner response projection was invalid.');
    const evidence = object(data.evidence, 'K2 hosted acceptance learner response projection was invalid.');
    if (!['unseen', 'discovered', 'learning', 'familiar', 'active', 'mastered', 'weak', 'forgotten']
      .includes(String(data.status)) || typeof learner.isDue !== 'boolean' ||
      !['unseen', 'discovered', 'learning', 'familiar', 'active', 'mastered', 'weak', 'forgotten']
        .includes(String(learner.status)) ||
      !Number.isSafeInteger(evidence.reviewCount) || (evidence.reviewCount as number) < 0 ||
      (evidence.lastSeenAt !== undefined && typeof evidence.lastSeenAt !== 'string') ||
      (evidence.lastReviewedAt !== undefined && typeof evidence.lastReviewedAt !== 'string')) {
      throw new Error('K2 hosted acceptance learner response projection was invalid.');
    }
    return { data: {
      concept: {
        id: projectedId(concept.id, opaqueIds),
        learner: { status: learner.status, isDue: learner.isDue },
      },
      status: data.status,
      competence: projectK209Competence(data.competence),
      mastery: projectedFraction(data.mastery, true),
      confidence: projectedFraction(data.confidence),
      memory: projectK209Memory(data.memory),
      evidence: {
        exposureCount: projectedCount(evidence.exposureCount, 1_000_000),
        reviewCount: projectedCount(evidence.reviewCount, 1_000_000),
        lastSeenAt: typeof evidence.lastSeenAt === 'string' ? evidence.lastSeenAt : null,
        lastReviewedAt: typeof evidence.lastReviewedAt === 'string' ? evidence.lastReviewedAt : null,
      },
    } };
  }
  if (pathname.startsWith('/v1/library/concepts/')) {
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    if (typeof data.isSaved !== 'boolean') {
      throw new Error('K2 hosted acceptance learner response projection was invalid.');
    }
    return { data: { isSaved: data.isSaved } };
  }
  if (pathname === '/v1/review/queue') {
    if (!Array.isArray(rawData) || rawData.length > 100) {
      throw new Error('K2 hosted acceptance learner response projection was invalid.');
    }
    return { data: rawData.map(raw => {
      const item = object(raw, 'K2 hosted acceptance learner response projection was invalid.');
      const concept = object(item.concept, 'K2 hosted acceptance learner response projection was invalid.');
      const competence = object(item.competence, 'K2 hosted acceptance learner response projection was invalid.');
      const score = (dimension: string) => {
        const value = object(competence[dimension], 'K2 hosted acceptance learner response projection was invalid.');
        if (typeof value.score !== 'number' || !Number.isFinite(value.score) ||
            value.score < 0 || value.score > 1) {
          throw new Error('K2 hosted acceptance learner response projection was invalid.');
        }
        return { score: value.score, evidenceCount: projectedCount(value.evidenceCount, 1_000_000) };
      };
      if (!['self_recall', 'multiple_choice', 'typing', 'cloze', 'listening'].includes(String(item.exerciseMode))) {
        throw new Error('K2 hosted acceptance learner response projection was invalid.');
      }
      return {
        reviewItemId: projectedId(item.reviewItemId, opaqueIds),
        concept: { id: projectedId(concept.id, opaqueIds) },
        exerciseMode: item.exerciseMode,
        competence: {
          recognition: score('recognition'),
          listening: score('listening'),
          production: score('production'),
        },
      };
    }) };
  }
  if (pathname === '/v1/today') {
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    assertOwnTodayProfile(data, expectedOwnProfileId);
    if (!Array.isArray(data.activities) || data.activities.length > 20 ||
        typeof data.engineVersion !== 'string' || typeof data.planDate !== 'string' ||
        !['draft', 'active', 'completed', 'expired'].includes(String(data.status)) ||
        typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string' ||
        data.planDate.length !== 10) {
      throw new Error('K2 hosted acceptance learner response projection was invalid.');
    }
    return { data: {
      id: projectedId(data.id, opaqueIds),
      planDate: data.planDate,
      targetMinutes: projectedCount(data.targetMinutes, 180),
      completedMinutes: projectedCount(data.completedMinutes, 1440),
      status: data.status,
      engineVersion: data.engineVersion,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      activities: data.activities.map(raw => projectTodayActivity(raw, opaqueIds)),
    } };
  }
  const completion = /^\/v1\/today\/([^/]+)\/activities\/([^/]+)\/complete$/.exec(pathname);
  if (completion) {
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    const plan = object(data.plan, 'K2 hosted acceptance learner response projection was invalid.');
    const activity = object(data.activity, 'K2 hosted acceptance learner response projection was invalid.');
    assertOwnTodayProfile(plan, expectedOwnProfileId);
    if (plan.id !== decodeURIComponent(completion[1]) ||
        activity.id !== decodeURIComponent(completion[2])) {
      throw new Error('K2 hosted acceptance Today completion projection was invalid.');
    }
    const projectedPlan = projectK2WaveApiPayload('/v1/today', { data: plan }, opaqueIds, expectedOwnProfileId);
    const projectedActivity = projectTodayActivity(activity, opaqueIds);
    return { data: {
      plan: (projectedPlan as { data: unknown }).data,
      activity: projectedActivity,
    } };
  }
  if (/^\/v1\/review\/[^/]+\/answer$/.test(pathname)) {
    const data = object(rawData, 'K2 hosted acceptance learner response projection was invalid.');
    const competence = object(data.competence, 'K2 hosted acceptance learner response projection was invalid.');
    const production = object(competence.production, 'K2 hosted acceptance learner response projection was invalid.');
    return { data: {
      reviewItemId: projectedId(data.reviewItemId, opaqueIds),
      competence: { production: { evidenceCount: projectedCount(production.evidenceCount, 1_000_000) } },
    } };
  }
  throw new Error('K2 hosted acceptance learner response route was not projectable.');
}

function reportWaveAnnotation(testInfo: TestInfo, kind: K2WaveReport): void {
  const descriptions: Readonly<Record<K2WaveReport, string>> = {
    'k2-07-untested-modalities': 'cloze and listening are untested: no published aligned target or HTTPS audio in staging',
    'k2-07-selected-modes': 'self_recall, typing',
    'k2-08-due-only-scope': 'K2-08 due-only subcase; this does not satisfy full K2-08 hosted acceptance.',
    'k2-08-full-scope': 'K2-08 full four-scenario hosted gate; not closed until every required gate passes.',
    'k2-09-bridge-dictionary': 'K2-09 bridge-backed Dictionary, normal Save/Review, Brain parity, and residue gate.',
  };
  if (!Object.hasOwn(descriptions, kind)) {
    throw new Error('K2 hosted acceptance report annotation was invalid.');
  }
  testInfo.annotations.push({ type: kind, description: descriptions[kind] });
}

export async function verifyK2FixtureZeroRowHead(client: SupabaseClient): Promise<void> {
  try {
    const result = await client.from('user_concept_states').select('id', { head: true }).limit(0);
    const returnedCount = (result as unknown as { count?: unknown }).count;
    if (result.error || result.status < 200 || result.status >= 300 ||
        result.data !== null ||
        (returnedCount !== null && returnedCount !== undefined)) {
      throw new Error('invalid head proof');
    }
  } catch {
    throw new Error('K2 hosted acceptance fixture HEAD limit=0 preflight failed closed.');
  }
}

export function requireK2ActorSnapshotRows(
  snapshot: K2RetainedSnapshot,
  expected: Readonly<Record<string, number>>,
): void {
  for (const [table, count] of Object.entries(expected)) {
    const rows = snapshot.tables[table as keyof K2RetainedSnapshot['tables']]?.rows;
    if (rows !== count) throw new Error('K2 hosted acceptance actor fixture did not match expected row counts.');
  }
}

const K2_10_FRESH_PROFILE_BOOTSTRAP_ROWS: Readonly<Partial<Record<K2RetainedTableName, number>>> = {
  users: 1,
  learner_profiles: 1,
  profile_mutation_results: 1,
  user_languages: 1,
};

export function assertK210FreshProfileBootstrapSnapshot(snapshot: K2RetainedSnapshot): void {
  const expectedTotalRows = 4;
  if (snapshot.totalRows !== expectedTotalRows || k2RetainedTableNames().some(table =>
    snapshot.tables[table].rows !== (K2_10_FRESH_PROFILE_BOOTSTRAP_ROWS[table] ?? 0),
  )) {
    throw new Error('K2 hosted acceptance K2-10 fresh profile bootstrap snapshot was unexpected.');
  }
}

async function actorSnapshot(config: K2HostedConfig, actorId: string): Promise<K2RetainedSnapshot> {
  const result = await runK2HostedProbe('actor_snapshot', config.readonlyDatabaseUrl, actorId);
  if (!('tables' in result)) throw new Error('K2 hosted acceptance actor snapshot was invalid.');
  return result;
}

async function actorLineage(config: K2HostedConfig, actorId: string): Promise<K2HostedActorLineageProof> {
  const result = await runK2HostedProbe('actor_lineage', config.readonlyDatabaseUrl, actorId);
  if (!('events' in result)) throw new Error('K2 hosted acceptance actor lineage proof was invalid.');
  return result;
}

async function actorTodayReviewTargets(
  config: K2HostedConfig,
  actorId: string,
): Promise<K2HostedTodayReviewTargets> {
  const result = await runK2HostedProbe('today_review_targets', config.readonlyDatabaseUrl, actorId);
  if (!('reviewItemIds' in result)) {
    throw new Error('K2 hosted acceptance Today target probe was invalid.');
  }
  return result;
}

type K2K208ActorBinding = Readonly<{
  handle: K2WaveActorHandle;
  actor: K2HostedActor;
  profileId: string;
}>;
type K2K208CandidateRow = K2HostedCandidateBaseProof['candidates'][number];
type K2K208CandidateSelection = Readonly<{
  novel: K2K208CandidateRow;
  weak: K2K208CandidateRow;
  forgotten: K2K208CandidateRow;
  weakConceptId: string;
  forgottenConceptId: string;
}>;

async function readK208CandidateBase(
  config: K2HostedConfig,
  binding: K2K208ActorBinding,
  admin: K2AdminClient,
): Promise<K2HostedCandidateBaseProof> {
  await verifyK2FreshActorOwnership(config, binding.actor, admin);
  const result = await runK2HostedProbe(
    'k208_candidate_base', config.readonlyDatabaseUrl, binding.actor.id, binding.profileId,
  );
  if (!('candidates' in result)) {
    throw new Error('K2 hosted acceptance candidate base proof was unavailable.');
  }
  return result;
}

export function allK208CompetitorsEligibleForStates(
  rows: readonly K2HostedCandidateBaseProof['candidates'][number][],
  knownConceptIds: ReadonlySet<string> = new Set(),
): boolean {
  return rows.length > 0 && rows.every(row => {
    const uniqueConcepts = new Set(row.linkedConceptIds);
    const expectedUnseenCount = row.linkedConceptIds.filter(id => !knownConceptIds.has(id)).length;
    return row.linkedConceptIds.length >= 1 && row.linkedConceptIds.length <= 4 &&
      uniqueConcepts.size === row.linkedConceptIds.length &&
      row.unseenCount === expectedUnseenCount && row.unseenCount <= 4 &&
      row.estimatedMinutes >= 5 && !row.isSaved && !row.isUnfinished && !row.isCompleted;
  });
}

function candidateFixtureEligible(row: K2K208CandidateRow): boolean {
  return allK208CompetitorsEligibleForStates([row]);
}

function uniqueCandidateConcept(
  candidate: K2K208CandidateRow,
  candidates: readonly K2K208CandidateRow[],
): string | undefined {
  return candidate.linkedConceptIds.find(conceptId =>
    candidates.filter(row => row.linkedConceptIds.includes(conceptId)).length === 1);
}

function selectK208CandidateRoles(
  candidates: readonly K2K208CandidateRow[],
): K2K208CandidateSelection {
  if (candidates.length < 3 || candidates.some(row =>
    row.isSaved || row.isUnfinished || row.isCompleted)) {
    throw new Error('K2 hosted acceptance fresh actor has an ineligible candidate baseline.');
  }
  for (let novelIndex = 0; novelIndex < candidates.length - 2; novelIndex += 1) {
    const novel = candidates[novelIndex];
    if (!candidateFixtureEligible(novel)) continue;
    for (let weakIndex = novelIndex + 1; weakIndex < candidates.length - 1; weakIndex += 1) {
      const weak = candidates[weakIndex];
      if (!candidateFixtureEligible(weak) || weak.estimatedMinutes !== 5) continue;
      const weakConceptId = uniqueCandidateConcept(weak, candidates);
      if (!weakConceptId) continue;
      for (let forgottenIndex = weakIndex + 1; forgottenIndex < candidates.length; forgottenIndex += 1) {
        const forgotten = candidates[forgottenIndex];
        if (!candidateFixtureEligible(forgotten) || forgotten.estimatedMinutes !== 5) continue;
        const forgottenConceptId = uniqueCandidateConcept(forgotten, candidates);
        if (!forgottenConceptId || forgottenConceptId === weakConceptId ||
            novel.linkedConceptIds.includes(weakConceptId) ||
            novel.linkedConceptIds.includes(forgottenConceptId)) continue;
        return { novel, weak, forgotten, weakConceptId, forgottenConceptId };
      }
    }
  }
  throw new Error('K2 hosted acceptance could not prove a bounded N/W/F candidate matrix.');
}

function candidateSelectionIdentity(selection: K2K208CandidateSelection): string {
  return JSON.stringify([
    selection.novel.contentId,
    selection.weak.contentId,
    selection.forgotten.contentId,
    selection.weakConceptId,
    selection.forgottenConceptId,
  ]);
}

function publicCandidateMatrix(
  selection: K2K208CandidateSelection,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): K2HostedCandidateMatrixProof {
  const project = (row: K2K208CandidateRow): K2HostedCandidateRoleProof => ({
    contentHandle: opaqueIds.project(row.contentId) as string,
    estimatedMinutes: row.estimatedMinutes,
    unseenConceptCount: row.unseenCount,
    linkedConceptHandles: row.linkedConceptIds.map(id => opaqueIds.project(id) as string),
  });
  return {
    novel: project(selection.novel),
    weak: project(selection.weak),
    forgotten: project(selection.forgotten),
  };
}

function assertSameK208CandidateBaseline(
  before: K2HostedCandidateBaseProof,
  after: K2HostedCandidateBaseProof,
): void {
  if (before.candidates.length !== after.candidates.length || before.candidates.some((row, index) => {
    const current = after.candidates[index];
    return !current || row.contentId !== current.contentId ||
      row.estimatedMinutes !== current.estimatedMinutes ||
      JSON.stringify(row.linkedConceptIds) !== JSON.stringify(current.linkedConceptIds) ||
      row.isSaved !== current.isSaved || row.isUnfinished !== current.isUnfinished ||
      row.isCompleted !== current.isCompleted;
  })) {
    throw new Error('K2 hosted acceptance bounded candidate catalog changed during fixture setup.');
  }
}

async function buildK208CandidateMatrix(
  config: K2HostedConfig,
  bindings: readonly K2K208ActorBinding[],
  admin: K2AdminClient,
  opaqueIds: ReturnType<typeof createK2OpaqueIdProjector>,
): Promise<Readonly<{
  selections: ReadonlyMap<K2WaveActorHandle, K2K208CandidateSelection>;
  baselines: ReadonlyMap<K2WaveActorHandle, K2HostedCandidateBaseProof>;
  publicProofs: Readonly<Partial<Record<K2WaveActorHandle, K2HostedCandidateMatrixProof>>>;
}>> {
  const selections = new Map<K2WaveActorHandle, K2K208CandidateSelection>();
  const baselines = new Map<K2WaveActorHandle, K2HostedCandidateBaseProof>();
  const publicProofs: Partial<Record<K2WaveActorHandle, K2HostedCandidateMatrixProof>> = {};
  let expectedSelection: string | undefined;
  for (const binding of bindings) {
    const base = await readK208CandidateBase(config, binding, admin);
    if (base.stateConceptIds.length !== 0) {
      throw new Error('K2 hosted acceptance fresh actor has unexpected candidate-linked learner state.');
    }
    if (!allK208CompetitorsEligibleForStates(base.candidates)) {
      throw new Error('K2 hosted acceptance fresh candidate competitors were not all eligible.');
    }
    const selection = selectK208CandidateRoles(base.candidates);
    const identity = candidateSelectionIdentity(selection);
    if (expectedSelection !== undefined && identity !== expectedSelection) {
      throw new Error('K2 hosted acceptance actor profiles do not share one exact candidate matrix.');
    }
    expectedSelection = identity;
    selections.set(binding.handle, selection);
    baselines.set(binding.handle, base);
    publicProofs[binding.handle] = publicCandidateMatrix(selection, opaqueIds);
  }
  return { selections, baselines, publicProofs };
}

export function exactK208FixtureStateReadback(
  proof: K2HostedCandidateBaseProof,
  expected: readonly Readonly<{ conceptId: string; status: 'weak' | 'forgotten' }>[],
): boolean {
  if (proof.stateStatuses.length !== expected.length ||
      proof.stateConceptIds.length !== expected.length ||
      new Set(proof.stateConceptIds).size !== proof.stateConceptIds.length) return false;
  const actual = new Map(proof.stateStatuses.map(row => [row.conceptId, row]));
  if (actual.size !== expected.length ||
      [...actual.keys()].some(conceptId => !proof.stateConceptIds.includes(conceptId))) return false;
  return expected.every(item => {
    const row = actual.get(item.conceptId);
    return row?.status === item.status && row.stateVersion === 1;
  });
}

async function seedK208Fixture(
  config: K2HostedConfig,
  admin: K2AdminClient,
  binding: K2K208ActorBinding,
  selection: K2K208CandidateSelection,
  baseline: K2HostedCandidateBaseProof,
  mode: 'forgotten_weak_pair' | 'weak_only',
): Promise<void> {
  if ((mode === 'forgotten_weak_pair' && binding.handle !== 'observer') ||
      (mode === 'weak_only' && binding.handle !== 'scenario-c')) {
    throw new Error('K2 hosted acceptance fixture operation was not bound to its reviewed actor.');
  }
  const current = await readK208CandidateBase(config, binding, admin);
  assertSameK208CandidateBaseline(baseline, current);
  if (current.stateConceptIds.length !== 0) {
    throw new Error('K2 hosted acceptance fixture target already has actor state.');
  }
  const expected = mode === 'forgotten_weak_pair'
    ? [
        { conceptId: selection.weakConceptId, status: 'weak' as const },
        { conceptId: selection.forgottenConceptId, status: 'forgotten' as const },
      ]
    : [{ conceptId: selection.weakConceptId, status: 'weak' as const }];
  const values = expected.map(row => ({
    user_id: binding.actor.id,
    user_language_id: binding.profileId,
    concept_id: row.conceptId,
    language_code: 'en',
    status: row.status,
    state_version: 1,
  }));
  let ambiguous = false;
  try {
    const inserted = await (admin as unknown as SupabaseClient)
      .from('user_concept_states')
      .insert(values)
      .select('user_id,user_language_id,concept_id,status,state_version');
    if (inserted.error) ambiguous = true;
    else {
      const rows = inserted.data as readonly Record<string, unknown>[] | null;
      const valid = Array.isArray(rows) && rows.length === expected.length && expected.every(item => rows.some(row =>
        row.user_id === binding.actor.id && row.user_language_id === binding.profileId &&
        row.concept_id === item.conceptId && row.status === item.status && row.state_version === 1));
      if (!valid) throw new Error('inserted fixture proof mismatched');
    }
  } catch {
    ambiguous = true;
  }
  if (ambiguous) {
    await verifyK2FreshActorOwnership(config, binding.actor, admin);
    const after = await readK208CandidateBase(config, binding, admin);
    assertSameK208CandidateBaseline(baseline, after);
    if (after.stateConceptIds.length !== expected.length ||
        expected.some(row => !after.stateConceptIds.includes(row.conceptId)) ||
        !exactK208FixtureStateReadback(after, expected)) {
      throw new Error('K2 hosted acceptance fixture insert could not be proven after an ambiguous response.');
    }
  }
}

async function deriveK208CandidateInputProof(
  config: K2HostedConfig,
  admin: K2AdminClient,
  binding: K2K208ActorBinding,
  selection: K2K208CandidateSelection,
  baseline: K2HostedCandidateBaseProof,
): Promise<K2HostedCandidateInputProof> {
  const current = await readK208CandidateBase(config, binding, admin);
  assertSameK208CandidateBaseline(baseline, current);
  const expectedState = binding.handle === 'observer'
    ? [selection.weakConceptId, selection.forgottenConceptId]
    : binding.handle === 'scenario-c'
      ? [selection.weakConceptId]
      : [];
  if (new Set(current.stateConceptIds).size !== current.stateConceptIds.length ||
      current.stateConceptIds.length !== expectedState.length ||
      expectedState.some(id => !current.stateConceptIds.includes(id))) {
    throw new Error('K2 hosted acceptance candidate state was outside the fixed fixture binding.');
  }
  const statuses = new Map<string, 'weak' | 'forgotten'>();
  if (expectedState.length > 0) {
    await verifyK2FreshActorOwnership(config, binding.actor, admin);
    let result;
    try {
      result = await (admin as unknown as SupabaseClient)
        .from('v_learner_concept_retrievability')
        .select('user_language_id,concept_id,effective_status')
        .eq('user_id', binding.actor.id)
        .eq('user_language_id', binding.profileId)
        .in('concept_id', expectedState)
        .limit(3);
    } catch {
      throw new Error('K2 hosted acceptance exact fixture view proof failed closed.');
    }
    if (result.error || !Array.isArray(result.data) || result.data.length !== expectedState.length) {
      throw new Error('K2 hosted acceptance exact fixture view proof failed closed.');
    }
    for (const row of result.data as readonly Record<string, unknown>[]) {
      if (row.user_language_id !== binding.profileId || typeof row.concept_id !== 'string' ||
          !expectedState.includes(row.concept_id) ||
          (row.effective_status !== 'weak' && row.effective_status !== 'forgotten') ||
          statuses.has(row.concept_id)) {
        throw new Error('K2 hosted acceptance exact fixture view proof was not actor-bound.');
      }
      statuses.set(row.concept_id, row.effective_status);
    }
    if (expectedState.some(id => !statuses.has(id))) {
      throw new Error('K2 hosted acceptance exact fixture view proof was incomplete.');
    }
  }
  const candidateStatus = (row: K2K208CandidateRow): 'none' | 'weak' | 'forgotten' => {
    const effective = row.linkedConceptIds
      .map(id => statuses.get(id))
      .filter((value): value is 'weak' | 'forgotten' => value !== undefined);
    return effective.includes('forgotten') ? 'forgotten' : effective.includes('weak') ? 'weak' : 'none';
  };
  const selectedById = new Map([
    [selection.novel.contentId, 'novel' as const],
    [selection.weak.contentId, 'weak' as const],
    [selection.forgotten.contentId, 'forgotten' as const],
  ]);
  const baselineRoleOrder = current.candidates
    .map(row => selectedById.get(row.contentId))
    .filter((role): role is K2HostedCandidateRole => role !== undefined);
  const statusesByRole: Record<K2HostedCandidateRole, 'none' | 'weak' | 'forgotten'> = {
    novel: candidateStatus(selection.novel),
    weak: candidateStatus(selection.weak),
    forgotten: candidateStatus(selection.forgotten),
  };
  const expectedStatuses: Record<K2WaveActorHandle, Record<K2HostedCandidateRole, 'none' | 'weak' | 'forgotten'>> = {
    primary: { novel: 'none', weak: 'none', forgotten: 'none' },
    observer: { novel: 'none', weak: 'weak', forgotten: 'forgotten' },
    'scenario-c': { novel: 'none', weak: 'weak', forgotten: 'none' },
    'scenario-d': { novel: 'none', weak: 'none', forgotten: 'none' },
  };
  const selectedRows = [selection.novel, selection.weak, selection.forgotten];
  const knownFixtureConcepts = new Set(current.stateConceptIds);
  const allCompetitorsEligible = allK208CompetitorsEligibleForStates(current.candidates, knownFixtureConcepts) &&
    selectedRows.every(row => current.candidates.some(item => item.contentId === row.contentId));
  if (current.candidates.some(row => row.isSaved || row.isUnfinished || row.isCompleted) ||
      JSON.stringify(baselineRoleOrder) !== JSON.stringify(['novel', 'weak', 'forgotten']) ||
      Object.entries(expectedStatuses[binding.handle]).some(([role, status]) =>
        statusesByRole[role as K2HostedCandidateRole] !== status) || !allCompetitorsEligible) {
    throw new Error('K2 hosted acceptance actual candidate eligibility proof failed.');
  }
  return {
    baselineRoleOrder,
    effectiveStatus: statusesByRole,
    allCompetitorsEligible,
  };
}

async function verifyK208DueCandidateIsolation(
  config: K2HostedConfig,
  admin: K2AdminClient,
  bindings: readonly K2K208ActorBinding[],
  baselines: ReadonlyMap<K2WaveActorHandle, K2HostedCandidateBaseProof>,
  selections: ReadonlyMap<K2WaveActorHandle, K2K208CandidateSelection>,
  savedConceptIds: ReadonlyMap<K2WaveActorHandle, ReadonlySet<string>>,
): Promise<void> {
  for (const binding of bindings) {
    const base = baselines.get(binding.handle);
    const selection = selections.get(binding.handle);
    if (!base || !selection) throw new Error('K2 hosted acceptance candidate binding was incomplete.');
    const current = await readK208CandidateBase(config, binding, admin);
    assertSameK208CandidateBaseline(base, current);
    if (current.stateConceptIds.length !== 0) {
      throw new Error('K2 hosted acceptance due setup created candidate-linked learner state.');
    }
    const due = savedConceptIds.get(binding.handle) ?? new Set<string>();
    const expectedCount = binding.handle === 'primary' || binding.handle === 'observer' ? 20 : 0;
    if (due.size !== expectedCount) {
      throw new Error('K2 hosted acceptance due setup did not prove the exact actor-bound backlog.');
    }
    if (expectedCount === 20) {
      const membership = await runK2HostedProbe(
        'k208_due_candidate_overlap', config.readonlyDatabaseUrl, binding.actor.id,
        binding.profileId, [...due],
      );
      if (!('overlapCount' in membership) || membership.overlapCount !== 0) {
        throw new Error('K2 hosted acceptance due concepts overlapped the eligible Reader mapping graph.');
      }
    }
    const candidateConcepts = new Set([
      ...selection.novel.linkedConceptIds,
      ...selection.weak.linkedConceptIds,
      ...selection.forgotten.linkedConceptIds,
    ]);
    if ([...due].some(id => candidateConcepts.has(id))) {
      throw new Error('K2 hosted acceptance due concepts overlap published candidate mappings.');
    }
  }
}

async function anchorMaterial(config: K2HostedConfig): Promise<K2HostedAnchorMaterial> {
  const result = await runK2HostedProbe('anchor_material', config.readonlyDatabaseUrl);
  if (!('hasTranslatedDefinition' in result)) {
    throw new Error('K2 hosted acceptance canonical material proof was invalid.');
  }
  return result;
}

async function verifyActorGone(config: K2HostedConfig, actorId: string): Promise<void> {
  const result = await runK2HostedProbe('actor_absent', config.readonlyDatabaseUrl, actorId);
  if (!('tables' in result) || result.totalRows !== 0) {
    throw new Error('K2 hosted acceptance cleanup left actor-owned learner rows.');
  }
}

async function verifyK209OwnershipGraph(config: K2HostedConfig): Promise<void> {
  const result = await runK2HostedProbe('actor_ownership_graph', config.readonlyDatabaseUrl);
  if (!('ownershipGraphValid' in result) || result.ownershipGraphValid !== true ||
      result.ownedTableCount !== 27 || result.ownershipEdgeCount !== 27 ||
      result.incomingConstraintCount !== 51) {
    throw new Error('K2 hosted acceptance actor ownership graph proof failed closed.');
  }
}

/** Current-run recovery can close a receipt only after Auth cleanup and FK-cascade proof. */
export async function cleanupK209FixtureAfterCurrentRun(config: K2HostedConfig): Promise<void> {
  await verifyK209OwnershipGraph(config);
  await cleanupK2HostedFixtureWithRecovery(config);
  // cleanupK2RunActors exhaustively lists and removes only this run's marked or
  // recoverable identities, verifying every known actor's 27-table snapshot.
  // The exact 27-owner/51-inbound-FK graph above proves an absent Auth identity
  // cannot leave actor-owned rows behind when a process crashed after cascade.
  await verifyK209OwnershipGraph(config);
}

export function k209ExpectedActorAbsenceIds(
  actorIds: readonly string[],
  freshIdentityIds: readonly string[],
): readonly string[] {
  return Object.freeze([...new Set([...actorIds, ...freshIdentityIds])]);
}

/** Keeps the exact current-run actor set behind both sides of fixture cleanup. */
export async function cleanupK209FixtureAfterActorProofs(
  expectedActorIds: readonly string[],
  verifyBefore: (actorIds: readonly string[]) => Promise<void>,
  cleanupFixture: () => Promise<void>,
  verifyAfter: (actorIds: readonly string[]) => Promise<void>,
): Promise<void> {
  const actorIds = Object.freeze([...expectedActorIds]);
  if (actorIds.length === 0 || actorIds.some(actorId => !actorId.trim()) ||
      new Set(actorIds).size !== actorIds.length) {
    throw new Error('K2 hosted acceptance expected actor absence set was invalid.');
  }
  await verifyBefore(actorIds);
  await cleanupFixture();
  await verifyAfter(actorIds);
}

async function verifyK209ActorAbsence(
  config: K2HostedConfig,
  admin: K2AdminClient,
  actorIds: readonly string[],
): Promise<void> {
  const uniqueIds = [...new Set(actorIds)];
  if (uniqueIds.length === 0) {
    throw new Error('K2 hosted acceptance expected actor absence set was empty.');
  }
  for (const actorId of uniqueIds) {
    await assertK2HostedAuthAbsent(admin, actorId);
    await verifyActorGone(config, actorId);
  }
}

function isK209ReceiptState(
  value: unknown,
  expected: K2HostedFixtureControlResult['receiptState'],
): value is K2HostedFixtureControlResult {
  return !!value && typeof value === 'object' &&
    'receiptState' in value && value.receiptState === expected &&
    'fixturePresent' in value && value.fixturePresent === (expected === 'ACTIVE');
}

export async function createLearnerProfile(
  config: K2HostedConfig,
  session: K2AuthenticatedActor,
  strictFreshContract = false,
): Promise<string> {
  const meResponse = await requestK2HostedApi(config, session.accessToken, '/v1/me');
  const me = strictFreshContract
    ? validateContract('MeResponse', meResponse.payload).data as unknown as JsonObject
    : dataObject(meResponse.payload,
      'K2 hosted acceptance application identity bootstrap was invalid.');
  if (me.id !== session.userId) {
    throw new Error('K2 hosted acceptance application identity did not match the confirmed Auth actor.');
  }
  if (strictFreshContract &&
      (!Array.isArray(me.languageProfiles) || me.languageProfiles.length !== 0)) {
    throw new Error('K2 hosted acceptance fresh application identity returned an unexpected language profile.');
  }
  const learnerProfileEtag = meResponse.response.headers.get('etag');
  if (!learnerProfileEtag) {
    throw new Error('K2 hosted acceptance learner profile ETag was missing.');
  }
  if (me.timeZone !== 'Asia/Ho_Chi_Minh') {
    const timezoneResponse = await requestK2HostedApi(config, session.accessToken, '/v1/me', {
      method: 'PATCH',
      ifMatch: learnerProfileEtag,
      body: { timeZone: 'Asia/Ho_Chi_Minh' },
    }, [200]);
    const updatedMe = strictFreshContract
      ? validateContract('MeResponse', timezoneResponse.payload).data as unknown as JsonObject
      : dataObject(timezoneResponse.payload,
        'K2 hosted acceptance timezone update response was invalid.');
    if (updatedMe.id !== session.userId || updatedMe.timeZone !== 'Asia/Ho_Chi_Minh' ||
        !timezoneResponse.response.headers.get('etag')) {
      throw new Error('K2 hosted acceptance learner timezone was not persisted.');
    }
    if (strictFreshContract &&
        (!Array.isArray(updatedMe.languageProfiles) || updatedMe.languageProfiles.length !== 0)) {
      throw new Error('K2 hosted acceptance timezone bootstrap returned an unexpected language profile.');
    }
  }
  const existing = parseK2LanguageProfileList(
    (await requestK2HostedApi(config, session.accessToken, '/v1/me/languages')).payload,
  );
  if (existing.length !== 0) throw new Error('K2 hosted acceptance fresh actor already has learning profiles.');
  const created = await requestK2HostedApi(config, session.accessToken, '/v1/me/languages', {
    method: 'POST',
    idempotencyKey: randomUUID(),
    body: { targetLanguageCode: 'en', nativeLanguageCode: 'vi', goal: 'communication', dailyMinutes: 15 },
  }, [201]);
  if (strictFreshContract) {
    const listedAfterCreate = await requestK2HostedApi(config, session.accessToken, '/v1/me/languages');
    const id = assertK2CreatedLanguageProfileReadback(created.payload, listedAfterCreate.payload);
    const profile = dataObject(created.payload,
      'K2 hosted acceptance language profile response was invalid.');
    if (profile.targetLanguageCode !== 'en' || profile.nativeLanguageCode !== 'vi' ||
        profile.goal !== 'communication' || profile.dailyMinutes !== 15 ||
        profile.targetLevel !== null || profile.startingLevelEstimate !== null || profile.status !== 'active') {
      throw new Error('K2 hosted acceptance fresh language profile DTO did not match the fixed onboarding request.');
    }
    return id;
  }
  const profile = dataObject(created.payload, 'K2 hosted acceptance language profile response was invalid.');
  if (typeof profile.id !== 'string') throw new Error('K2 hosted acceptance language profile response was invalid.');
  return profile.id;
}

export interface K2ProtectedAuthUiResponse {
  status(): number;
  json(): Promise<unknown>;
}

export interface K2ProtectedAuthUiInteractions {
  fillEmail(value: string): Promise<void>;
  fillPassword(value: string): Promise<void>;
  clickSubmit(): Promise<void>;
  waitForSignInResponse(): Promise<K2ProtectedAuthUiResponse>;
  waitForDestination(): Promise<void>;
}

const K2_AUTH_UI_SIGN_IN_FAILURE =
  'K2 hosted acceptance browser sign-in failed; sensitive browser details were suppressed.';

export async function runK2ProtectedAuthUiSignIn(
  actor: Pick<K2HostedActor, 'email' | 'password' | 'id'>,
  interactions: K2ProtectedAuthUiInteractions,
): Promise<void> {
  // Attach a rejection handler as soon as the response wait is created. A
  // credential fill can fail before this promise is awaited, but its later
  // timeout/error must not become an unhandled rejection.
  let signInResponse: Promise<K2ProtectedAuthUiResponse | null>;
  try {
    signInResponse = interactions.waitForSignInResponse()
      .then(response => response, () => null);
  } catch {
    throw new Error(K2_AUTH_UI_SIGN_IN_FAILURE);
  }

  try {
    await interactions.fillEmail(actor.email);
    await interactions.fillPassword(actor.password);
    await interactions.clickSubmit();

    const response = await signInResponse;
    if (!response || response.status() !== 200) {
      throw new Error('K2 hosted acceptance browser sign-in failed.');
    }

    const result = await response.json();
    const user = object(result, 'K2 hosted acceptance browser sign-in response was invalid.').user;
    if (!user || typeof user !== 'object' || (user as JsonObject).id !== actor.id) {
      throw new Error('K2 hosted acceptance browser sign-in identity did not match the confirmed actor.');
    }

    await interactions.waitForDestination();
  } catch {
    // Playwright errors can include fill values, request details, or the
    // destination URL. Never attach the original error or its cause.
    throw new Error(K2_AUTH_UI_SIGN_IN_FAILURE);
  }
}

async function verifyAuthUiSignIn(page: Page, actor: K2HostedActor, vercelOrigin: string, config: K2HostedConfig): Promise<void> {
  const pageResponse = await page.goto(new URL('/auth', vercelOrigin).href, { waitUntil: 'domcontentloaded' });
  if (!pageResponse || pageResponse.status() !== 200) {
    throw new Error('K2 hosted acceptance protected sign-in page did not load.');
  }
  const emailInput = page.locator('#auth-email');
  const passwordInput = page.locator('#auth-password');
  const submitButton = page.locator('button[type="submit"]', { hasText: 'Đăng nhập' });
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
  await runK2ProtectedAuthUiSignIn(actor, {
    fillEmail: value => emailInput.fill(value),
    fillPassword: value => passwordInput.fill(value),
    clickSubmit: () => submitButton.click(),
    waitForSignInResponse: () => page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === config.supabaseUrl && url.pathname === '/auth/v1/token' &&
        url.searchParams.get('grant_type') === 'password';
    }, { timeout: 30_000 }),
    waitForDestination: () => page.waitForURL(
      url => ['/onboarding', '/today'].includes(url.pathname),
      { timeout: 30_000 },
    ),
  });
}

const K2_K210_INITIAL_SIGN_IN_FAILURE =
  'K2 hosted acceptance K2-10 isolated browser sign-in failed; sensitive details were suppressed.';

/** Signs in K2-10 through a short-lived same-context controller without navigating the product page. */
export async function signInInitialK210Actor(
  primaryPage: Page,
  browserContext: BrowserContext,
  actor: Pick<K2HostedActor, 'id' | 'email' | 'password'>,
  supabaseUrl: string,
  publishableKey: string,
  vercelOrigin: string,
  signInController: typeof signInK2BrowserActor = signInK2BrowserActor,
): Promise<string> {
  try {
    if (primaryPage.url() !== 'about:blank') throw new Error('unexpected initial page');
  } catch {
    throw new Error(K2_K210_INITIAL_SIGN_IN_FAILURE);
  }

  let controllerPage: Page;
  try {
    controllerPage = await browserContext.newPage();
  } catch {
    throw new Error(K2_K210_INITIAL_SIGN_IN_FAILURE);
  }

  let accessToken: string | undefined;
  let failed = false;
  try {
    accessToken = await signInController(
      controllerPage, actor, supabaseUrl, publishableKey, vercelOrigin,
    );
  } catch {
    failed = true;
  }
  try {
    await controllerPage.close();
  } catch {
    failed = true;
  }
  try {
    if (primaryPage.url() !== 'about:blank') failed = true;
  } catch {
    failed = true;
  }

  if (failed || typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error(K2_K210_INITIAL_SIGN_IN_FAILURE);
  }
  return accessToken;
}

function createK2HostedFrllUi(
  vercelOrigin: string,
  todayDiagnostic?: ReturnType<typeof createK2FrllTodayDiagnostic>,
): K2HostedFrllUi {
  const goto = async (page: Page, path: string) => {
    const routeId = path === '/dictionary' ? 'dictionary' : path === '/today' ? 'today' : 'other';
    let response: Awaited<ReturnType<Page['goto']>>;
    try {
      response = await page.goto(new URL(path, vercelOrigin).href, { waitUntil: 'domcontentloaded' });
    } catch {
      throw new Error(
        `K2 hosted acceptance FRLL browser page did not load (route=${routeId}; status=no_response).`,
      );
    }
    if (!response || response.status() !== 200) {
      const status = response?.status();
      const statusClass = status === undefined ? 'no_response'
        : status >= 200 && status < 300 ? '2xx'
          : status >= 300 && status < 400 ? '3xx'
            : status >= 400 && status < 500 ? '4xx'
              : status >= 500 && status < 600 ? '5xx' : 'other';
      throw new Error(
        `K2 hosted acceptance FRLL browser page did not load (route=${routeId}; status=${statusClass}).`,
      );
    }
  };
  const waitForAnswerResponse = (page: Page) => page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === vercelOrigin &&
      /^\/api\/v1\/review\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/answer$/i.test(url.pathname);
  }, { timeout: 30_000 });
  return {
    async searchAnchor(page) {
      await goto(page, '/dictionary');
      const search = page.locator('input[type="search"]');
      await search.waitFor({ state: 'visible', timeout: 30_000 });
      await search.fill(FRLL_ANCHOR_LEMMA);
      await page.locator('h2', { hasText: FRLL_ANCHOR_LEMMA })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async saveAnchor(page) {
      await page.getByRole('button', {
        name: `Lưu từ ${FRLL_ANCHOR_LEMMA} để học`, exact: true,
      }).click();
      await page.locator(`span[aria-label="Đã lưu từ ${FRLL_ANCHOR_LEMMA} vào kho học"]`)
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async openToday(page) {
      todayDiagnostic?.begin(page);
      let phase: 'navigation' | 'heading' = 'navigation';
      try {
        const response = await page.goto(new URL('/today', vercelOrigin).href, { waitUntil: 'domcontentloaded' });
        if (response) {
          let routeClass: K2FrllNavigationRoute = 'other';
          let originBound = false;
          try {
            const finalUrl = new URL(response.url());
            originBound = finalUrl.origin === vercelOrigin;
            routeClass = finalUrl.pathname === '/today' ? 'today'
              : finalUrl.pathname === '/auth' ? 'auth'
                : finalUrl.pathname === '/onboarding' ? 'onboarding' : 'other';
          } catch {
            routeClass = 'other';
          }
          todayDiagnostic?.recordNavigation(page, routeClass, k2FrllDiagnosticStatus(response.status()), originBound);
        } else {
          todayDiagnostic?.recordNavigation(page, 'none', 'none', false);
        }
        if (!response || response.status() !== 200) {
          throw new Error('K2 hosted acceptance FRLL browser page did not load.');
        }
        phase = 'heading';
        await page.locator('h3', { hasText: 'Ôn tập đến hạn' })
          .waitFor({ state: 'visible', timeout: 30_000 });
        todayDiagnostic?.recordHeading(page, 'visible');
      } catch {
        todayDiagnostic?.recordHeading(page, phase === 'heading' ? 'wait_failed' : 'navigation_failed');
        const details = todayDiagnostic?.summary(page);
        throw new Error(details
          ? `K2 hosted acceptance FRLL Today UI did not become visible; ${details}.`
          : 'K2 hosted acceptance FRLL Today UI did not become visible.');
      } finally {
        todayDiagnostic?.end(page);
      }
    },
    async openPassiveToday(page) {
      await goto(page, '/today');
      await page.getByRole('heading', { name: 'Không có bài học nào cần ôn hôm nay' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async openReview(page) {
      await goto(page, '/review');
      await page.getByRole('heading', { name: FRLL_ANCHOR_LEMMA })
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByRole('button', { name: 'Hiện đáp án & nghĩa' }).click();
      await page.getByRole('button', { name: 'Tốt (Good)' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async submitGood(page) {
      const response = waitForAnswerResponse(page);
      await page.getByRole('button', { name: 'Tốt (Good)' }).click();
      return response;
    },
    async submitGoodAndWaitForRetry(page) {
      await page.getByRole('button', { name: 'Tốt (Good)' }).click();
      await page.getByText('Lỗi gửi kết quả ôn tập', { exact: false })
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByRole('button', { name: 'Thử lại' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async reloadForRetry(page) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('Lỗi gửi kết quả ôn tập', { exact: false })
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByRole('button', { name: 'Thử lại' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async retryAnswer(page) {
      const response = waitForAnswerResponse(page);
      await page.getByRole('button', { name: 'Thử lại' }).click();
      return response;
    },
    async waitForReviewComplete(page) {
      await page.getByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!', { exact: true })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async openBrain(page) {
      await goto(page, '/brain');
      await page.locator('h1', { hasText: 'Language Brain của bạn' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async selectAnchorInBrain(page) {
      const node = page.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA });
      await node.waitFor({ state: 'visible', timeout: 30_000 });
      const response = page.waitForResponse(result => {
        const url = new URL(result.url());
        return url.origin === vercelOrigin &&
          url.pathname === `/api/v1/brain/concepts/${WAVE_CANONICAL_CONCEPT_ID}`;
      }, { timeout: 30_000 });
      await node.click();
      const result = await response;
      if (result.status() !== 200) {
        throw new Error('K2 hosted acceptance Brain detail request failed.');
      }
      await page.getByRole('dialog', { name: 'Chi tiết khái niệm' })
        .waitFor({ state: 'visible', timeout: 30_000 });
      return result;
    },
    async waitForBrainAnchor(page) {
      await page.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async clickBrainAnchor(page) {
      await page.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA }).click();
    },
    async waitForEmptyBrain(page) {
      await page.getByRole('heading', { name: 'Chưa có từ vựng trong Brain' })
        .waitFor({ state: 'visible', timeout: 30_000 });
    },
    async assertNoBrainDetail(page) {
      await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5_000 });
      await page.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA })
        .waitFor({ state: 'hidden', timeout: 5_000 });
    },
  };
}

/**
 * Shared harness lifecycle for K2-07 and the bounded K2-08 due-only subcase. Plugins own only their
 * wave fixtures and assertions; target attestation, two disposable actors,
 * read-only snapshots, normal sign-in, strict janitor, and cleanup are shared.
 */
export async function runK2HostedWave(
  config: K2HostedConfig,
  page: Page,
  browserContext: BrowserContext,
  testInfo: TestInfo,
  plugin: K2HostedWavePlugin,
): Promise<void> {
  const adminClient = createK2AdminClient(config);
  const admin = adminClient as unknown as K2AdminClient;
  const actors: K2HostedActor[] = [];
  const freshActorIdentities: K2FreshActorIdentity[] = [];
  const learnerClients: ReturnType<typeof createK2LearnerClient>[] = [];
  const sessions: K2AuthenticatedActor[] = [];
  let retainedBaseline: K2RetainedSnapshot | null = null;
  let k209SetupAttempted = false;
  let k209Fixture: K2HostedFixtureDto | null = null;
  let cleanupError = false;
  let actorCleanupPassed = false;
  let freshIdentityCleanupPassed = true;
  let retainedComparisonPassed = false;
  const frllWave = plugin.waveId === 'K2-10';
  const frllTodayDiagnostic = frllWave ? createK2FrllTodayDiagnostic() : undefined;
  const frllReplayController = frllWave ? createK2FrllReplayController() : null;
  const frllAuthBindingBarrier: K2FrllAuthBindingBarrier | undefined = frllWave
    ? createK2FrllAuthBindingBarrier(15_000)
    : undefined;
  const browserFrllSessions = new Map<string, K2FrllActorSession>();
  const frllPages: Page[] = [];
  let frllHeldBrainGate: K2FrllHeldBrainResponseGate | null = null;
  const frllCleanup: { releaseHeldBrain?: () => void } = {};
  const checkpoint = (phase: K2HostedPhase, event: K2HostedCheckpointEvent) =>
    markK2HostedCheckpoint(testInfo, phase, event);

  try {
    if (config.supabaseProjectRef !== K2_HOSTED_STAGING_SUPABASE_REF) {
      throw new Error('K2 hosted acceptance refused a non-staging Supabase project.');
    }
    checkpoint('preflight_master_sha', 'start');
    await verifyK2HostedCurrentMasterSha(config);
    checkpoint('preflight_master_sha', 'pass');
    checkpoint('preflight_deployment_attestation', 'start');
    const immutableVercelOrigin = await verifyK2HostedDeploymentAttestations(config);
    checkpoint('preflight_deployment_attestation', 'pass');
    checkpoint('preflight_oidc_token', 'start');
    const oidc = await createGithubTrustedSourceToken(config);
    checkpoint('preflight_oidc_token', 'pass');
    checkpoint('preflight_protected_origin', 'start');
    const vercelOrigin = await verifyProtectedVercelOrigin(
      immutableVercelOrigin,
      oidc,
      config.githubSha,
    );
    checkpoint('preflight_protected_origin', 'pass');
    checkpoint('preflight_api_health', 'start');
    await verifyK2StagingApiHealth(config.apiOrigin, config.githubSha);
    checkpoint('preflight_api_health', 'pass');
    checkpoint('preflight_migration_probe', 'start');
    const migration = await runK2HostedProbe('migrations', config.readonlyDatabaseUrl);
    if (!('appMigrationHead' in migration) || migration.appMigrationHead !== K2_APPROVED_APP_MIGRATION_HEAD) {
      throw new Error('K2 hosted acceptance staging migration head is not approved.');
    }
    checkpoint('preflight_migration_probe', 'pass');

    if (plugin.waveId === 'K2-09') {
      checkpoint('preflight_k209_ownership_graph', 'start');
      await verifyK209OwnershipGraph(config);
      checkpoint('preflight_k209_ownership_graph', 'pass');
      checkpoint('preflight_k209_fixture_inspect', 'start');
      const fixtureOidc = await createK2HostedFixtureOidcToken(config);
      const fixtureState = await requestK2HostedFixtureControl(
        config, 'inspect', fixtureOidc, config.githubToken,
      );
      if (!isK209ReceiptState(fixtureState, 'ABSENT') || fixtureState.fixture !== null ||
          Object.values(fixtureState.counts).some(count => count !== 0)) {
        throw new Error('K2 hosted acceptance K2-09 fixture preflight was not exactly ABSENT.');
      }
      checkpoint('preflight_k209_fixture_inspect', 'pass');
    }

    if (plugin.waveId === 'K2-08') {
      checkpoint('preflight_k208_fixture_capability', 'start');
      const capability = await runK2HostedProbe('k208_fixture_privilege_preflight', config.readonlyDatabaseUrl);
      if (!('fixtureCapabilityReady' in capability) || capability.fixtureCapabilityReady !== true ||
          Object.values(capability).some(value => value !== true)) {
        throw new Error('K2 hosted acceptance fixture privilege preflight failed closed.');
      }
      checkpoint('preflight_k208_fixture_capability', 'pass');
      checkpoint('preflight_k208_empty_head', 'start');
      await verifyK2FixtureZeroRowHead(adminClient);
      checkpoint('preflight_k208_empty_head', 'pass');
      checkpoint('preflight_k208_catalog', 'start');
      const catalog = await runK2HostedProbe('k208_catalog_preflight', config.readonlyDatabaseUrl);
      if (!('eligibleContentCount' in catalog) || catalog.eligibleContentCount < 3 ||
          catalog.fiveMinuteRemediationCount < 2 || catalog.hasNovelControl !== true ||
          catalog.sourceRankShapeAvailable !== true) {
        throw new Error('K2 hosted acceptance has no complete published K2-08 content competitor set.');
      }
      checkpoint('preflight_k208_catalog', 'pass');
    }

    checkpoint('prior_expired_actor_cleanup', 'start');
    const expired = await reapExpiredK2Actors(config, admin, Date.now(),
      actorId => verifyActorGone(config, actorId),
      { allowSameRunUnmarked: config });
    checkpoint('prior_expired_actor_cleanup', 'pass');
    testInfo.annotations.push({ type: 'expired-actors-reaped', description: String(expired) });
    checkpoint('prior_interrupted_actor_cleanup', 'start');
    const priorAttemptActors = await cleanupK2RunActors(config, admin,
      actorId => verifyActorGone(config, actorId));
    checkpoint('prior_interrupted_actor_cleanup', 'pass');
    testInfo.annotations.push({ type: 'interrupted-run-actors-cleaned', description: String(priorAttemptActors) });
    checkpoint('prior_actor_absence_check', 'start');
    await assertNoK2ActorsRemain(config, admin);
    checkpoint('prior_actor_absence_check', 'pass');
    checkpoint('retained_baseline_snapshot', 'start');
    retainedBaseline = await runK2HostedProbe('retained_snapshot', config.readonlyDatabaseUrl) as K2RetainedSnapshot;
    checkpoint('retained_baseline_snapshot', 'pass');

    checkpoint('preflight_master_sha', 'start');
    await verifyK2HostedCurrentMasterSha(config);
    checkpoint('preflight_master_sha', 'pass');
    const actorCreatePhases = [
      'primary_actor_create', 'observer_actor_create', 'scenario_c_actor_create', 'scenario_d_actor_create',
    ] as const;
    const actorAuthPhases = [
      'primary_actor_authentication', 'observer_actor_authentication',
      'scenario_c_actor_authentication', 'scenario_d_actor_authentication',
    ] as const;
    for (let index = 0; index < plugin.actorCount; index += 1) {
      checkpoint(actorCreatePhases[index], 'start');
      const actor = await createK2HostedActor(config, admin,
        identity => freshActorIdentities.push(identity));
      actors.push(actor);
      checkpoint(actorCreatePhases[index], 'pass');
    }
    for (let index = 0; index < actors.length; index += 1) {
      checkpoint(actorAuthPhases[index], 'start');
      const learner = createK2LearnerClient(config);
      learnerClients.push(learner);
      sessions.push(await authenticateK2HostedActor(actors[index], config, learner));
      checkpoint(actorAuthPhases[index], 'pass');
    }

    const profileBootstrapPhases = [
      'primary_profile_bootstrap', 'observer_profile_bootstrap',
      'scenario_c_profile_bootstrap', 'scenario_d_profile_bootstrap',
    ] as const;
    const prebootstrapPhases = [
      'primary_prebootstrap_snapshot', 'observer_prebootstrap_snapshot',
      'scenario_c_prebootstrap_snapshot', 'scenario_d_prebootstrap_snapshot',
    ] as const;
    const postbootstrapPhases = [
      'primary_postbootstrap_snapshot', 'observer_postbootstrap_snapshot',
      'scenario_c_postbootstrap_snapshot', 'scenario_d_postbootstrap_snapshot',
    ] as const;
    const profileIds: string[] = [];
    const actorHandles = WAVE_ACTOR_HANDLES.slice(0, actors.length);
    if (frllWave) {
      const tableNames = k2RetainedTableNames();
      for (let index = 0; index < actors.length; index += 1) {
        checkpoint(prebootstrapPhases[index], 'start');
        const fresh = await actorSnapshot(config, actors[index].id);
        if (fresh.totalRows !== 0 || tableNames.some(table => fresh.tables[table].rows !== 0)) {
          throw new Error('K2 hosted acceptance K2-10 pre-bootstrap actor snapshot was not zero across 27 tables.');
        }
        checkpoint(prebootstrapPhases[index], 'pass');
      }
      for (let index = 0; index < actors.length; index += 1) {
        checkpoint(profileBootstrapPhases[index], 'start');
        profileIds.push(await createLearnerProfile(config, sessions[index], true));
        checkpoint(profileBootstrapPhases[index], 'pass');
        checkpoint(postbootstrapPhases[index], 'start');
        const bootstrapped = await actorSnapshot(config, actors[index].id);
        assertK210FreshProfileBootstrapSnapshot(bootstrapped);
        checkpoint(postbootstrapPhases[index], 'pass');
      }
    }

    checkpoint('browser_oidc_token', 'start');
    const browserOidc = await createGithubTrustedSourceToken(config);
    checkpoint('browser_oidc_token', 'pass');
    checkpoint('browser_protected_origin', 'start');
    const reverifiedBrowserOrigin = await verifyProtectedVercelOrigin(
      immutableVercelOrigin,
      browserOidc,
      config.githubSha,
    );
    checkpoint('browser_protected_origin', 'pass');
    if (reverifiedBrowserOrigin !== vercelOrigin) {
      throw new Error('K2 hosted acceptance canonical browser origin changed; browser flow was stopped.');
    }
    const browserTokenSource = frllWave
      ? createK2TrustedSourceTokenSupplier(
        browserOidc,
        () => createGithubTrustedSourceToken(config),
      )
      : browserOidc;
    let activeBrowserHandle: K2WaveActorHandle | null = null;
    const signInAs = async (handle: K2WaveActorHandle): Promise<void> => {
      if (activeBrowserHandle === handle) return;
      if (activeBrowserHandle !== null) {
        throw new Error('K2 hosted acceptance actor transition requires the approved same-context switch seam.');
      }
      const index = actorHandles.indexOf(handle);
      const actor = actors[index];
      if (!actor || index < 0) throw new Error('K2 hosted acceptance actor handle was invalid.');
      const binding = frllAuthBindingBarrier?.begin();
      try {
        let browserToken: string | undefined;
        if (plugin.waveId === 'K2-10') {
          if (!binding) throw new Error('K2 hosted acceptance K2-10 Auth binding guard was unavailable.');
          browserToken = await signInInitialK210Actor(
            page, browserContext, actor, config.supabaseUrl, config.publishableKey, vercelOrigin,
          );
        } else {
          await verifyAuthUiSignIn(page, actor, vercelOrigin, config);
        }
        if (frllWave) {
          if (!binding || !browserToken) {
            throw new Error('K2 hosted acceptance K2-10 initial actor binding was incomplete.');
          }
          const profileId = profileIds[index];
          if (!profileId) throw new Error('K2 hosted acceptance K2-10 actor profile binding was incomplete.');
          browserFrllSessions.set(browserToken, {
            accessToken: browserToken, userId: actor.id, profileId,
          });
          if (!binding.complete()) {
            browserFrllSessions.delete(browserToken);
            throw new Error('K2 hosted acceptance K2-10 Auth binding exceeded its safety bound.');
          }
        }
        activeBrowserHandle = handle;
      } finally {
        binding?.release();
      }
    };
    checkpoint('browser_request_guard', 'start');
    if (frllWave) {
      sessions.forEach((session, index) => {
        const profileId = profileIds[index];
        if (!profileId) throw new Error('K2 hosted acceptance K2-10 actor profile binding was incomplete.');
        browserFrllSessions.set(session.accessToken, {
          accessToken: session.accessToken,
          userId: session.userId,
          profileId,
        });
      });
    }
    const directFrllRequest = async (request: K2FrllBrowserRequest): Promise<Response> => {
      let response: Response;
      try {
        response = await fetch(new URL(request.route, config.apiOrigin), {
          method: request.method,
          headers: request.headers,
          ...(request.body ? { body: request.body.toString('utf8') } : {}),
          signal: AbortSignal.timeout(30_000),
          redirect: 'manual',
          credentials: 'omit',
        });
      } catch {
        throw new Error('K2 hosted acceptance direct Render request failed; provider details were suppressed.');
      }
      const gate = frllHeldBrainGate;
      // request.actor is resolved from the original Bearer in the verified session map,
      // so an in-flight Actor A response stays Actor A after the UI switches to B.
      if (gate?.tryHold(request, response)) await gate.waitUntilReleased();
      return response;
    };
    await installK2BrowserRequestGuard(browserContext, {
      vercelOrigin,
      supabaseUrl: config.supabaseUrl,
    }, browserTokenSource, frllWave ? route => forwardK2FrllBrowserRequest(
      route,
      { vercelOrigin, githubSha: config.githubSha },
      browserFrllSessions,
      directFrllRequest,
      frllReplayController ?? undefined,
      frllAuthBindingBarrier,
      event => {
        const requestPage = route.request().frame().page();
        frllTodayDiagnostic?.recordApi(requestPage, event);
      },
    ) : undefined);
    checkpoint('browser_request_guard', 'pass');
    checkpoint('browser_sign_in', 'start');
    await signInAs(actorHandles[0]);
    checkpoint('browser_sign_in', 'pass');

    if (!frllWave) {
      for (let index = 0; index < actors.length; index += 1) {
        checkpoint(profileBootstrapPhases[index], 'start');
        profileIds.push(await createLearnerProfile(config, sessions[index]));
        checkpoint(profileBootstrapPhases[index], 'pass');
      }
    }

    if (plugin.waveId === 'K2-09') {
      checkpoint('fixture_k209_setup', 'start');
      k209SetupAttempted = true;
      k209Fixture = await setupK2HostedFixtureWithRecovery(config);
      checkpoint('fixture_k209_setup', 'pass');
    }

    const wavePhase = k2HostedWaveCheckpoint(plugin.waveId);
    checkpoint(wavePhase, 'start');
    const actorIdByHandle = new Map<K2WaveActorHandle, string>();
    const profileIdByHandle: Partial<Record<K2WaveActorHandle, string>> = {};
    const sessionByHandle = new Map<K2WaveActorHandle, K2AuthenticatedActor>();
    for (let index = 0; index < actorHandles.length; index += 1) {
      const handle = actorHandles[index];
      actorIdByHandle.set(handle, actors[index].id);
      profileIdByHandle[handle] = profileIds[index];
      sessionByHandle.set(handle, sessions[index]);
    }
    const opaqueIds = createK2OpaqueIdProjector();
    opaqueIds.bind(WAVE_CANONICAL_CONCEPT_HANDLE, WAVE_CANONICAL_CONCEPT_ID);
    if (k209Fixture) {
      opaqueIds.bind('k2-09-owner', k209Fixture.ids.ownerConceptId);
      opaqueIds.bind('k2-09-secondary', k209Fixture.ids.secondaryConceptId);
      opaqueIds.bind('k2-09-lexeme', k209Fixture.ids.lexemeId);
    }
    const savedConceptIds = new Map<K2WaveActorHandle, Set<string>>(
      actorHandles.map(handle => [handle, new Set<string>()]),
    );
    const apiByHandle = new Map<K2WaveActorHandle, K2BoundWaveApi>();
    for (const handle of actorHandles) {
      const session = sessionByHandle.get(handle);
      if (!session) throw new Error('K2 hosted acceptance actor session binding was incomplete.');
      apiByHandle.set(handle, createBoundWaveApi(
        config, session, handle, profileIdByHandle, opaqueIds,
        (savedActor, conceptId) => savedConceptIds.get(savedActor)?.add(conceptId),
        k209Fixture ?? undefined,
      ));
    }
    const primaryHandle = actorHandles[0];
    const observerHandle = actorHandles[1];
    const scenarioCHandle = actorHandles[2];
    const scenarioDHandle = actorHandles[3];
    const primaryApi = apiByHandle.get(primaryHandle);
    const observerApi = apiByHandle.get(observerHandle);
    if (!primaryApi || !observerApi) throw new Error('K2 hosted acceptance actor API binding was incomplete.');
    let frllHarness: K2HostedFrllHarness | undefined;
    if (frllWave) {
      const frllUi = createK2HostedFrllUi(vercelOrigin, frllTodayDiagnostic);
      const requireFrllSession = (handle: K2WaveActorHandle) => {
        const session = sessionByHandle.get(handle);
        const profileId = profileIdByHandle[handle];
        if (!session || !profileId) {
          throw new Error('K2 hosted acceptance FRLL actor session binding was incomplete.');
        }
        return { session, profileId };
      };
      const switchToActor = async (handle: K2WaveActorHandle, targetPage: Page): Promise<void> => {
        if (!frllWave || !actorHandles.includes(handle)) {
          throw new Error('K2 hosted acceptance same-context actor switch was not allowlisted.');
        }
        if (activeBrowserHandle === handle) return;
        if (activeBrowserHandle === null) {
          throw new Error('K2 hosted acceptance same-context actor switch had no originating actor.');
        }
        const index = actorHandles.indexOf(handle);
        const actor = actors[index];
        if (!actor) throw new Error('K2 hosted acceptance actor handle was invalid.');
        const binding = frllAuthBindingBarrier?.begin();
        if (!binding) throw new Error('K2 hosted acceptance K2-10 Auth binding guard was unavailable.');
        try {
          const browserToken = await signInK2BrowserActor(
            targetPage, actor, config.supabaseUrl, config.publishableKey, vercelOrigin,
          );
          const profileId = profileIds[index];
          if (!profileId) throw new Error('K2 hosted acceptance K2-10 actor profile binding was incomplete.');
          browserFrllSessions.set(browserToken, {
            accessToken: browserToken, userId: actor.id, profileId,
          });
          if (!binding.complete()) {
            browserFrllSessions.delete(browserToken);
            throw new Error('K2 hosted acceptance K2-10 Auth binding exceeded its safety bound.');
          }
          activeBrowserHandle = handle;
        } finally {
          binding.release();
        }
      };
      const holdNextBrainResponse = (handle: K2WaveActorHandle): void => {
        if (frllHeldBrainGate) throw new Error('K2 hosted acceptance delayed response proof was already armed.');
        const { session, profileId } = requireFrllSession(handle);
        frllHeldBrainGate = createK2FrllHeldBrainResponseGate(
          { userId: session.userId, profileId },
          `/v1/brain/concepts/${WAVE_CANONICAL_CONCEPT_ID}`,
          config.githubSha,
        );
        frllCleanup.releaseHeldBrain = () => {
          const gate = frllHeldBrainGate;
          if (!gate) return;
          gate.release();
          frllHeldBrainGate = null;
          delete frllCleanup.releaseHeldBrain;
        };
      };
      frllHarness = {
        page,
        ui: frllUi,
        async createPage() {
          const created = await browserContext.newPage();
          frllPages.push(created);
          return created;
        },
        signInAs,
        switchToActor,
        async request(handle, route, options = {}, expectedStatuses = [200]) {
          const { session, profileId } = requireFrllSession(handle);
          const safeRoute = requireK2FrllApiRoute(route, options, profileId);
          if (expectedStatuses.some(status => ![200, 201, 404, 409].includes(status))) {
            throw new Error('K2 hosted acceptance FRLL expected status was not allowlisted.');
          }
          return requestK2HostedApi(config, session.accessToken, safeRoute, options, expectedStatuses);
        },
        async semanticProof(handle, idempotencyKeySha256) {
          const { profileId } = requireFrllSession(handle);
          const index = actorHandles.indexOf(handle);
          const actor = actors[index];
          if (!actor) throw new Error('K2 hosted acceptance FRLL actor handle was invalid.');
          const proof = await runK2HostedProbe(
            'frll_anchor_semantic_proof',
            config.readonlyDatabaseUrl,
            actor.id,
            profileId,
            undefined,
            idempotencyKeySha256,
          );
          if (!('identity' in proof)) throw new Error('K2 hosted acceptance FRLL semantic proof was invalid.');
          return proof;
        },
        async todayTargetMatches(handle, reviewItemId) {
          if (!UUID_PATTERN.test(reviewItemId)) {
            throw new Error('K2 hosted acceptance FRLL Today target binding was invalid.');
          }
          const index = actorHandles.indexOf(handle);
          const actor = actors[index];
          if (!actor) throw new Error('K2 hosted acceptance actor handle was invalid.');
          const targets = await actorTodayReviewTargets(config, actor.id);
          return targets.targetCount === targets.reviewItemIds.length &&
            targets.reviewItemIds.includes(reviewItemId);
        },
        async pendingReviewReceipt(receiptPage) {
          try {
            return await receiptPage.evaluate(() => {
              for (const key of Object.keys(sessionStorage)) {
                if (!key.startsWith('lingua.review.pending.v1:')) continue;
                try {
                  const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Record<string, unknown> | null;
                  if (value && typeof value.idempotencyKey === 'string' &&
                      typeof value.reviewItemId === 'string' && typeof value.rating === 'string' &&
                      typeof value.responseTimeMs === 'number') return true;
                } catch { /* Invalid local receipt remains untrusted and is not returned. */ }
              }
              return false;
            });
          } catch {
            throw new Error('K2 hosted acceptance FRLL receipt state could not be checked safely.');
          }
        },
        dropNextAnswerResponse() {
          if (!frllReplayController) throw new Error('K2 hosted acceptance FRLL replay guard was unavailable.');
          frllReplayController.dropNextAnswerResponse();
        },
        replayProof() {
          if (!frllReplayController) throw new Error('K2 hosted acceptance FRLL replay guard was unavailable.');
          return frllReplayController.proof();
        },
        async conflictingReviewReplay() {
          if (!frllReplayController) throw new Error('K2 hosted acceptance FRLL replay guard was unavailable.');
          return frllReplayController.conflictingReplay(directFrllRequest);
        },
        holdNextBrainResponse,
        async waitForHeldBrainResponse() {
          const gate = frllHeldBrainGate;
          if (!gate) throw new Error('K2 hosted acceptance delayed response proof was not armed.');
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              gate.received,
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(
                  'K2 hosted acceptance delayed response proof timed out.',
                )), 30_000);
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
        },
        releaseHeldBrainResponse() {
          frllCleanup.releaseHeldBrain?.();
        },
      };
    }
    let k208State: Awaited<ReturnType<typeof buildK208CandidateMatrix>> | undefined;
    let k208Bindings: readonly K2K208ActorBinding[] | undefined;
    if (plugin.waveId === 'K2-08') {
      checkpoint('preflight_k208_actor_candidates', 'start');
      k208Bindings = actorHandles.map(handle => {
        const actorIndex = actorHandles.indexOf(handle);
        const actor = actors[actorIndex];
        const profileId = profileIdByHandle[handle];
        if (!actor || !profileId) throw new Error('K2 hosted acceptance fresh candidate binding was incomplete.');
        return { handle, actor, profileId };
      });
      k208State = await buildK208CandidateMatrix(config, k208Bindings, admin, opaqueIds);
      checkpoint('preflight_k208_actor_candidates', 'pass');
    }
    await plugin.run({
      actors: {
        primary: primaryHandle,
        observer: observerHandle,
        ...(scenarioCHandle ? { scenarioC: scenarioCHandle } : {}),
        ...(scenarioDHandle ? { scenarioD: scenarioDHandle } : {}),
      },
      api: {
        primary: primaryApi,
        observer: observerApi,
        ...(scenarioCHandle && apiByHandle.get(scenarioCHandle)
          ? { scenarioC: apiByHandle.get(scenarioCHandle)! } : {}),
        ...(scenarioDHandle && apiByHandle.get(scenarioDHandle)
          ? { scenarioD: apiByHandle.get(scenarioDHandle)! } : {}),
      },
      ...(frllHarness ? { frll: frllHarness } : {}),
      actorSnapshot: handle => {
        const actorId = actorIdByHandle.get(handle);
        if (!actorId) throw new Error('K2 hosted acceptance actor snapshot handle was invalid.');
        return actorSnapshot(config, actorId);
      },
      actorLineage: handle => {
        const actorId = actorIdByHandle.get(handle);
        if (!actorId) throw new Error('K2 hosted acceptance actor lineage handle was invalid.');
        return actorLineage(config, actorId);
      },
      actorTodayReviewTargets: async handle => {
        const actorId = actorIdByHandle.get(handle);
        if (!actorId) throw new Error('K2 hosted acceptance Today target handle was invalid.');
        const proof = await actorTodayReviewTargets(config, actorId);
        return {
          ...proof,
          reviewItemIds: proof.reviewItemIds.map(id => opaqueIds.project(id) as string),
        };
      },
      ...(k208State && k208Bindings ? {
        candidateMatrix: k208State.publicProofs,
        candidateProof: async handle => {
          const binding = k208Bindings?.find(item => item.handle === handle);
          const selection = k208State?.selections.get(handle);
          const baseline = k208State?.baselines.get(handle);
          if (!binding || !selection || !baseline) {
            throw new Error('K2 hosted acceptance candidate proof handle was invalid.');
          }
          return deriveK208CandidateInputProof(config, admin, binding, selection, baseline);
        },
        verifyDueCandidateIsolation: async () => {
          await verifyK208DueCandidateIsolation(
            config, admin, k208Bindings ?? [], k208State?.baselines ?? new Map(),
            k208State?.selections ?? new Map(), savedConceptIds,
          );
        },
        fixtureSetup: {
          seedForgottenWeakPair: async () => {
            const binding = k208Bindings?.find(item => item.handle === 'observer');
            const selection = k208State?.selections.get('observer');
            const baseline = k208State?.baselines.get('observer');
            if (!binding || !selection || !baseline) {
              throw new Error('K2 hosted acceptance forgotten/weak fixture binding was invalid.');
            }
            await seedK208Fixture(config, admin, binding, selection, baseline, 'forgotten_weak_pair');
          },
          seedWeakOnly: async () => {
            const binding = k208Bindings?.find(item => item.handle === 'scenario-c');
            const selection = k208State?.selections.get('scenario-c');
            const baseline = k208State?.baselines.get('scenario-c');
            if (!binding || !selection || !baseline) {
              throw new Error('K2 hosted acceptance weak-only fixture binding was invalid.');
            }
            await seedK208Fixture(config, admin, binding, selection, baseline, 'weak_only');
          },
        },
      } : {}),
      ...(k209Fixture ? { fixture: k209Fixture } : {}),
      anchorMaterial: () => anchorMaterial(config),
      requireSnapshotRows: requireK2ActorSnapshotRows,
      report: kind => reportWaveAnnotation(testInfo, kind),
      checkpoint,
    });
    checkpoint(wavePhase, 'pass');
  } finally {
    frllCleanup.releaseHeldBrain?.();
    for (const cleanupPage of new Set([page, ...browserContext.pages(), ...frllPages])) {
      try { await cleanupPage.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); }
      catch { /* The page may not have reached a storage-enabled origin. */ }
    }
    for (const extraPage of frllPages) {
      try { await extraPage.close(); } catch { /* The page may already be closed. */ }
    }
    checkpoint('finalizer_begin', 'start');
    const expectedK209ActorIds = plugin.waveId === 'K2-09'
      ? k209ExpectedActorAbsenceIds(
        actors.map(actor => actor.id),
        freshActorIdentities.map(identity => identity.id),
      )
      : [];
    try { await browserContext.clearCookies(); } catch { /* Context may already be closing. */ }
    browserFrllSessions.clear();
    for (const learner of learnerClients) {
      try { await learner.auth.signOut({ scope: 'global' }); } catch { /* Auth deletion still follows. */ }
    }
    sessions.splice(0, sessions.length);

    let cleanedActorCount = 0;
    checkpoint('finalizer_actor_cleanup', 'start');
    try {
      cleanedActorCount = await cleanupK2RunActors(
        config,
        admin,
        actorId => verifyActorGone(config, actorId),
      );
    } catch { cleanupError = true; }
    if (cleanedActorCount < actors.length) cleanupError = true;
    if (!cleanupError) {
      actorCleanupPassed = true;
      checkpoint('finalizer_actor_cleanup', 'pass');
    }
    actors.splice(0, actors.length);
    checkpoint('finalizer_fresh_identity_cleanup', 'start');
    for (const identity of freshActorIdentities) {
      try {
        await cleanupFreshK2HostedActorIdentity(
          config,
          identity,
          admin,
          actorId => verifyActorGone(config, actorId),
        );
      } catch { cleanupError = true; freshIdentityCleanupPassed = false; }
    }
    if (freshIdentityCleanupPassed) checkpoint('finalizer_fresh_identity_cleanup', 'pass');
    freshActorIdentities.splice(0, freshActorIdentities.length);

    if (plugin.waveId === 'K2-09' && k209SetupAttempted) {
      let mayCloseFixture = actorCleanupPassed && freshIdentityCleanupPassed && !cleanupError;
      if (mayCloseFixture) {
        try {
          await cleanupK209FixtureAfterActorProofs(
            expectedK209ActorIds,
            async actorIds => {
              checkpoint('finalizer_k209_actor_absence_before_fixture_cleanup', 'start');
              await verifyK209OwnershipGraph(config);
              await verifyK209ActorAbsence(config, admin, actorIds);
              checkpoint('finalizer_k209_actor_absence_before_fixture_cleanup', 'pass');
            },
            async () => {
              checkpoint('finalizer_k209_fixture_cleanup', 'start');
              const outcome = await cleanupK2HostedFixtureWithRecovery(config, k209Fixture);
              checkpoint('finalizer_k209_fixture_cleanup', 'pass');
              checkpoint(
                outcome === 'absent'
                  ? 'finalizer_k209_fixture_absent_proof'
                  : 'finalizer_k209_fixture_closed_proof',
                'pass',
              );
            },
            async actorIds => {
              checkpoint('finalizer_k209_actor_absence_after_fixture_cleanup', 'start');
              await verifyK209OwnershipGraph(config);
              await verifyK209ActorAbsence(config, admin, actorIds);
              checkpoint('finalizer_k209_actor_absence_after_fixture_cleanup', 'pass');
            },
          );
        } catch { cleanupError = true; }
      }
    }

    if (retainedBaseline) {
      checkpoint('finalizer_retained_comparison', 'start');
      try {
        const retainedAfter = await runK2HostedProbe('retained_snapshot', config.readonlyDatabaseUrl) as K2RetainedSnapshot;
        assertK2RetainedStateUnchanged(retainedBaseline, retainedAfter);
        retainedComparisonPassed = true;
        checkpoint('finalizer_retained_comparison', 'pass');
      } catch { cleanupError = true; }
      retainedBaseline = null;
    }
    if (cleanupError) {
      throw new Error('K2 hosted acceptance cleanup, zero-residue, or retained-state proof failed.');
    }
    markK2HostedFinalizerComplete(testInfo, {
      cleanupError,
      actorCleanupPassed,
      freshIdentityCleanupPassed,
      retainedComparisonPassed,
    });
  }
}

export function validateK2AcceptanceConfiguration(): K2HostedConfig {
  return validateK2HostedEnvironment(process.env, 'acceptance');
}
