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
  | 'migrations'
  | 'actor_absent'
  | 'anchor_material';
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
export type K2HostedProbeResult =
  | K2RetainedSnapshot
  | K2HostedAnchorMaterial
  | K2HostedActorLineageProof
  | { readonly appMigrationHead: '0019'; readonly appliedMigrations: 19 };

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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
): NodeJS.ProcessEnv {
  return {
    PATH: systemEnv.PATH,
    ...(systemEnv.PGSSLROOTCERT ? { PGSSLROOTCERT: systemEnv.PGSSLROOTCERT } : {}),
    K2_STAGING_READONLY_DATABASE_URL: databaseUrl,
    K2_ACCEPTANCE_PROBE_ACTION: action,
    ...(actorId ? { K2_ACCEPTANCE_ACTOR_ID: actorId } : {}),
    ...(process.platform === 'win32' && systemEnv.SystemRoot
      ? { SystemRoot: systemEnv.SystemRoot }
      : {}),
  };
}

export async function runK2HostedProbe(
  action: K2ProbeAction,
  databaseUrl: string,
  actorId?: string,
): Promise<K2HostedProbeResult> {
  if (!databaseUrl.trim()) {
    throw new Error('K2 hosted acceptance read-only probe configuration is missing.');
  }
  if ((action === 'actor_snapshot' || action === 'actor_lineage' || action === 'actor_absent') &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId ?? '')) {
    throw new Error('K2 hosted acceptance actor probe requires a canonical actor identity.');
  }
  if (action !== 'actor_snapshot' && action !== 'actor_lineage' && action !== 'actor_absent' && actorId !== undefined) {
    throw new Error('K2 hosted acceptance probe refused an unexpected actor identity.');
  }

  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'k2_hosted_probe.py');
  const childEnv = buildK2ProbeChildEnvironment(action, databaseUrl, actorId);

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
  if (action === 'anchor_material') return parseK2HostedAnchorMaterial(value);
  if (!value || typeof value !== 'object') {
    throw new Error('K2 hosted acceptance migration probe returned invalid output.');
  }
  const migration = value as { appMigrationHead?: unknown; appliedMigrations?: unknown };
  if (migration.appMigrationHead !== '0019' || migration.appliedMigrations !== 19) {
    throw new Error('K2 hosted acceptance staging migration head does not match the accepted K2-07 source.');
  }
  return { appMigrationHead: '0019', appliedMigrations: 19 };
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
