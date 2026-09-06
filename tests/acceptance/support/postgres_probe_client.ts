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
  readonly scheduled_days: number;
  readonly reps: number;
  readonly lapses: number;
}

export interface LearnerLearningEventRecord {
  readonly id: string;
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
  readonly mastery_score: number | null;
  readonly confidence: number;
  readonly recognition_score: number;
  readonly listening_score: number;
  readonly production_score: number;
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
  readonly review_events: Array<Record<string, unknown>>;
  readonly concept_state: LearnerConceptStateRecord | null;
  readonly skill_states: Array<Record<string, unknown>>;
  readonly today_plan_count: number;
  readonly today_plan_ids: string[];
  readonly today_activity_review_item_ids: string[];
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
