import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);
const EXPECTED_TABLES = [
  'assessment_attempt_items',
  'assessment_attempts',
  'assessment_idempotency_log',
  'assessment_responses',
  'assessment_results',
  'concept_save_intents',
  'exposure_events',
  'fsrs_states',
  'learner_profiles',
  'learning_events',
  'profile_mutation_results',
  'reader_exposure_concepts',
  'reader_mutation_results',
  'review_events',
  'review_items',
  'today_activity_review_items',
  'today_plan_activities',
  'today_plans',
  'user_concept_states',
  'user_content_progress',
  'user_language_projection_heads',
  'user_languages',
  'user_saved_concepts',
  'user_saved_content',
  'user_saved_sentences',
  'user_skill_states',
  'users',
] as const;

export type K2ProbeAction =
  | 'retained_snapshot'
  | 'actor_snapshot'
  | 'actor_lineage'
  | 'today_review_targets'
  | 'migrations'
  | 'actor_absent'
  | 'anchor_material'
  | 'k208_fixture_privilege_preflight'
  | 'k208_catalog_preflight'
  | 'k208_candidate_base'
  | 'k208_due_candidate_overlap';
export type K2RetainedSnapshot = {
  readonly tables: Readonly<Record<(typeof EXPECTED_TABLES)[number], {
    readonly rows: number;
    readonly sha256: string;
  }>>;
  readonly totalRows: number;
};
export type K2HostedAnchorMaterial = Readonly<{
  hasTranslatedDefinition: boolean;
  hasHttpsAudio: boolean;
  hasPublishedClozeTarget: boolean;
}>;
export type K2HostedActorLineageProof = Readonly<{
  userConceptStateRows: number;
  reviewItemRows: number;
  fsrsStateRows: number;
  recognitionEvidenceCount: number;
  listeningEvidenceCount: number;
  productionEvidenceCount: number;
  productionPositiveMass: string;
  productionNegativeMass: string;
  events: readonly Readonly<{
    exerciseMode: 'self_recall' | 'multiple_choice' | 'typing' | 'cloze' | 'listening';
    evidenceMode: 'recognition' | 'listening' | 'production';
    correct: boolean | null;
    responseTextMatchesAnchor: boolean;
    resultProductionEvidenceCount: number | null;
  }>[];
}>;
export type K2HostedTodayReviewTargets = Readonly<{
  engineVersion: string | null;
  activityCount: number;
  reviewActivityCount: number;
  targetCount: number;
  reviewItemIds: readonly string[];
}>;
export type K2HostedCandidateBaseProof = Readonly<{
  stateConceptIds: readonly string[];
  stateStatuses: readonly Readonly<{
    conceptId: string;
    status: 'unseen' | 'discovered' | 'learning' | 'familiar' | 'active' | 'mastered' | 'weak' | 'forgotten';
    stateVersion: number;
  }>[];
  candidates: readonly Readonly<{
    contentId: string;
    estimatedMinutes: number;
    linkedConceptIds: readonly string[];
    unseenCount: number;
    isSaved: boolean;
    isUnfinished: boolean;
    isCompleted: boolean;
  }>[];
}>;
export const K2_APPROVED_APP_MIGRATION_HEAD = '0020' as const;
const K2_APPROVED_APP_MIGRATION_COUNT = 20 as const;
export type K2HostedProbeResult =
  | K2RetainedSnapshot
  | K2HostedAnchorMaterial
  | K2HostedActorLineageProof
  | K2HostedTodayReviewTargets
  | K2HostedCandidateBaseProof
  | Readonly<{ overlapCount: number }>
  | Readonly<{
      authBoundaryUnchanged: boolean;
      fixtureCapabilityReady: boolean;
      learnerOwnerRlsPolicyBaseline: boolean;
      readerSelectOnly: boolean;
      serviceFixtureAndViewAclBaseline: boolean;
    }>
  | Readonly<{
      eligibleContentCount: number;
      fiveMinuteRemediationCount: number;
      hasNovelControl: boolean;
      sourceRankShapeAvailable: boolean;
    }>
  | {
      readonly appMigrationHead: typeof K2_APPROVED_APP_MIGRATION_HEAD;
      readonly appliedMigrations: typeof K2_APPROVED_APP_MIGRATION_COUNT;
    };

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseK2HostedCandidateBaseProof(value: unknown): K2HostedCandidateBaseProof {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['candidates', 'stateConceptIds', 'stateStatuses'])) {
    throw new Error('K2 hosted acceptance candidate base proof was invalid.');
  }
  const candidates = (value as { candidates?: unknown }).candidates;
  const stateConceptIds = (value as { stateConceptIds?: unknown }).stateConceptIds;
  const stateStatuses = (value as { stateStatuses?: unknown }).stateStatuses;
  if (!Array.isArray(candidates) || candidates.length > 20 || !Array.isArray(stateConceptIds) ||
      stateConceptIds.length > 80 || stateConceptIds.some(id => typeof id !== 'string' || !UUID_RE.test(id)) ||
      new Set(stateConceptIds).size !== stateConceptIds.length || !Array.isArray(stateStatuses) ||
      stateStatuses.length !== stateConceptIds.length) {
    throw new Error('K2 hosted acceptance candidate base proof was invalid.');
  }
  const allowedStateStatuses = new Set([
    'unseen', 'discovered', 'learning', 'familiar', 'active', 'mastered', 'weak', 'forgotten',
  ]);
  const seenStateConcepts = new Set<string>();
  for (const candidateState of stateStatuses) {
    if (!candidateState || typeof candidateState !== 'object' || Array.isArray(candidateState) ||
        JSON.stringify(Object.keys(candidateState).sort()) !== JSON.stringify(['conceptId', 'stateVersion', 'status'])) {
      throw new Error('K2 hosted acceptance candidate base proof was invalid.');
    }
    const state = candidateState as Record<string, unknown>;
    if (typeof state.conceptId !== 'string' || !UUID_RE.test(state.conceptId) ||
        seenStateConcepts.has(state.conceptId) || !stateConceptIds.includes(state.conceptId) ||
        typeof state.status !== 'string' || !allowedStateStatuses.has(state.status) ||
        !isSafeCount(state.stateVersion) || state.stateVersion < 1) {
      throw new Error('K2 hosted acceptance candidate base proof was invalid.');
    }
    seenStateConcepts.add(state.conceptId);
  }
  if (seenStateConcepts.size !== stateConceptIds.length ||
      stateConceptIds.some(id => !seenStateConcepts.has(id))) {
    throw new Error('K2 hosted acceptance candidate base proof was invalid.');
  }
  const seenContent = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
        JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify([
          'contentId', 'estimatedMinutes', 'isCompleted', 'isSaved', 'isUnfinished',
          'linkedConceptIds', 'unseenCount',
        ])) {
      throw new Error('K2 hosted acceptance candidate base proof was invalid.');
    }
    const row = candidate as Record<string, unknown>;
    if (typeof row.contentId !== 'string' || !UUID_RE.test(row.contentId) || seenContent.has(row.contentId) ||
        !isSafeCount(row.estimatedMinutes) || row.estimatedMinutes > 1440 ||
        !Array.isArray(row.linkedConceptIds) || row.linkedConceptIds.length > 100 ||
        row.linkedConceptIds.some(id => typeof id !== 'string' || !UUID_RE.test(id)) ||
        new Set(row.linkedConceptIds).size !== row.linkedConceptIds.length ||
        !isSafeCount(row.unseenCount) || row.unseenCount > row.linkedConceptIds.length ||
        typeof row.isSaved !== 'boolean' || typeof row.isUnfinished !== 'boolean' ||
        typeof row.isCompleted !== 'boolean') {
      throw new Error('K2 hosted acceptance candidate base proof was invalid.');
    }
    seenContent.add(row.contentId);
  }
  return value as K2HostedCandidateBaseProof;
}

