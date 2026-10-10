import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { components } from '../../../packages/types/src/generated/openapi';
import {
  assertK2HostedAuthAbsent, assertNoK2ActorsRemain, authenticateK2HostedActor,
  K2_HOSTED_STAGING_SUPABASE_REF,
  cleanupFreshK2HostedActorIdentity, cleanupK2RunActors, createGithubTrustedSourceToken,
  createK2AdminClient, createK2HostedActor, createK2LearnerClient, reapExpiredK2Actors,
  validateK2HostedEnvironment, verifyK2HostedCurrentMasterSha, verifyK2HostedDeploymentAttestations,
  verifyK2FreshActorOwnership, verifyK2StagingApiHealth, verifyProtectedVercelOrigin,
  type K2AdminClient, type K2AuthenticatedActor, type K2FreshActorIdentity,
  type K2HostedActor, type K2HostedConfig, type K2LearnerClient,
} from './k2_hosted_actors';
import {
  assertK2RetainedStateUnchanged, K2_APPROVED_APP_MIGRATION_HEAD,
  parseK2ActorSnapshot, parseK2RetainedSnapshot,
  runK2HostedProbe, type K2RetainedSnapshot, type PilotReaderCatalogManifestProof,
  type PilotReaderCompletionBinding, type PilotReaderCompletionProof,
  k2RetainedTableNames,
} from './k2_hosted_probe_client';
import { installK2BrowserRequestGuard } from './k2_playwright_network';
import { createK2TrustedSourceTokenSupplier } from './k2_vercel_header';
import { signInK2BrowserActor } from './browser_actor_switch';
import { createLearnerProfile, requestK2HostedApi } from './k2_hosted_runner';
import { validateContract } from './contract_validation';

const CANDIDATE_SHA = '25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f';
const BODY_SHA = '180a51f21f5e26e43d49abcf2a828ae3b6b72a04671c101fbf1dfb5d7cd93e5e';
const PUBLICATION_MANIFEST_SHA = '724014360eb401de10d2e72c897834b4e177f32a131a6a7ca331d3aa03135200';
const REPOSITORY_DIR = 'knowledge/staging/pilot-reader-vi-draft';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TODAY_PLAN_TABLES = ['today_activity_review_items', 'today_plan_activities', 'today_plans'] as const;

type CandidatePair = Readonly<{ ordinal: number; english: string; vietnamese: string }>;
type CandidateFiles = Readonly<{
  pairs: readonly CandidatePair[]; title: string;
  translationSha256: string; pairSha256: string;
}>;
type ReaderAnnotation = Readonly<{
  segmentId: string; sentenceId: string; conceptId: string;
  startOffset: number; endOffset: number; segmentIndex: number; surfaceText: string;
}>;
export type ReaderTarget = {
  readonly contentId: string;
  segmentIds: string[]; sentenceIds: string[];
  annotations: ReaderAnnotation[];
  finalConceptIds: string[];
  revealSentenceIndex: number;
  selectedAnnotation: ReaderAnnotation | null;
};
type PilotAction =
  | 'me' | 'languages' | 'content' | 'concept'
  | 'lookup_exposure' | 'concept_save' | 'read_exposure' | 'progress'
  | 'review_queue' | 'today';
type PilotRequest = Readonly<{
  action: PilotAction; route: string; method: string;
  body?: Record<string, unknown>; idempotencyKey?: string;
}>;
type PilotRouteState = {
  readonly config: K2HostedConfig; readonly vercelOrigin: string; readonly actorId: string;
  readonly profileId: string;
  readonly candidate: CandidateFiles; readonly readerTarget: ReaderTarget;
  token: string; readonly actions: PilotAction[];
  readonly contentRequestArmed: { value: boolean };
  readonly contentRequestStarted: { value: boolean };
  readonly contentConfirmed: { value: boolean };
  contentRequestCount: number;
  readonly lookupArmed: { value: boolean }; readonly completionArmed: { value: boolean };
  readonly reviewClickArmed: { value: boolean }; readonly todayClickArmed: { value: boolean };
  readonly saveFailureRemaining: { value: number }; readonly saveFailureObserved: { value: boolean };
  readonly saveConfirmed: { value: boolean }; readonly lookupExposureConfirmed: { value: boolean };
  readonly conceptReadConfirmed: { value: boolean }; readonly readExposureConfirmed: { value: boolean };
  readonly progressConfirmed: { value: boolean }; readonly failed: { value: boolean };
  readExposureAcceptedCount?: number;
  readExposureId?: string;
  readExposureKey?: string;
  readExposureBody?: Record<string, unknown>;
  progressKey?: string;
  progressBody?: Record<string, unknown>;
  reviewQueue?: components['schemas']['ReviewQueueItem'][];
  todayPlan?: components['schemas']['TodayPlan'];
};
type ActorRun = Readonly<{
  actor: K2HostedActor; learner: K2LearnerClient;
  session: K2AuthenticatedActor; profileId: string;
}>;
type K2ConceptDetail = components['schemas']['ConceptDetail'];

