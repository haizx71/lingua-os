/**
 * TypeScript client for observational PostgresLearnerProbe.
 * Runs python -m postgres_probe with credentials safely passed via process environment.
 * Never logs credentials, connection strings, or secrets.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export interface LearnerFsrsStateRecord {
  readonly review_item_id: string;
  readonly state: string;
  readonly state_version: number;
  readonly last_review_at: string | null;
  readonly due_at: string | null;
  readonly stability: number | null;
  readonly difficulty: number | null;
  readonly step?: number | null;
  readonly scheduled_days?: number;
  readonly reps?: number;
  readonly lapses?: number;
}

export interface LearnerLearningEventRecord {
  readonly learning_event_id: string;
  readonly id?: string;
  readonly event_type: string;
  readonly source_type: string;
  readonly source_event_id: string;
  readonly ingestion_sequence: number;
  readonly created_at: string;
}

export interface LearnerConceptStateRecord {
  readonly status: string;
  readonly state_version: number;
  readonly has_learning_intent: boolean;
  readonly has_projectable_evidence: boolean;
  readonly mastery?: number | null;
  readonly mastery_score?: number | null;
  readonly confidence: number;
  readonly recognition?: number;
  readonly recognition_score?: number;
  readonly listening?: number;
  readonly listening_score?: number;
  readonly production?: number;
  readonly production_score?: number;
  readonly recognition_evidence_count?: number;
  readonly listening_evidence_count?: number;
  readonly production_evidence_count?: number;
}

export interface LearnerTodayPlanRecord {
  readonly id: string;
  readonly plan_date: string;
  readonly local_date?: string;
  readonly time_zone: string;
  readonly engine_version: string;
  readonly as_of: string;
}

export interface LearnerTodayActivityRecord {
  readonly id: string;
  readonly plan_id: string;
  readonly activity_type: string;
  readonly position: number;
  readonly estimated_minutes: number;
  readonly reason_codes: string[];
  readonly concept_id?: string | null;
  readonly content_id?: string | null;
  readonly review_item_id?: string | null;
  readonly status: string;
  readonly target_count?: number;
  readonly completed_count?: number;
}

export interface LearnerReviewEventRecord {
  readonly id: string;
  readonly review_item_id: string;
  readonly idempotency_key: string;
  readonly rating: string;
  readonly response_time_ms: number;
  readonly request_fingerprint: string;
  readonly created_at: string;
  readonly has_memory_snapshot: boolean;
  readonly has_competence_snapshot: boolean;
  readonly result_memory_snapshot?: Record<string, unknown> | null;
  readonly result_competence_snapshot?: Record<string, unknown> | null;
  readonly result_remaining_due_count?: number | null;
  readonly result_feedback?: string | null;
}

export interface LearnerStateDigest {
  readonly user_id: string;
  readonly concept_id: string;
  readonly user_exists: boolean;
  readonly profile_time_zone: string | null;
  readonly language_profile_ids: string[];
  readonly is_concept_saved: boolean;
  readonly save_intent_count: number;
  readonly save_intent_ids: string[];
  readonly review_item_count: number;
  readonly review_item_ids: string[];
  readonly fsrs_state_count: number;
  readonly fsrs_states: LearnerFsrsStateRecord[];
  readonly learning_event_count: number;
  readonly learning_events: LearnerLearningEventRecord[];
  readonly review_event_count: number;
  readonly review_events: LearnerReviewEventRecord[];
  readonly concept_state: LearnerConceptStateRecord | null;
  readonly skill_states: Array<Record<string, unknown>>;
  readonly today_plan_count: number;
  readonly today_plan_ids: string[];
  readonly today_activity_review_item_ids: string[];
  readonly today_plans?: LearnerTodayPlanRecord[];
  readonly today_activities?: LearnerTodayActivityRecord[];
}


export async function captureLearnerDigestFromPostgres(
  userId: string,
  conceptId: string,
  options: { readonly databaseUrl?: string } = {}
): Promise<LearnerStateDigest> {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'postgres_probe.py');
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.databaseUrl) {
    env.DATABASE_URL = options.databaseUrl;
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('captureLearnerDigestFromPostgres failed: DATABASE_URL is missing or empty.');
  }

  // Pass only userId and conceptId; DATABASE_URL is read from env to prevent secret leaks in process table
  const { stdout, stderr } = await execFileAsync(
    pythonBin,
    [probeScript, userId, conceptId],
    { env }
  );

  if (stderr && stderr.trim() !== '') {
    if (stderr.toLowerCase().includes('error')) {
      throw new Error(`Postgres probe error: ${stderr.trim()}`);
    }
  }

  try {
    return JSON.parse(stdout) as LearnerStateDigest;
  } catch (err) {
    throw new Error(
      `Failed to parse postgres probe JSON output: ${(err as Error).message}\nRaw stdout: ${stdout}`
    );
  }
}

export interface PostgresTeardownResult {
  readonly user_id: string;
  readonly status: string;
  readonly used_replica_role?: boolean;
  readonly deleted_users?: number;
  readonly deleted_intents?: number;
  readonly deleted_profile_mutations?: number;
  readonly deleted_learning_events?: number;
}

export interface PostgresCleanupVerificationResult {
  readonly user_id: string;
  readonly clean: boolean;
  readonly counts: {
    readonly users: number;
    readonly learner_profiles: number;
    readonly user_languages: number;
    readonly review_items: number;
    readonly fsrs_states: number;
    readonly learning_events: number;
    readonly concept_save_intents: number;
    readonly profile_mutation_results: number;
    readonly user_concept_states: number;
    readonly user_saved_concepts: number;
    readonly today_plans?: number;
    readonly today_plan_activities?: number;
    readonly today_activity_review_items?: number;
    readonly review_events?: number;
  };
  readonly anchor_concept_intact: boolean;
}

export async function teardownDisposableLearnerPostgres(
  userId: string,
  options: { readonly databaseUrl?: string } = {}
): Promise<PostgresTeardownResult> {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'postgres_probe.py');
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.databaseUrl) {
    env.DATABASE_URL = options.databaseUrl;
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('teardownDisposableLearnerPostgres failed: DATABASE_URL is missing or empty.');
  }

  const { stdout, stderr } = await execFileAsync(
    pythonBin,
    [probeScript, '--teardown', userId],
    { env }
  );

  if (stderr && stderr.trim() !== '') {
    if (stderr.toLowerCase().includes('error')) {
      throw new Error(`Postgres teardown error: ${stderr.trim()}`);
    }
  }

  try {
    return JSON.parse(stdout) as PostgresTeardownResult;
  } catch (err) {
    throw new Error(
      `Failed to parse postgres teardown JSON output: ${(err as Error).message}\nRaw stdout: ${stdout}`
    );
  }
}

export async function verifyLearnerCleanupFromPostgres(
  userId: string,
  anchorConceptId?: string,
  options: { readonly databaseUrl?: string } = {}
): Promise<PostgresCleanupVerificationResult> {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'postgres_probe.py');
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.databaseUrl) {
    env.DATABASE_URL = options.databaseUrl;
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('verifyLearnerCleanupFromPostgres failed: DATABASE_URL is missing or empty.');
  }

  const args = anchorConceptId
    ? [probeScript, '--verify-cleanup', userId, anchorConceptId]
    : [probeScript, '--verify-cleanup', userId];

  const { stdout, stderr } = await execFileAsync(
    pythonBin,
    args,
    { env }
  );

  if (stderr && stderr.trim() !== '') {
    if (stderr.toLowerCase().includes('error')) {
      throw new Error(`Postgres verify cleanup error: ${stderr.trim()}`);
    }
  }

  try {
    return JSON.parse(stdout) as PostgresCleanupVerificationResult;
  } catch (err) {
    throw new Error(
      `Failed to parse postgres verify cleanup JSON output: ${(err as Error).message}\nRaw stdout: ${stdout}`
    );
  }
}

export interface PostgresOrphanRecoveryResult {
  readonly user_id: string;
  readonly status: string;
  readonly clean: boolean;
  readonly counts: {
    readonly users: number;
    readonly learner_profiles: number;
    readonly user_languages: number;
    readonly review_items: number;
    readonly fsrs_states: number;
    readonly learning_events: number;
    readonly concept_save_intents: number;
    readonly profile_mutation_results: number;
    readonly user_concept_states: number;
    readonly user_saved_concepts: number;
    readonly today_plans?: number;
    readonly today_plan_activities?: number;
    readonly today_activity_review_items?: number;
    readonly review_events?: number;
  };
}

export async function recoverOrphanedLearnerPostgres(
  userId: string,
  options: { readonly databaseUrl?: string } = {}
): Promise<PostgresOrphanRecoveryResult> {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const probeScript = path.resolve(__dirname, 'postgres_probe.py');
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.databaseUrl) {
    env.DATABASE_URL = options.databaseUrl;
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('recoverOrphanedLearnerPostgres failed: DATABASE_URL is missing or empty.');
  }

  const { stdout, stderr } = await execFileAsync(
    pythonBin,
    [probeScript, '--recover-orphan', userId],
    { env }
  );

  if (stderr && stderr.trim() !== '') {
    if (stderr.toLowerCase().includes('error')) {
      throw new Error(`Postgres orphan recovery error: ${stderr.trim()}`);
    }
  }

  try {
    return JSON.parse(stdout) as PostgresOrphanRecoveryResult;
  } catch (err) {
    throw new Error(
      `Failed to parse postgres orphan recovery JSON output: ${(err as Error).message}\nRaw stdout: ${stdout}`
    );
  }
}