export function parseK2HostedDueCandidateOverlap(value: unknown): Readonly<{ overlapCount: number }> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['overlapCount'])) {
    throw new Error('K2 hosted acceptance due-content membership proof was invalid.');
  }
  const overlapCount = (value as { overlapCount?: unknown }).overlapCount;
  if (!isSafeCount(overlapCount) || overlapCount > 20) {
    throw new Error('K2 hosted acceptance due-content membership proof was invalid.');
  }
  return { overlapCount };
}

export function parseK2HostedFixtureCapability(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([
        'authBoundaryUnchanged', 'fixtureCapabilityReady', 'learnerOwnerRlsPolicyBaseline',
        'readerSelectOnly', 'serviceFixtureAndViewAclBaseline',
      ]) || Object.values(value).some(item => typeof item !== 'boolean')) {
    throw new Error('K2 hosted acceptance fixture privilege proof was invalid.');
  }
  return value as {
    authBoundaryUnchanged: boolean;
    fixtureCapabilityReady: boolean;
    learnerOwnerRlsPolicyBaseline: boolean;
    readerSelectOnly: boolean;
    serviceFixtureAndViewAclBaseline: boolean;
  };
}

export function parseK2HostedCatalogPreflight(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([
        'eligibleContentCount', 'fiveMinuteRemediationCount', 'hasNovelControl', 'sourceRankShapeAvailable',
      ])) {
    throw new Error('K2 hosted acceptance content catalog proof was invalid.');
  }
  const row = value as Record<string, unknown>;
  if (!isSafeCount(row.eligibleContentCount) || !isSafeCount(row.fiveMinuteRemediationCount) ||
      typeof row.hasNovelControl !== 'boolean' || typeof row.sourceRankShapeAvailable !== 'boolean') {
    throw new Error('K2 hosted acceptance content catalog proof was invalid.');
  }
  return value as {
    eligibleContentCount: number;
    fiveMinuteRemediationCount: number;
    hasNovelControl: boolean;
    sourceRankShapeAvailable: boolean;
  };
}