function fail(message: string): Error { return new Error(message); }
function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}
function objectFromJson(buffer: Buffer | undefined): Record<string, unknown> | null {
  if (!buffer || buffer.length < 1 || buffer.length > 8192) return null;
  try {
    const value: unknown = JSON.parse(buffer.toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}
function ownProfileQuery(url: URL, profileId: string, allowed: readonly string[]): boolean {
  const keys = [...url.searchParams.keys()];
  return keys.every(key => allowed.includes(key)) &&
    [...new Set(keys)].every(key => url.searchParams.getAll(key).length === 1) &&
    (url.searchParams.get('languageProfileId') === null ||
      url.searchParams.get('languageProfileId') === profileId) &&
    (url.searchParams.get('cursor') === null ||
      (url.searchParams.get('cursor')!.length > 0 && url.searchParams.get('cursor')!.length <= 512)) &&
    (url.searchParams.get('limit') === null ||
      /^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit')!));
}

export function classifyPilotReaderRequest(
  urlValue: string, methodValue: string, profileId: string, target: ReaderTarget,
  state: Readonly<{
    contentRequestArmed: boolean; contentRequestStarted: boolean; contentConfirmed: boolean;
    lookupArmed: boolean; completionArmed: boolean;
    reviewClickArmed: boolean; todayClickArmed: boolean;
    saveConfirmed: boolean; conceptReadConfirmed: boolean;
    readExposureConfirmed: boolean; progressConfirmed: boolean;
  }>,
): PilotRequest | null {
  let url: URL;
  try { url = new URL(urlValue); } catch { return null; }
  if (url.origin !== 'https://pilot-reader.invalid' ||
      !url.pathname.startsWith('/api/v1/') || url.hash !== '') return null;
  const route = url.pathname.slice('/api'.length);
  const method = methodValue.toUpperCase();
  if (route === '/v1/me' && method === 'GET' && url.search === '') return { action: 'me', route, method };
  if (route === '/v1/me/languages' && method === 'GET' && url.search === '') {
    return { action: 'languages', route, method };
  }
  if (route === '/v1/content/' + target.contentId && method === 'GET' && url.search === '') {
    return state.contentRequestArmed && !state.contentRequestStarted && !state.contentConfirmed
      ? { action: 'content', route, method } : null;
  }
  const chosen = target.selectedAnnotation?.conceptId;
  const conceptMatch = route.match(/^\/v1\/concepts\/([0-9a-f-]+)$/i);
  if (conceptMatch && method === 'GET' && url.search === '' &&
      state.contentConfirmed && state.lookupArmed && !state.conceptReadConfirmed && conceptMatch[1] === chosen) {
    return { action: 'concept', route, method };
  }
  if (route === '/v1/library/concepts/' + chosen && method === 'PUT' && url.search === '' &&
      state.conceptReadConfirmed && !state.saveConfirmed) {
    return { action: 'concept_save', route, method };
  }
  if (route === '/v1/reader/exposures' && method === 'POST' && url.search === '' &&
      (state.lookupArmed || state.completionArmed)) {
    return { action: 'lookup_exposure', route, method };
  }
  if (route === '/v1/reader/progress/' + target.contentId && method === 'PUT' && url.search === '' &&
      state.readExposureConfirmed && !state.progressConfirmed) {
    return { action: 'progress', route, method };
  }
  if (route === '/v1/review/queue' && method === 'GET' && state.reviewClickArmed &&
      ownProfileQuery(url, profileId, ['languageProfileId', 'limit', 'cursor'])) {
    return { action: 'review_queue', route: route + url.search, method };
  }
  if (route === '/v1/today' && method === 'GET' && state.todayClickArmed &&
      state.progressConfirmed && ownProfileQuery(url, profileId, ['languageProfileId', 'date'])) {
    return { action: 'today', route: route + url.search, method };
  }
  return null;
}

export async function loadPilotReaderCandidateFiles(repositoryRoot = process.cwd()): Promise<CandidateFiles> {
  let candidateBytes: Buffer;
  let manifestBytes: Buffer;
  try {
    [candidateBytes, manifestBytes] = await Promise.all([
      readFile(resolve(repositoryRoot, REPOSITORY_DIR, 'translation-draft.json')),
      readFile(resolve(repositoryRoot, REPOSITORY_DIR, 'publication-manifest.json')),
    ]);
  } catch { throw fail('PILOT-READER candidate or pinned publication manifest was unavailable.'); }
  if (sha256(candidateBytes) !== CANDIDATE_SHA || sha256(manifestBytes) !== PUBLICATION_MANIFEST_SHA) {
    throw fail('PILOT-READER candidate or pinned publication manifest digest changed.');
  }
  let candidate: Record<string, unknown>;
  let manifest: Record<string, unknown>;
  try {
    candidate = JSON.parse(candidateBytes.toString('utf8')) as Record<string, unknown>;
    manifest = JSON.parse(manifestBytes.toString('utf8')) as Record<string, unknown>;
  } catch { throw fail('PILOT-READER candidate or pinned publication manifest was invalid.'); }
  const content = manifest.content as Record<string, unknown> | undefined;
  const approval = manifest.owner_approval as Record<string, unknown> | undefined;
  const rawPairs = candidate.sentences;
  if (manifest.schema_version !== 'lingua.pilot.reader-publication.v1' ||
      manifest.scope !== 'staging_only' || manifest.candidate_sha256 !== CANDIDATE_SHA ||
      manifest.candidate_body_sha256 !== BODY_SHA || manifest.sentence_count !== 72 ||
      approval?.exact_candidate_editorial_rights_and_staging_scope !== true ||
      approval.publication_requires_normal_admin_validation_and_reviewed_runtime !== true ||
      approval.supersedes_historical_candidate_pending_flags !== true ||
      approval.inherits_pr38_approval !== false || !content ||
      candidate.candidate_body_sha256 !== BODY_SHA || candidate.title !== content.title ||
      candidate.language !== content.languageCode || typeof candidate.body !== 'string' ||
      !Array.isArray(rawPairs) || rawPairs.length !== 72 || typeof content.title !== 'string' ||
      !manifest.translationSource || typeof manifest.translationSource !== 'object') {
    throw fail('PILOT-READER fixed publication metadata was invalid.');
  }
  const pairs: CandidatePair[] = [];
  for (let index = 0; index < rawPairs.length; index += 1) {
    const raw = rawPairs[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw fail('PILOT-READER candidate sentence manifest was invalid.');
    }
    const row = raw as Record<string, unknown>;
    const ordinal = index + 1;
    if (row.ordinal !== ordinal || typeof row.english !== 'string' ||
        typeof row.vietnamese !== 'string' || !row.english.trim() || !row.vietnamese.trim() ||
        sha256(row.english) !== row.english_sha256) {
      throw fail('PILOT-READER candidate sentence manifest was invalid.');
    }
    pairs.push({ ordinal, english: row.english, vietnamese: row.vietnamese });
  }
  if (candidate.body !== pairs.map(pair => pair.english).join(' ') || sha256(candidate.body) !== BODY_SHA) {
    throw fail('PILOT-READER candidate body did not match the pinned hash.');
  }
  return {
    pairs, title: content.title,
    translationSha256: sha256(pairs.map(pair => pair.ordinal + '\t' + pair.vietnamese).join('\n')),
    pairSha256: sha256(pairs.map(pair => pair.ordinal + '\t' + pair.english + '\t' + pair.vietnamese).join('\n')),
  };
}

export function assertPilotReaderCatalogProof(
  proof: PilotReaderCatalogManifestProof,
  candidate: CandidateFiles,
): string {
  const { sourceRecordCount, ...translationFlags } = proof.translationProvenance;
  if (!UUID_RE.test(proof.contentId) || proof.contentCount !== 1 ||
      proof.segmentCount !== 72 || proof.sentenceCount !== 72 || proof.translationCount !== 72 ||
      proof.conceptCount < 1 ||
      proof.candidateSha256 !== CANDIDATE_SHA || proof.bodySha256 !== BODY_SHA ||
      proof.translationSha256 !== candidate.translationSha256 || proof.pairSha256 !== candidate.pairSha256 ||
      sourceRecordCount !== 1 ||
      Object.values(proof.contentProvenance).some(value => value !== true) ||
      Object.values(translationFlags).some(value => value !== true)) {
    throw fail('PILOT-READER actorless published catalog proof did not match the fixed manifest.');
  }
  return proof.contentId;
}

export function pilotReaderSelectionUrl(vercelOrigin: string, contentId: string): string {
  if (!UUID_RE.test(contentId)) throw fail('PILOT-READER requested content identity was invalid.');
  const url = new URL('/read', vercelOrigin);
  url.searchParams.set('contentId', contentId);
  return url.href;
}

async function openRequestedReader(page: Page, state: PilotRouteState): Promise<void> {
  if (!UUID_RE.test(state.readerTarget.contentId) ||
      (state.contentRequestStarted.value && !state.contentConfirmed.value)) {
    throw fail('PILOT-READER requested Reader route was not ready.');
  }
  const previousCount = state.contentRequestCount;
  state.contentRequestArmed.value = true;
  state.contentRequestStarted.value = false;
  state.contentConfirmed.value = false;
  await page.goto(
    pilotReaderSelectionUrl(state.vercelOrigin, state.readerTarget.contentId),
    { waitUntil: 'domcontentloaded' },
  );
  const navigatedUrl = new URL(page.url());
  if (navigatedUrl.origin !== state.vercelOrigin || navigatedUrl.pathname !== '/read' ||
      navigatedUrl.hash !== '' || navigatedUrl.searchParams.getAll('contentId').length !== 1 ||
      navigatedUrl.searchParams.get('contentId') !== state.readerTarget.contentId ||
      [...navigatedUrl.searchParams.keys()].some(key => key !== 'contentId')) {
    throw fail('PILOT-READER navigation did not preserve the exact requested content identity.');
  }
  await expect.poll(() => state.contentConfirmed.value, { timeout: 60_000 }).toBe(true);
  if (state.contentRequestCount !== previousCount + 1) {
    throw fail('PILOT-READER requested route did not load exactly one pinned content identity.');
  }
}

function createPilotRouteState(
  config: K2HostedConfig,
  vercelOrigin: string,
  actorId: string,
  profileId: string,
  candidate: CandidateFiles,
  contentId: string,
): PilotRouteState {
  return {
    config, vercelOrigin, actorId, profileId, candidate,
    readerTarget: {
      contentId, segmentIds: [], sentenceIds: [], annotations: [],
      finalConceptIds: [], revealSentenceIndex: 0, selectedAnnotation: null,
    },
    token: '', actions: [],
    contentRequestArmed: { value: false },
    contentRequestStarted: { value: false },
    contentConfirmed: { value: false },
    contentRequestCount: 0,
    lookupArmed: { value: false }, completionArmed: { value: false },
    reviewClickArmed: { value: false }, todayClickArmed: { value: false },
    saveFailureRemaining: { value: 1 }, saveFailureObserved: { value: false },
    saveConfirmed: { value: false }, lookupExposureConfirmed: { value: false },
    conceptReadConfirmed: { value: false }, readExposureConfirmed: { value: false },
    progressConfirmed: { value: false }, failed: { value: false },
  };
}

function assertConceptCompetenceUnchanged(
  before: K2ConceptDetail,
  after: K2ConceptDetail,
): void {
  if (before.id !== after.id ||
      JSON.stringify(before.learner.competence) !== JSON.stringify(after.learner.competence)) {
    throw fail('PILOT-READER passive exposure changed concept competence.');
  }
}

function assertPassiveConceptBaseline(value: K2ConceptDetail): void {
  if (value.learner.status !== 'unseen' || value.learner.exposureCount !== 0 ||
      value.learner.isDue || value.learner.memory != null ||
      Object.values(value.learner.competence).some(dimension =>
        dimension.score !== 0.5 || dimension.confidence !== 0 || dimension.evidenceCount !== 0)) {
    throw fail('PILOT-READER final-segment concept had prior active or review state.');
  }
}

function assertPassiveConceptTransition(before: K2ConceptDetail, after: K2ConceptDetail): void {
  assertPassiveConceptBaseline(before);
  assertConceptCompetenceUnchanged(before, after);
  if (before.learner.status !== 'unseen' || after.learner.status !== 'discovered' ||
      before.learner.exposureCount !== 0 || after.learner.exposureCount !== 1 ||
      before.learner.isDue || after.learner.isDue ||
      after.learner.memory != null ||
      Object.values(after.learner.competence).some(dimension =>
        dimension.score !== 0.5 || dimension.confidence !== 0 || dimension.evidenceCount !== 0)) {
    throw fail('PILOT-READER final-segment exposure exceeded passive concept semantics.');
  }
}

function parseReaderContent(
  payload: unknown,
  target: ReaderTarget,
  candidate: CandidateFiles,
): components['schemas']['ContentDetail'] {
  const detail = validateContract('ContentResponse', payload).data;
  if (detail.summary.id !== target.contentId || detail.summary.title !== candidate.title ||
      detail.summary.contentType !== 'article' || detail.summary.targetLanguageCode !== 'en' ||
      detail.segments.length !== 72 || candidate.pairs.length !== 72) {
    throw fail('PILOT-READER Reader content identity or bounded structure did not match the pin.');
  }
  const annotations: ReaderAnnotation[] = [];
  const finalConcepts = new Set<string>();
  target.segmentIds.length = 0;
  target.sentenceIds.length = 0;
  for (let index = 0; index < detail.segments.length; index += 1) {
    const segment = detail.segments[index];
    const pair = candidate.pairs[index];
    if (!segment || !pair || segment.order !== index || segment.sentences.length !== 1 ||
        segment.text !== pair.english) {
      throw fail('PILOT-READER ordered Reader segments did not match the pinned English text.');
    }
    const sentence = segment.sentences[0];
    if (!sentence || sentence.order !== index || sentence.text !== pair.english ||
        sentence.translation !== pair.vietnamese) {
      throw fail('PILOT-READER ordered Reader sentences or Vietnamese text did not match the pin.');
    }
    for (const item of sentence.concepts) {
      if (!UUID_RE.test(item.conceptId) || !Number.isSafeInteger(item.startOffset) ||
          !Number.isSafeInteger(item.endOffset) || item.startOffset < 0 ||
          item.endOffset <= item.startOffset || item.endOffset > sentence.text.length ||
          !sentence.text.slice(item.startOffset, item.endOffset).trim()) {
        throw fail('PILOT-READER Reader concept annotation did not match the bounded sentence.');
      }
      const annotation: ReaderAnnotation = {
        segmentId: segment.id,
        sentenceId: sentence.id,
        conceptId: item.conceptId,
        startOffset: item.startOffset,
        endOffset: item.endOffset,
        segmentIndex: index,
        surfaceText: sentence.text.slice(item.startOffset, item.endOffset),
      };
      annotations.push(annotation);
      if (index === detail.segments.length - 1) finalConcepts.add(item.conceptId);
    }
    target.segmentIds.push(segment.id);
    target.sentenceIds.push(sentence.id);
  }
  const lastIndex = detail.segments.length - 1;
  target.annotations = annotations;
  target.finalConceptIds = [...finalConcepts];
  target.revealSentenceIndex = Math.min(1, Math.max(0, lastIndex - 1));
  const firstBySegment = new Map<number, ReaderAnnotation>();
  for (const annotation of annotations) {
    if (!firstBySegment.has(annotation.segmentIndex)) {
      firstBySegment.set(annotation.segmentIndex, annotation);
    }
  }
  target.selectedAnnotation = [...firstBySegment.values()].find(item =>
    item.segmentIndex < lastIndex && !finalConcepts.has(item.conceptId),
  ) ?? null;
  if (!target.selectedAnnotation || target.finalConceptIds.length < 1) {
    throw fail('PILOT-READER pinned Reader segment had no safe reviewed concept sample.');
  }
  return detail;
}

function snapshot(result: Awaited<ReturnType<typeof runK2HostedProbe>>): K2RetainedSnapshot {
  if (!('tables' in result) || !('totalRows' in result)) {
    throw fail('PILOT-READER actor snapshot was invalid.');
  }
  return result;
}

async function actorSnapshot(config: K2HostedConfig, actorId: string): Promise<K2RetainedSnapshot> {
  return snapshot(await runK2HostedProbe('actor_snapshot', config.readonlyDatabaseUrl, actorId));
}

async function readerCompletionProbe(
  config: K2HostedConfig,
  actorId: string,
  profileId: string,
  conceptIds: readonly string[],
  binding: PilotReaderCompletionBinding,
  idempotencyKeySha256?: string,
): Promise<PilotReaderCompletionProof> {
  const proof = await runK2HostedProbe(
    'pilot_reader_completion', config.readonlyDatabaseUrl, actorId, profileId,
    conceptIds, idempotencyKeySha256, binding,
  );
  if (!('phase' in proof)) throw fail('PILOT-READER final-segment passive proof was unavailable.');
  return proof;
}

async function retainedSnapshot(config: K2HostedConfig): Promise<K2RetainedSnapshot> {
  return snapshot(await runK2HostedProbe('retained_snapshot', config.readonlyDatabaseUrl));
}

function requireSnapshotCounts(
  actual: K2RetainedSnapshot,
  expected: Readonly<Partial<Record<keyof K2RetainedSnapshot['tables'], number>>>,
): void {
  if (Object.entries(expected).some(([name, count]) =>
    actual.tables[name as keyof K2RetainedSnapshot['tables']].rows !== count)) {
    throw fail('PILOT-READER actor table counts did not match the accepted phase.');
  }
}

function assertZeroActorSnapshot(value: K2RetainedSnapshot): void {
  if (value.totalRows !== 0 || k2RetainedTableNames().some(table => value.tables[table].rows !== 0)) {
    throw fail('PILOT-READER fresh actor snapshot was not zero across all learner tables.');
  }
}

function assertFreshProfileSnapshot(value: K2RetainedSnapshot): void {
  if (value.totalRows !== 4 || k2RetainedTableNames().some(table =>
    value.tables[table].rows !== (table === 'users' || table === 'learner_profiles' ||
      table === 'profile_mutation_results' || table === 'user_languages' ? 1 : 0))) {
    throw fail('PILOT-READER fresh profile bootstrap included unexpected learner rows.');
  }
}

type ActorTable = keyof K2RetainedSnapshot['tables'];

function zeroTableDeltas(): Record<ActorTable, number> {
  return Object.fromEntries(k2RetainedTableNames().map(table => [table, 0])) as Record<ActorTable, number>;
}

function assertExactActorTableDeltas(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
  expectedDeltas: Readonly<Record<ActorTable, number>>,
  allowedZeroRowHashChanges: readonly ActorTable[] = [],
): void {
  const names = k2RetainedTableNames();
  if (names.length !== 27) throw fail('PILOT-READER actor snapshot table inventory was incomplete.');
  let expectedTotalDelta = 0;
  for (const table of names) {
    const expected = expectedDeltas[table];
    const delta = after.tables[table].rows - before.tables[table].rows;
    expectedTotalDelta += expected;
    if (delta !== expected) throw fail('PILOT-READER actor table row deltas did not match the accepted phase.');
    const digestChanged = before.tables[table].sha256 !== after.tables[table].sha256;
    if (expected === 0 && digestChanged !== allowedZeroRowHashChanges.includes(table)) {
      throw fail('PILOT-READER actor table digest changed outside its accepted phase.');
    }
    if (expected !== 0 && !digestChanged) {
      throw fail('PILOT-READER expected actor table mutation was absent from its digest.');
    }
  }
  if (after.totalRows - before.totalRows !== expectedTotalDelta) {
    throw fail('PILOT-READER actor total row delta did not match the accepted phase.');
  }
}

export function assertPilotReaderCompletionDeltas(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
  eligibleConceptCount: number,
): void {
  if (!Number.isSafeInteger(eligibleConceptCount) || eligibleConceptCount < 1 || eligibleConceptCount > 1000) {
    throw fail('PILOT-READER final-segment concept count was invalid.');
  }
  const expected = zeroTableDeltas();
  expected.exposure_events = 1;
  expected.learning_events = eligibleConceptCount;
  expected.reader_exposure_concepts = eligibleConceptCount;
  expected.reader_mutation_results = 1;
  expected.user_concept_states = eligibleConceptCount;
  expected.user_content_progress = 1;
  assertExactActorTableDeltas(before, after, expected, ['user_language_projection_heads']);
  if (before.tables.user_language_projection_heads.rows !== 1 ||
      after.tables.user_language_projection_heads.rows !== 1 ||
      before.tables.today_plans.rows !== after.tables.today_plans.rows ||
      before.tables.today_plan_activities.rows !== after.tables.today_plan_activities.rows ||
      before.tables.today_activity_review_items.rows !== after.tables.today_activity_review_items.rows) {
    throw fail('PILOT-READER completion changed projection or Today row cardinality unexpectedly.');
  }
}

export function assertPilotReaderTodayDeltas(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
  plan: components['schemas']['TodayPlan'],
): void {
  const activities = plan.activities;
  if (!Array.isArray(activities) || activities.length > 20) {
    throw fail('PILOT-READER Today plan activity count was invalid.');
  }
  let reviewTargetCount = 0;
  for (const activity of activities) {
    if (activity.activityType === 'review') {
      if (!Number.isSafeInteger(activity.targetCount) || (activity.targetCount ?? -1) < 0 ||
          (activity.targetCount ?? 0) > 181) {
        throw fail('PILOT-READER Today review target count was invalid.');
      }
      reviewTargetCount += activity.targetCount ?? 0;
    }
  }
  const expected = zeroTableDeltas();
  expected.today_plans = 1;
  expected.today_plan_activities = activities.length;
  expected.today_activity_review_items = reviewTargetCount;
  assertExactActorTableDeltas(before, after, expected);
  if (TODAY_PLAN_TABLES.some(table => after.tables[table].rows !== expected[table] + before.tables[table].rows)) {
    throw fail('PILOT-READER user-clicked Today did not persist the exact returned plan shape.');
  }
}

export function canClaimOneShotReaderCommand(
  existingKey: string | undefined,
  existingBody: Record<string, unknown> | undefined,
  nextKey: string | undefined,
  nextBody: Record<string, unknown> | null,
): boolean {
  return existingKey === undefined && existingBody === undefined &&
    UUID_RE.test(nextKey ?? '') && nextBody !== null;
}

export function assertExactReaderExposureCount(acceptedConceptCount: number, eligibleConceptCount: number): void {
  if (!Number.isSafeInteger(acceptedConceptCount) || acceptedConceptCount !== eligibleConceptCount ||
      !Number.isSafeInteger(eligibleConceptCount) || eligibleConceptCount < 1 || eligibleConceptCount > 1000) {
    throw fail('PILOT-READER accepted concept count did not match the exact segment annotations.');
  }
}

type ReaderExposureResult = components['schemas']['ReaderExposureResult'];

export function assertPilotReaderExposureReplay(
  original: Pick<ReaderExposureResult, 'exposureId' | 'contentId' | 'segmentId' | 'exposureType' | 'acceptedConceptCount'>,
  replayed: Pick<ReaderExposureResult, 'exposureId' | 'contentId' | 'segmentId' | 'exposureType' | 'acceptedConceptCount'>,
): void {
  if (original.exposureId !== replayed.exposureId || original.contentId !== replayed.contentId ||
      original.segmentId !== replayed.segmentId || original.exposureType !== replayed.exposureType ||
      original.acceptedConceptCount !== replayed.acceptedConceptCount) {
    throw fail('PILOT-READER read exposure replay did not match its original accepted result.');
  }
}

export function assertPilotReaderCompletionProofs(
  before: PilotReaderCompletionProof,
  after: PilotReaderCompletionProof,
  eligibleConceptIds: readonly string[],
  exposureId: string,
): void {
  const expectedIds = [...eligibleConceptIds].sort();
  const expectedEvent = [exposureId];
  const stableTableNames = [
    'exposure_events', 'learning_events', 'reader_exposure_concepts', 'user_concept_states',
  ] as const;
  const beforeStableNames = Object.keys(before.stableRows).sort();
  const afterStableNames = Object.keys(after.stableRows).sort();
  const expectedStableNames = [...stableTableNames].sort();
  const stableRowsUnchanged =
    JSON.stringify(beforeStableNames) === JSON.stringify(expectedStableNames) &&
    JSON.stringify(afterStableNames) === JSON.stringify(expectedStableNames) &&
    stableTableNames.every(name =>
      before.stableRows[name].rows === after.stableRows[name].rows &&
      before.stableRows[name].sha256 === after.stableRows[name].sha256);
  if (before.phase !== 'before' || after.phase !== 'after' ||
      JSON.stringify([...before.eligibleConceptIds].sort()) !== JSON.stringify(expectedIds) ||
      JSON.stringify([...after.eligibleConceptIds].sort()) !== JSON.stringify(expectedIds) ||
      before.exposureEventIds.length !== 0 ||
      JSON.stringify(after.exposureEventIds) !== JSON.stringify(expectedEvent) ||
      JSON.stringify([...after.linkedConceptIds].sort()) !== JSON.stringify(expectedIds) ||
      JSON.stringify([...after.learningConceptIds].sort()) !== JSON.stringify(expectedIds) ||
      JSON.stringify(after.conceptStates.map(state => state.conceptId).sort()) !== JSON.stringify(expectedIds) ||
      before.skillStateCount !== 3 || after.skillStateCount !== 3 ||
      !before.skillStatesPassiveOnly || !after.skillStatesPassiveOnly ||
      before.projectionHead.rowCount !== 1 || after.projectionHead.rowCount !== 1 ||
      before.projectionHead.parameterVersion !== after.projectionHead.parameterVersion ||
      !/^[a-f0-9]{64}$/.test(before.projectionHead.immutableSha256) ||
      before.projectionHead.immutableSha256 !== after.projectionHead.immutableSha256 ||
      before.projectionHead.updatedAtMatchesCompletion !== null ||
      after.projectionHead.updatedAtMatchesCompletion !== true ||
      after.projectionHead.stateVersion !== before.projectionHead.stateVersion + expectedIds.length ||
      after.projectionHead.nextIngestionSequence !==
        before.projectionHead.nextIngestionSequence + expectedIds.length ||
      !stableRowsUnchanged) {
    throw fail('PILOT-READER passive completion proof did not reconcile with the exact final segment.');
  }
}

function safeResponseHeaders(sourceSha: string): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lingua-source-sha': sourceSha,
  };
}

async function rejectPilotRequest(route: Route, state: PilotRouteState): Promise<void> {
  state.failed.value = true;
  try { await route.abort(); } catch { /* only a closed route can reject this abort */ }
}

function validateReaderExposureBody(
  raw: Record<string, unknown> | null,
  idempotencyKey: string | undefined,
  state: PilotRouteState,
): Readonly<{ action: 'lookup_exposure' | 'read_exposure'; body: Record<string, unknown> }> | null {
  if (!raw || !UUID_RE.test(idempotencyKey ?? '') ||
      raw.languageProfileId !== state.profileId || raw.contentId !== state.readerTarget.contentId) return null;
  const annotation = state.readerTarget.selectedAnnotation;
  if (raw.exposureType === 'lookup' && annotation && state.lookupArmed.value &&
      exactKeys(raw, ['languageProfileId', 'contentId', 'segmentId', 'sentenceId',
        'startOffset', 'endOffset', 'exposureType']) &&
      raw.segmentId === annotation.segmentId && raw.sentenceId === annotation.sentenceId &&
      raw.startOffset === annotation.startOffset && raw.endOffset === annotation.endOffset) {
    return { action: 'lookup_exposure', body: raw };
  }
  const finalSegment = state.readerTarget.segmentIds.at(-1);
  if (raw.exposureType === 'read' && state.completionArmed.value && finalSegment &&
      exactKeys(raw, ['languageProfileId', 'contentId', 'segmentId', 'exposureType']) &&
      raw.segmentId === finalSegment) {
    return { action: 'read_exposure', body: raw };
  }
  return null;
}

function parseResponse<K extends keyof components['schemas']>(
  schema: K,
  payload: unknown,
): components['schemas'][K] {
  return validateContract(schema, payload) as components['schemas'][K];
}

async function forwardPilotReaderRequest(route: Route, state: PilotRouteState): Promise<void> {
  const request = route.request();
  try {
    const requestUrl = new URL(request.url());
    const headers = request.headers();
    if (requestUrl.origin !== state.vercelOrigin || headers.authorization !== `Bearer ${state.token}` ||
        !state.token || !requestUrl.pathname.startsWith('/api/v1/')) {
      await rejectPilotRequest(route, state);
      return;
    }
    const classification = classifyPilotReaderRequest(
      `https://pilot-reader.invalid${requestUrl.pathname}${requestUrl.search}`,
      request.method(),
      state.profileId,
      state.readerTarget,
      {
        contentRequestArmed: state.contentRequestArmed.value,
        contentRequestStarted: state.contentRequestStarted.value,
        contentConfirmed: state.contentConfirmed.value,
        lookupArmed: state.lookupArmed.value,
        completionArmed: state.completionArmed.value,
        reviewClickArmed: state.reviewClickArmed.value,
        todayClickArmed: state.todayClickArmed.value,
        saveConfirmed: state.saveConfirmed.value,
        conceptReadConfirmed: state.conceptReadConfirmed.value,
        readExposureConfirmed: state.readExposureConfirmed.value,
        progressConfirmed: state.progressConfirmed.value,
      },
    );
    if (!classification) {
      await rejectPilotRequest(route, state);
      return;
    }

    let action = classification.action;
    if (action === 'content') {
      if (!state.contentRequestArmed.value || state.contentRequestStarted.value ||
          state.contentConfirmed.value) {
        await rejectPilotRequest(route, state);
        return;
      }
      state.contentRequestStarted.value = true;
    }
    const requestBody = objectFromJson(request.postDataBuffer() ?? undefined);
    const idempotencyKey = headers['idempotency-key'];
    if (action === 'lookup_exposure') {
      const exposure = validateReaderExposureBody(requestBody, idempotencyKey, state);
      if (!exposure) {
        await rejectPilotRequest(route, state);
        return;
      }
      action = exposure.action;
      if (action === 'read_exposure') {
        if (!canClaimOneShotReaderCommand(
          state.readExposureKey, state.readExposureBody, idempotencyKey, exposure.body,
        )) {
          await rejectPilotRequest(route, state);
          return;
        }
        state.readExposureKey = idempotencyKey;
        state.readExposureBody = exposure.body;
      }
    } else if (action === 'concept_save') {
      if (requestBody !== null || idempotencyKey !== undefined || !state.lookupExposureConfirmed.value ||
          !state.conceptReadConfirmed.value) {
        await rejectPilotRequest(route, state);
        return;
      }
      if (state.saveFailureRemaining.value > 0) {
        state.saveFailureRemaining.value -= 1;
        state.saveFailureObserved.value = true;
        state.actions.push('concept_save');
        const failurePayload = {
          error: { code: 'INTERNAL_ERROR', message: 'Synthetic retry check.' },
          meta: { requestId: randomUUID(), apiVersion: '1.0' },
        };
        await route.fulfill({
          status: 503,
          headers: safeResponseHeaders(state.config.githubSha),
          body: JSON.stringify(failurePayload),
        });
        return;
      }
    } else if (action === 'progress') {
      if (!requestBody || !UUID_RE.test(idempotencyKey ?? '') ||
          !exactKeys(requestBody, ['languageProfileId', 'currentSegmentId', 'isCompleted']) ||
          requestBody.languageProfileId !== state.profileId ||
          requestBody.currentSegmentId !== state.readerTarget.segmentIds.at(-1) ||
          requestBody.isCompleted !== true || !state.readExposureConfirmed.value) {
        await rejectPilotRequest(route, state);
        return;
      }
      if (!canClaimOneShotReaderCommand(
        state.progressKey, state.progressBody, idempotencyKey, requestBody,
      )) {
        await rejectPilotRequest(route, state);
        return;
      }
      state.progressKey = idempotencyKey;
      state.progressBody = requestBody;
    } else if (action !== 'read_exposure' &&
        (requestBody !== null || idempotencyKey !== undefined)) {
      await rejectPilotRequest(route, state);
      return;
    }

    const result = await requestK2HostedApi(
      state.config,
      state.token,
      classification.route,
      {
        method: classification.method,
        ...(requestBody === null ? {} : { body: requestBody }),
        ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      },
    );
    const payload = result.payload;
    if (action === 'me') {
      const data = parseResponse('MeResponse', payload).data;
      if (data.id !== state.actorId) throw fail('PILOT-READER browser identity binding failed.');
    } else if (action === 'languages') {
      const data = parseResponse('LanguageProfilesResponse', payload).data;
      if (data.length !== 1 || data[0]?.id !== state.profileId) {
        throw fail('PILOT-READER browser profile binding failed.');
      }
    } else if (action === 'content') {
      parseReaderContent(payload, state.readerTarget, state.candidate);
      state.contentConfirmed.value = true;
      state.contentRequestArmed.value = false;
      state.contentRequestCount += 1;
    } else if (action === 'concept') {
      const data = parseResponse('ConceptResponse', payload).data;
      if (data.id !== state.readerTarget.selectedAnnotation?.conceptId) {
        throw fail('PILOT-READER concept response did not match the selected annotation.');
      }
      state.conceptReadConfirmed.value = true;
    } else if (action === 'lookup_exposure' || action === 'read_exposure') {
      const data = parseResponse('ReaderExposureResponse', payload).data;
      const expectedBody = requestBody;
      if (!expectedBody || data.contentId !== state.readerTarget.contentId ||
          data.segmentId !== expectedBody.segmentId || data.exposureType !== expectedBody.exposureType ||
          data.acceptedConceptCount < 1) {
        throw fail('PILOT-READER Reader exposure response did not match its explicit command.');
      }
      if (action === 'read_exposure') {
        assertExactReaderExposureCount(data.acceptedConceptCount, state.readerTarget.finalConceptIds.length);
      }
      if (action === 'lookup_exposure') state.lookupExposureConfirmed.value = true;
      else {
        state.readExposureAcceptedCount = data.acceptedConceptCount;
        state.readExposureId = data.exposureId;
        state.readExposureConfirmed.value = true;
      }
    } else if (action === 'concept_save') {
      const data = parseResponse('LibraryMutationResponse', payload).data;
      if (data.id !== state.readerTarget.selectedAnnotation?.conceptId ||
          data.itemType !== 'concept' || data.isSaved !== true) {
        throw fail('PILOT-READER explicit concept Save response was not confirmed.');
      }
      state.saveConfirmed.value = true;
    } else if (action === 'progress') {
      const data = parseResponse('ReadingProgressResponse', payload).data;
      if (data.contentId !== state.readerTarget.contentId ||
          data.currentSegmentId !== state.readerTarget.segmentIds.at(-1) || !data.isCompleted) {
        throw fail('PILOT-READER completion response was not server-confirmed.');
      }
      state.progressConfirmed.value = true;
    } else if (action === 'review_queue') {
      state.reviewQueue = [...parseResponse('ReviewQueueResponse', payload).data];
    } else if (action === 'today') {
      const data = parseResponse('TodayPlanResponse', payload).data;
      if (data.languageProfileId !== state.profileId) {
        throw fail('PILOT-READER Today plan was not bound to the selected profile.');
      }
      state.todayPlan = data;
    }
    state.actions.push(action);
    await route.fulfill({
      status: result.response.status,
      headers: safeResponseHeaders(state.config.githubSha),
      body: JSON.stringify(payload),
    });
  } catch {
    await rejectPilotRequest(route, state);
  }
}

function sameSnapshot(before: K2RetainedSnapshot, after: K2RetainedSnapshot): void {
  assertK2RetainedStateUnchanged(before, after);
}

function assertSavedConceptLineage(snapshotValue: K2RetainedSnapshot): void {
  requireSnapshotCounts(snapshotValue, {
    concept_save_intents: 1,
    fsrs_states: 1,
    review_events: 0,
    review_items: 1,
    user_saved_concepts: 1,
    user_skill_states: 3,
  });
}

function getConceptDetail(
  config: K2HostedConfig,
  token: string,
  conceptId: string,
): Promise<K2ConceptDetail> {
  return requestK2HostedApi(config, token, `/v1/concepts/${conceptId}`)
    .then(result => parseResponse('ConceptResponse', result.payload).data);
}

async function clearBrowserState(context: BrowserContext, page?: Page): Promise<void> {
  for (const currentPage of new Set([...(page ? [page] : []), ...context.pages()])) {
    try {
      await currentPage.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch { /* The page may not have reached a storage-enabled origin. */ }
  }
  try { await context.clearCookies(); } catch { /* The context may already be closing. */ }
}

async function readerTitleIsVisible(page: Page, title: string): Promise<boolean> {
  const headings = await page.getByRole('heading').allTextContents();
  return headings.some(value => value.trim() === title);
}

async function sentenceTranslationIsVisible(
  page: Page,
  sentenceIndex: number,
  translation: string,
): Promise<boolean> {
  const paragraphs = await page.getByTestId('reader-sentence').nth(sentenceIndex)
    .locator('p').allTextContents();
  return paragraphs.some(value => value.trim() === translation);
}

async function clickReaderConceptButton(
  page: Page,
  sentenceIndex: number,
  surfaceText: string,
): Promise<void> {
  const buttons = page.getByTestId('reader-sentence').nth(sentenceIndex).getByRole('button');
  const labels = await buttons.allTextContents();
  const buttonIndex = labels.findIndex(value => value.includes(surfaceText));
  if (buttonIndex < 0) throw fail('PILOT-READER selected annotation was not an interactive Reader control.');
  await buttons.nth(buttonIndex).click();
}

async function verifyActorGone(config: K2HostedConfig, actorId: string): Promise<void> {
  const result = await runK2HostedProbe('actor_absent', config.readonlyDatabaseUrl, actorId);
  assertZeroActorSnapshot(snapshot(result));
}

/** Executes the fixed Reader lifecycle only after the actorless publication pin succeeds. */
export async function runPilotReaderHostedAcceptance(
  config: K2HostedConfig,
  browser: Browser,
  page: Page,
): Promise<void> {
  if (config.supabaseProjectRef !== K2_HOSTED_STAGING_SUPABASE_REF) {
    throw fail('PILOT-READER staging project binding was invalid.');
  }

  const admin = createK2AdminClient(config) as unknown as K2AdminClient;
  const baseContext = page.context();
  const learnerClients: K2LearnerClient[] = [];
  const identities: K2FreshActorIdentity[] = [];
  const contexts: BrowserContext[] = [baseContext];
  let secondContext: BrowserContext | undefined;
  let baseline: K2RetainedSnapshot | undefined;
  let cleanupFailed = false;
  let cleanupEligible = false;

  try {
    await verifyK2HostedCurrentMasterSha(config);
    const deploymentOrigin = await verifyK2HostedDeploymentAttestations(config);
    const initialTrustedToken = await createGithubTrustedSourceToken(config);
    const vercelOrigin = await verifyProtectedVercelOrigin(
      deploymentOrigin, initialTrustedToken, config.githubSha,
    );
    await verifyK2StagingApiHealth(config.apiOrigin, config.githubSha);
    const migration = await runK2HostedProbe('migrations', config.readonlyDatabaseUrl);
    if (!('appMigrationHead' in migration) ||
        migration.appMigrationHead !== K2_APPROVED_APP_MIGRATION_HEAD) {
      throw fail('PILOT-READER staging migration head was not approved.');
    }

    const candidate = await loadPilotReaderCandidateFiles();
    const catalogResult = await runK2HostedProbe(
      'pilot_reader_catalog_manifest', config.readonlyDatabaseUrl,
    );
    if (!('contentId' in catalogResult)) {
      throw fail('PILOT-READER actorless catalog proof was unavailable.');
    }
    const contentId = assertPilotReaderCatalogProof(catalogResult, candidate);

    cleanupEligible = true;
    await reapExpiredK2Actors(
      config, admin, Date.now(), actorId => verifyActorGone(config, actorId),
      { allowSameRunUnmarked: config },
    );
    await cleanupK2RunActors(config, admin, actorId => verifyActorGone(config, actorId));
    await assertNoK2ActorsRemain(config, admin);
    baseline = await retainedSnapshot(config);

    const actorRuns: ActorRun[] = [];
    for (let index = 0; index < 2; index += 1) {
      const actor = await createK2HostedActor(config, admin, identity => identities.push(identity));
      await verifyK2FreshActorOwnership(config, actor, admin);
      const learner = createK2LearnerClient(config) as unknown as K2LearnerClient;
      learnerClients.push(learner);
      const session = await authenticateK2HostedActor(actor, config, learner);
      const beforeProfile = await actorSnapshot(config, actor.id);
      assertZeroActorSnapshot(beforeProfile);
      const profileId = await createLearnerProfile(config, session, true);
      const afterProfile = await actorSnapshot(config, actor.id);
      assertFreshProfileSnapshot(afterProfile);
      actorRuns.push({ actor, learner, session, profileId });
    }

    await verifyK2HostedCurrentMasterSha(config);
    const browserTrustedToken = await createGithubTrustedSourceToken(config);
    const reattestedOrigin = await verifyProtectedVercelOrigin(
      deploymentOrigin, browserTrustedToken, config.githubSha,
    );
    if (reattestedOrigin !== vercelOrigin) {
      throw fail('PILOT-READER protected Reader origin changed after actor bootstrap.');
    }
    const trustedSource = createK2TrustedSourceTokenSupplier(
      browserTrustedToken, () => createGithubTrustedSourceToken(config),
    );

    const actorA = actorRuns[0];
    const actorB = actorRuns[1];
    if (!actorA || !actorB) throw fail('PILOT-READER two-actor setup was incomplete.');
    const stateA = createPilotRouteState(
      config, vercelOrigin, actorA.actor.id, actorA.profileId, candidate, contentId,
    );
    await installK2BrowserRequestGuard(
      baseContext,
      { vercelOrigin, supabaseUrl: config.supabaseUrl },
      trustedSource,
      route => forwardPilotReaderRequest(route, stateA),
    );
    stateA.token = await signInK2BrowserActor(
      page, actorA.actor, config.supabaseUrl, config.publishableKey, vercelOrigin,
    );

    await openRequestedReader(page, stateA);
    await expect.poll(() => readerTitleIsVisible(page, candidate.title), { timeout: 30_000 }).toBe(true);
    await expect(page.getByTestId('reader-sentence')).toHaveCount(72);
    if (stateA.actions.filter(action => action === 'content').length !== 1) {
      throw fail('PILOT-READER requested Reader route did not use one pinned content GET.');
    }

    const revealIndex = stateA.readerTarget.revealSentenceIndex;
    const revealPair = candidate.pairs[revealIndex];
    const revealStateBefore = await actorSnapshot(config, actorA.actor.id);
    const actionsBeforeReveal = [...stateA.actions];
    if (!revealPair) throw fail('PILOT-READER pinned translation sample was unavailable.');
    await page.getByTestId('reader-sentence').nth(revealIndex)
      .getByRole('button', { name: 'Xem nghĩa câu', exact: true }).click();
    await expect.poll(() => sentenceTranslationIsVisible(page, revealIndex, revealPair.vietnamese),
      { timeout: 30_000 }).toBe(true);
    const revealStateAfter = await actorSnapshot(config, actorA.actor.id);
    sameSnapshot(revealStateBefore, revealStateAfter);
    if (JSON.stringify(actionsBeforeReveal) !== JSON.stringify(stateA.actions)) {
      throw fail('PILOT-READER meaning reveal caused an API request.');
    }

    const annotation = stateA.readerTarget.selectedAnnotation;
    if (!annotation) throw fail('PILOT-READER reviewed annotation sample was unavailable.');
    stateA.lookupArmed.value = true;
    await clickReaderConceptButton(page, annotation.segmentIndex, annotation.surfaceText);
    await expect(page.getByRole('dialog', { name: 'Chi tiết từ vựng' })).toBeVisible();
    await expect.poll(() => stateA.lookupExposureConfirmed.value, { timeout: 60_000 }).toBe(true);
    await expect.poll(() => stateA.conceptReadConfirmed.value, { timeout: 60_000 }).toBe(true);
    const beforeSave = await actorSnapshot(config, actorA.actor.id);
    const preSaveConcept = await getConceptDetail(
      config, stateA.token, annotation.conceptId,
    );
    const saveButton = page.getByRole('button', { name: 'Lưu vào ôn tập', exact: true });
    await saveButton.click();
    await expect.poll(() => stateA.saveFailureObserved.value, { timeout: 30_000 }).toBe(true);
    await expect(page.getByText('Thao tác chưa hoàn tất. Vui lòng thử lại.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xem từ đến hạn ôn', exact: true })).toHaveCount(0);
    if (stateA.saveConfirmed.value || stateA.progressConfirmed.value) {
      throw fail('PILOT-READER failed concept Save advanced Reader state.');
    }
    sameSnapshot(beforeSave, await actorSnapshot(config, actorA.actor.id));

    await saveButton.click();
    await expect(page.getByRole('link', { name: 'Xem từ đến hạn ôn', exact: true })).toBeVisible();
    await expect.poll(() => stateA.saveConfirmed.value, { timeout: 60_000 }).toBe(true);
    stateA.lookupArmed.value = false;
    const afterSave = await actorSnapshot(config, actorA.actor.id);
    assertSavedConceptLineage(afterSave);
    const postSaveConcept = await getConceptDetail(
      config, stateA.token, annotation.conceptId,
    );
    assertConceptCompetenceUnchanged(preSaveConcept, postSaveConcept);
    if (!postSaveConcept.learner.memory) {
      throw fail('PILOT-READER saved concept did not expose its existing primary memory lineage.');
    }

    const replayedSave = await requestK2HostedApi(
      config, stateA.token, `/v1/library/concepts/${annotation.conceptId}`, { method: 'PUT' },
    );
    const replayedSaveResult = parseResponse('LibraryMutationResponse', replayedSave.payload).data;
    if (replayedSaveResult.id !== annotation.conceptId || replayedSaveResult.isSaved !== true) {
      throw fail('PILOT-READER exact concept Save replay did not return its canonical saved state.');
    }
    sameSnapshot(afterSave, await actorSnapshot(config, actorA.actor.id));

    await page.getByRole('button', { name: 'Đóng bảng tra từ', exact: true }).click();
    const secondRevealIndex = Math.min(2, candidate.pairs.length - 1);
    const secondRevealPair = candidate.pairs[secondRevealIndex];
    if (!secondRevealPair || secondRevealIndex === revealIndex) {
      throw fail('PILOT-READER second translation sample was unavailable.');
    }
    const actionsBeforeSecondReveal = [...stateA.actions];
    await page.getByTestId('reader-sentence').nth(secondRevealIndex)
      .getByRole('button', { name: 'Xem nghĩa câu', exact: true }).click();
    await expect.poll(() => sentenceTranslationIsVisible(page, secondRevealIndex, secondRevealPair.vietnamese),
      { timeout: 30_000 }).toBe(true);
    sameSnapshot(afterSave, await actorSnapshot(config, actorA.actor.id));
    if (JSON.stringify(actionsBeforeSecondReveal) !== JSON.stringify(stateA.actions)) {
      throw fail('PILOT-READER second meaning reveal caused an API request.');
    }

    if (stateA.actions.includes('review_queue')) {
      throw fail('PILOT-READER Review was requested before the user clicked its link.');
    }
    stateA.reviewClickArmed.value = true;
    await page.getByRole('link', { name: 'Xem từ đến hạn ôn', exact: true }).click();
    await expect.poll(() => stateA.reviewQueue !== undefined, { timeout: 60_000 }).toBe(true);
    if (!Array.isArray(stateA.reviewQueue)) throw fail('PILOT-READER user-clicked Review response was invalid.');
    stateA.reviewClickArmed.value = false;
    await openRequestedReader(page, stateA);
    await expect.poll(() => readerTitleIsVisible(page, candidate.title), { timeout: 30_000 }).toBe(true);
    if (stateA.actions.filter(action => action === 'content').length !== 2) {
      throw fail('PILOT-READER return route did not request the same pinned content exactly once.');
    }

    const finalConceptIds = [...stateA.readerTarget.finalConceptIds].sort();
    if (finalConceptIds.length < 1 || finalConceptIds.includes(annotation.conceptId)) {
      throw fail('PILOT-READER final segment did not have a separate passive concept sample.');
    }
    const finalSegmentIndex = stateA.readerTarget.segmentIds.length - 1;
    if (finalSegmentIndex < 1 || stateA.readerTarget.segmentIds.length !== 72) {
      throw fail('PILOT-READER final segment control was not available.');
    }
    const finalSegmentId = stateA.readerTarget.segmentIds.at(-1);
    if (!finalSegmentId) throw fail('PILOT-READER final segment identity was unavailable.');
    const finalConceptsBefore = await Promise.all(finalConceptIds.map(conceptId =>
      getConceptDetail(config, stateA.token, conceptId)));
    const beforeCompletion = await actorSnapshot(config, actorA.actor.id);
    const completionProofBefore = await readerCompletionProbe(
      config, actorA.actor.id, actorA.profileId, finalConceptIds,
      { phase: 'before', contentId, segmentId: finalSegmentId },
    );
    if (JSON.stringify([...completionProofBefore.eligibleConceptIds].sort()) !==
        JSON.stringify(finalConceptIds)) {
      throw fail('PILOT-READER server final-segment concept set did not match the pinned publication.');
    }
    stateA.completionArmed.value = true;
    await page.getByTestId('reader-segment').nth(finalSegmentIndex)
      .getByRole('button', { name: 'Hoàn thành bài đọc', exact: true }).click();
    await expect.poll(() => stateA.progressConfirmed.value, { timeout: 60_000 }).toBe(true);
    await expect(page.getByRole('link', { name: 'Xem kế hoạch hôm nay', exact: true })).toBeVisible();
    stateA.completionArmed.value = false;
    const afterCompletion = await actorSnapshot(config, actorA.actor.id);
    assertPilotReaderCompletionDeltas(beforeCompletion, afterCompletion, finalConceptIds.length);
    if (!stateA.readExposureId || !stateA.readExposureKey || !stateA.readExposureBody ||
        !stateA.progressKey || !stateA.progressBody ||
        stateA.readExposureAcceptedCount !== finalConceptIds.length) {
      throw fail('PILOT-READER completion replay material was incomplete.');
    }
    const completionProofAfter = await readerCompletionProbe(
      config, actorA.actor.id, actorA.profileId, finalConceptIds,
      {
        phase: 'after', contentId, segmentId: finalSegmentId, exposureId: stateA.readExposureId,
        projectionHeadBefore: {
          stateVersion: completionProofBefore.projectionHead.stateVersion,
          nextIngestionSequence: completionProofBefore.projectionHead.nextIngestionSequence,
        },
      },
      sha256(stateA.readExposureKey),
    );
    assertPilotReaderCompletionProofs(
      completionProofBefore, completionProofAfter, finalConceptIds, stateA.readExposureId,
    );
    requireSnapshotCounts(afterCompletion, {
      concept_save_intents: 1,
      exposure_events: 2,
      fsrs_states: 1,
      learning_events: finalConceptIds.length + 2,
      reader_exposure_concepts: finalConceptIds.length + 1,
      reader_mutation_results: 1,
      review_events: 0,
      review_items: 1,
      today_activity_review_items: 0,
      today_plan_activities: 0,
      today_plans: 0,
      user_saved_concepts: 1,
      user_skill_states: 3,
      user_concept_states: finalConceptIds.length + 1,
      user_content_progress: 1,
    });
    const finalConceptsAfter = await Promise.all(finalConceptIds.map(conceptId =>
      getConceptDetail(config, stateA.token, conceptId)));
    for (let index = 0; index < finalConceptIds.length; index += 1) {
      const conceptBefore = finalConceptsBefore[index];
      const conceptAfter = finalConceptsAfter[index];
      if (!conceptBefore || !conceptAfter) throw fail('PILOT-READER concept proof was incomplete.');
      assertPassiveConceptTransition(conceptBefore, conceptAfter);
    }

    const exposureReplay = await requestK2HostedApi(
      config, stateA.token, '/v1/reader/exposures',
      { method: 'POST', idempotencyKey: stateA.readExposureKey, body: stateA.readExposureBody },
    );
    const replayedExposure = parseResponse('ReaderExposureResponse', exposureReplay.payload).data;
    assertPilotReaderExposureReplay({
      exposureId: stateA.readExposureId,
      contentId,
      segmentId: finalSegmentId,
      exposureType: 'read',
      acceptedConceptCount: stateA.readExposureAcceptedCount,
    }, replayedExposure);
    const progressReplay = await requestK2HostedApi(
      config, stateA.token, `/v1/reader/progress/${contentId}`,
      {
        method: 'PUT', idempotencyKey: stateA.progressKey, body: stateA.progressBody,
      },
    );
    const replayedProgress = parseResponse('ReadingProgressResponse', progressReplay.payload).data;
    if (replayedProgress.contentId !== contentId || !replayedProgress.isCompleted ||
        replayedProgress.currentSegmentId !== stateA.readerTarget.segmentIds.at(-1)) {
      throw fail('PILOT-READER completed progress replay did not match its original result.');
    }
    sameSnapshot(afterCompletion, await actorSnapshot(config, actorA.actor.id));

    if (stateA.actions.includes('today')) {
      throw fail('PILOT-READER Today was requested before the user clicked its link.');
    }
    const beforeTodayA = await actorSnapshot(config, actorA.actor.id);
    sameSnapshot(afterCompletion, beforeTodayA);
    stateA.todayClickArmed.value = true;
    await page.getByRole('link', { name: 'Xem kế hoạch hôm nay', exact: true }).click();
    await expect.poll(() => stateA.todayPlan !== undefined, { timeout: 60_000 }).toBe(true);
    await expect(page.getByRole('heading', { name: 'Kế hoạch của bạn', exact: true })).toBeVisible();
    if (!stateA.todayPlan || stateA.todayPlan.languageProfileId !== actorA.profileId) {
      throw fail('PILOT-READER user-clicked Today response was not bound to actor A.');
    }
    assertPilotReaderTodayDeltas(
      beforeTodayA, await actorSnapshot(config, actorA.actor.id), stateA.todayPlan,
    );
    stateA.todayClickArmed.value = false;

    await clearBrowserState(baseContext, page);
    await actorA.learner.auth.signOut({ scope: 'global' });
    stateA.token = '';

    secondContext = await browser.newContext({ serviceWorkers: 'block' });
    contexts.push(secondContext);
    const pageB = await secondContext.newPage();
    const stateB = createPilotRouteState(
      config, vercelOrigin, actorB.actor.id, actorB.profileId, candidate, contentId,
    );
    await installK2BrowserRequestGuard(
      secondContext,
      { vercelOrigin, supabaseUrl: config.supabaseUrl },
      trustedSource,
      route => forwardPilotReaderRequest(route, stateB),
    );
    stateB.token = await signInK2BrowserActor(
      pageB, actorB.actor, config.supabaseUrl, config.publishableKey, vercelOrigin,
    );
    const beforeReaderB = await actorSnapshot(config, actorB.actor.id);
    assertFreshProfileSnapshot(beforeReaderB);
    await openRequestedReader(pageB, stateB);
    await expect.poll(() => readerTitleIsVisible(pageB, candidate.title), { timeout: 30_000 }).toBe(true);
    await expect(pageB.getByTestId('reader-sentence')).toHaveCount(72);
    if (stateB.actions.filter(action => action === 'content').length !== 1) {
      throw fail('PILOT-READER actor B route did not request exactly one pinned content identity.');
    }
    const revealButtonB = pageB.getByTestId('reader-sentence').nth(revealIndex)
      .getByRole('button', { name: 'Xem nghĩa câu', exact: true });
    await expect(revealButtonB).toHaveAttribute('aria-expanded', 'false');
    const afterReaderB = await actorSnapshot(config, actorB.actor.id);
    sameSnapshot(beforeReaderB, afterReaderB);

    const libraryB = parseResponse('LibraryItemsResponse', (await requestK2HostedApi(
      config, stateB.token, '/v1/library/items?itemType=concept&limit=100',
    )).payload).data;
    if (libraryB.length !== 0) throw fail('PILOT-READER actor B inherited a saved concept.');
    const reviewB = parseResponse('ReviewQueueResponse', (await requestK2HostedApi(
      config, stateB.token, `/v1/review/queue?languageProfileId=${actorB.profileId}&limit=100`,
    )).payload).data;
    if (reviewB.some(item => item.concept.id === annotation.conceptId)) {
      throw fail('PILOT-READER actor B Review queue exposed actor A saved state.');
    }
    const beforeTodayB = await actorSnapshot(config, actorB.actor.id);
    const todayB = parseResponse('TodayPlanResponse', (await requestK2HostedApi(
      config, stateB.token, '/v1/today',
    )).payload).data;
    if (todayB.languageProfileId !== actorB.profileId || todayB.id === stateA.todayPlan.id ||
        todayB.activities.some(activity => activity.conceptId === annotation.conceptId)) {
      throw fail('PILOT-READER actor B Today plan was not isolated from actor A.');
    }
    const afterBReadOnlyChecks = await actorSnapshot(config, actorB.actor.id);
    assertPilotReaderTodayDeltas(beforeTodayB, afterBReadOnlyChecks, todayB);
    requireSnapshotCounts(afterBReadOnlyChecks, {
      concept_save_intents: 0,
      exposure_events: 0,
      fsrs_states: 0,
      learning_events: 0,
      reader_exposure_concepts: 0,
      reader_mutation_results: 0,
      review_events: 0,
      review_items: 0,
      user_saved_concepts: 0,
      user_concept_states: 0,
      user_content_progress: 0,
      user_skill_states: 0,
      today_plans: 1,
      today_plan_activities: todayB.activities.length,
      today_activity_review_items: todayB.activities
        .filter(activity => activity.activityType === 'review')
        .reduce((count, activity) => count + (activity.targetCount ?? 0), 0),
    });
    if (stateA.failed.value || stateB.failed.value) {
      throw fail('PILOT-READER browser request guard rejected a required lifecycle route.');
    }
  } finally {
    for (const context of contexts) await clearBrowserState(context, context === baseContext ? page : undefined);
    for (const learner of learnerClients) {
      try { await learner.auth.signOut({ scope: 'global' }); }
      catch { cleanupFailed = true; }
    }
    if (secondContext) {
      try { await secondContext.close(); } catch { cleanupFailed = true; }
    }
    if (cleanupEligible) {
      try {
        await cleanupK2RunActors(config, admin, actorId => verifyActorGone(config, actorId));
      } catch { cleanupFailed = true; }
      for (const identity of identities) {
        try {
          await cleanupFreshK2HostedActorIdentity(
            config, identity, admin, actorId => verifyActorGone(config, actorId),
          );
        } catch { cleanupFailed = true; }
        try { await assertK2HostedAuthAbsent(admin, identity.id); }
        catch { cleanupFailed = true; }
        try { await verifyActorGone(config, identity.id); }
        catch { cleanupFailed = true; }
      }
      try { await assertNoK2ActorsRemain(config, admin); }
      catch { cleanupFailed = true; }
    }
    if (baseline) {
      try { assertK2RetainedStateUnchanged(baseline, await retainedSnapshot(config)); }
      catch { cleanupFailed = true; }
    }
    if (cleanupFailed) {
      throw fail('PILOT-READER Auth cleanup, 27-table zero-residue proof, or retained-state comparison failed.');
    }
  }

}