function parseSnapshot(value: unknown, requireVisibleRetainedLearners: boolean): K2RetainedSnapshot {
  if (!value || typeof value !== 'object' || !('tables' in value) || !('totalRows' in value)) {
    throw new Error('K2 hosted acceptance retained-state probe returned an invalid snapshot.');
  }
  const tables = (value as { tables?: unknown }).tables;
  const totalRows = (value as { totalRows?: unknown }).totalRows;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables) || !isSafeCount(totalRows)) {
    throw new Error('K2 hosted acceptance retained-state probe returned an invalid snapshot.');
  }
  const names = Object.keys(tables).sort();
  if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_TABLES].sort())) {
    throw new Error('K2 hosted acceptance retained-state probe returned an incomplete table inventory.');
  }
  let countedRows = 0;
  for (const name of EXPECTED_TABLES) {
    const table = (tables as Record<string, unknown>)[name];
    if (!table || typeof table !== 'object') {
      throw new Error('K2 hosted acceptance retained-state probe returned an invalid table digest.');
    }
    const record = table as { rows?: unknown; sha256?: unknown };
    if (!isSafeCount(record.rows) || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error('K2 hosted acceptance retained-state probe returned an invalid table digest.');
    }
    countedRows += record.rows;
  }
  if (countedRows !== totalRows) {
    throw new Error('K2 hosted acceptance retained-state probe returned inconsistent row counts.');
  }
  const snapshot = value as K2RetainedSnapshot;
  if (requireVisibleRetainedLearners &&
      (snapshot.tables.users.rows === 0 || snapshot.tables.learner_profiles.rows === 0)) {
    throw new Error('K2 hosted acceptance read-only snapshot could not prove retained learner visibility.');
  }
  return snapshot;
}

export function parseK2HostedAnchorMaterial(value: unknown): K2HostedAnchorMaterial {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('K2 hosted acceptance canonical material proof was invalid.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.hasTranslatedDefinition !== 'boolean' ||
      typeof record.hasHttpsAudio !== 'boolean' ||
      typeof record.hasPublishedClozeTarget !== 'boolean') {
    throw new Error('K2 hosted acceptance canonical material proof was invalid.');
  }
  return record as K2HostedAnchorMaterial;
}

export function parseK2HostedMigrationProof(value: unknown): {
  readonly appMigrationHead: typeof K2_APPROVED_APP_MIGRATION_HEAD;
  readonly appliedMigrations: typeof K2_APPROVED_APP_MIGRATION_COUNT;
} {
  if (!value || typeof value !== 'object') {
    throw new Error('K2 hosted acceptance migration probe returned invalid output.');
  }
  const migration = value as { appMigrationHead?: unknown; appliedMigrations?: unknown };
  if (
    migration.appMigrationHead !== K2_APPROVED_APP_MIGRATION_HEAD ||
    migration.appliedMigrations !== K2_APPROVED_APP_MIGRATION_COUNT
  ) {
    throw new Error('K2 hosted acceptance staging migration head does not match the accepted Today schema source.');
  }
  return {
    appMigrationHead: K2_APPROVED_APP_MIGRATION_HEAD,
    appliedMigrations: K2_APPROVED_APP_MIGRATION_COUNT,
  };
}

export function parseK2HostedTodayReviewTargets(value: unknown): K2HostedTodayReviewTargets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('K2 hosted acceptance Today target probe returned invalid output.');
  }
  const record = value as Record<string, unknown>;
  const countFields = ['activityCount', 'reviewActivityCount', 'targetCount'] as const;
  if (!(record.engineVersion === null || typeof record.engineVersion === 'string') ||
      countFields.some(field => !isSafeCount(record[field])) ||
      (record.activityCount as number) > 20 ||
      (record.reviewActivityCount as number) > 1 ||
      (record.targetCount as number) > 181 ||
      !Array.isArray(record.reviewItemIds) || record.reviewItemIds.length !== record.targetCount ||
      record.reviewItemIds.length > 181 ||
      record.reviewItemIds.some(id => typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) ||
      new Set(record.reviewItemIds).size !== record.reviewItemIds.length) {
    throw new Error('K2 hosted acceptance Today target probe returned invalid output.');
  }
  if (record.engineVersion === null &&
      (record.activityCount !== 0 || record.reviewActivityCount !== 0 ||
       record.targetCount !== 0 || record.reviewItemIds.length !== 0)) {
    throw new Error('K2 hosted acceptance Today target probe returned invalid output.');
  }
  return record as unknown as K2HostedTodayReviewTargets;
}

export function parseK2HostedActorLineage(value: unknown): K2HostedActorLineageProof {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('K2 hosted acceptance actor lineage proof was invalid.');
  }
  const record = value as Record<string, unknown>;
  const countFields = [
    'userConceptStateRows', 'reviewItemRows', 'fsrsStateRows',
    'recognitionEvidenceCount', 'listeningEvidenceCount', 'productionEvidenceCount',
  ] as const;
  if (countFields.some(field => !isSafeCount(record[field])) ||
      typeof record.productionPositiveMass !== 'string' ||
      !/^\d+(?:\.\d+)?$/.test(record.productionPositiveMass) ||
      typeof record.productionNegativeMass !== 'string' ||
      !/^\d+(?:\.\d+)?$/.test(record.productionNegativeMass) ||
      !Array.isArray(record.events) || record.events.length > 10) {
    throw new Error('K2 hosted acceptance actor lineage proof was invalid.');
  }
  const exerciseModes = new Set(['self_recall', 'multiple_choice', 'typing', 'cloze', 'listening']);
  const evidenceModes = new Set(['recognition', 'listening', 'production']);
  for (const rawEvent of record.events) {
    if (!rawEvent || typeof rawEvent !== 'object' || Array.isArray(rawEvent)) {
      throw new Error('K2 hosted acceptance actor lineage proof was invalid.');
    }
    const event = rawEvent as Record<string, unknown>;
    if (typeof event.exerciseMode !== 'string' || !exerciseModes.has(event.exerciseMode) ||
        typeof event.evidenceMode !== 'string' || !evidenceModes.has(event.evidenceMode) ||
        !(typeof event.correct === 'boolean' || event.correct === null) ||
        typeof event.responseTextMatchesAnchor !== 'boolean' ||
        !(isSafeCount(event.resultProductionEvidenceCount) || event.resultProductionEvidenceCount === null)) {
      throw new Error('K2 hosted acceptance actor lineage proof was invalid.');
    }
  }
  return record as unknown as K2HostedActorLineageProof;
}

export function parseK2RetainedSnapshot(value: unknown): K2RetainedSnapshot {
  return parseSnapshot(value, true);
}

export function parseK2ActorSnapshot(value: unknown): K2RetainedSnapshot {
  return parseSnapshot(value, false);
}

export function buildK2ProbeChildEnvironment(
  action: K2ProbeAction,
  databaseUrl: string,
  actorId?: string,
  systemEnv: NodeJS.ProcessEnv = process.env,
  profileId?: string,
  conceptIds?: readonly string[],
): NodeJS.ProcessEnv {
  const exactActorProfileAction = action === 'k208_candidate_base' || action === 'k208_due_candidate_overlap';
  if ((exactActorProfileAction && (!UUID_RE.test(actorId ?? '') || !UUID_RE.test(profileId ?? ''))) ||
      (!exactActorProfileAction && (profileId !== undefined || conceptIds !== undefined))) {
    throw new Error('K2 hosted acceptance candidate probe requires the exact fresh actor and profile binding.');
  }
  if (action === 'k208_due_candidate_overlap') {
    if (!conceptIds || conceptIds.length !== 20 || conceptIds.some(id => !UUID_RE.test(id)) ||
        new Set(conceptIds).size !== 20) {
      throw new Error('K2 hosted acceptance due membership probe requires exactly twenty unique concepts.');
    }
  } else if (conceptIds !== undefined) {
    throw new Error('K2 hosted acceptance probe refused an unexpected concept set.');
  }
  return {
    PATH: systemEnv.PATH,
    ...(systemEnv.PGSSLROOTCERT ? { PGSSLROOTCERT: systemEnv.PGSSLROOTCERT } : {}),
    K2_STAGING_READONLY_DATABASE_URL: databaseUrl,
    K2_ACCEPTANCE_PROBE_ACTION: action,
    ...(actorId ? { K2_ACCEPTANCE_ACTOR_ID: actorId } : {}),
    ...(profileId ? { K2_ACCEPTANCE_PROFILE_ID: profileId } : {}),
    ...(conceptIds ? { K2_ACCEPTANCE_CONCEPT_IDS: JSON.stringify(conceptIds) } : {}),
    ...(process.platform === 'win32' && systemEnv.SystemRoot
      ? { SystemRoot: systemEnv.SystemRoot }
      : {}),
  };
}

export async function runK2HostedProbe(
  action: K2ProbeAction,
  databaseUrl: string,
  actorId?: string,
  profileId?: string,
  conceptIds?: readonly string[],
): Promise<K2HostedProbeResult> {
  if (!databaseUrl.trim()) {
    throw new Error('K2 hosted acceptance read-only probe configuration is missing.');
  }
  if ((action === 'actor_snapshot' || action === 'actor_lineage' || action === 'actor_absent' ||
       action === 'today_review_targets') &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId ?? '')) {
    throw new Error('K2 hosted acceptance actor probe requires a canonical actor identity.');
  }
  const exactActorProfileAction = action === 'k208_candidate_base' || action === 'k208_due_candidate_overlap';
  if ((exactActorProfileAction &&
       (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId ?? '') ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId ?? ''))) ||
      (!exactActorProfileAction && profileId !== undefined)) {
    throw new Error('K2 hosted acceptance candidate probe requires the exact fresh actor and profile binding.');
  }
  if (action === 'k208_due_candidate_overlap') {
    if (!conceptIds || conceptIds.length !== 20 ||
        conceptIds.some(id => !UUID_RE.test(id)) || new Set(conceptIds).size !== 20) {
      throw new Error('K2 hosted acceptance due membership probe requires exactly twenty unique concepts.');
    }
  } else if (conceptIds !== undefined) {
    throw new Error('K2 hosted acceptance probe refused an unexpected concept set.');
  }
  if (action !== 'actor_snapshot' && action !== 'actor_lineage' && action !== 'actor_absent' &&
       action !== 'today_review_targets' && !exactActorProfileAction && actorId !== undefined) {
    throw new Error('K2 hosted acceptance probe refused an unexpected actor identity.');
  }

  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'k2_hosted_probe.py');
  const childEnv = buildK2ProbeChildEnvironment(
    action, databaseUrl, actorId, process.env, profileId, conceptIds,
  );

  let stdout: string;
  try {
    const result = await execFileAsync(pythonBin, [probeScript], {
      env: childEnv,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    stdout = result.stdout;
  } catch {
    throw new Error('K2 hosted acceptance read-only probe failed; provider details were suppressed.');
  }
  let value: unknown;
  try { value = JSON.parse(stdout); }
  catch { throw new Error('K2 hosted acceptance read-only probe returned invalid output.'); }

  if (action === 'retained_snapshot') return parseK2RetainedSnapshot(value);
  if (action === 'actor_snapshot' || action === 'actor_absent') return parseK2ActorSnapshot(value);
  if (action === 'actor_lineage') return parseK2HostedActorLineage(value);
  if (action === 'today_review_targets') return parseK2HostedTodayReviewTargets(value);
  if (action === 'anchor_material') return parseK2HostedAnchorMaterial(value);
  if (action === 'k208_candidate_base') return parseK2HostedCandidateBaseProof(value);
  if (action === 'k208_due_candidate_overlap') return parseK2HostedDueCandidateOverlap(value);
  if (action === 'k208_fixture_privilege_preflight') return parseK2HostedFixtureCapability(value);
  if (action === 'k208_catalog_preflight') return parseK2HostedCatalogPreflight(value);
  return parseK2HostedMigrationProof(value);
}

export function assertK2RetainedStateUnchanged(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
): void {
  for (const table of EXPECTED_TABLES) {
    if (
      before.tables[table].rows !== after.tables[table].rows ||
      before.tables[table].sha256 !== after.tables[table].sha256
    ) {
      throw new Error('K2 hosted acceptance retained learner-state snapshot changed.');
    }
  }
  if (before.totalRows !== after.totalRows) {
    throw new Error('K2 hosted acceptance retained learner-state row count changed.');
  }
}

export function k2RetainedTableNames(): readonly string[] {
  return EXPECTED_TABLES;
}
