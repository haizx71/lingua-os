/**
 * First Real Learning Loop (FRLL) - Phase B Acceptance Runner.
 *
 * Implements the deterministic sequence for:
 * B1. Provision disposable Supabase actor
 * B2. Authenticate with real email/password via standard Supabase auth flow
 * B3. Obtain real access token without logging credentials
 * B4. Call FastAPI GET /v1/me and assert actor parity
 * B5. Create/update required vi->en profile + timezone
 * B6. Confirm profile readiness
 * B7. Discover deterministic anchor concept through dictionary + assert zero derived state
 * B8. Call PUT /v1/library/concepts/{conceptId}
 * B9. Observational PostgreSQL probe proving exactly one Memory lineage (COUNT = 1)
 * B10. Repeat Save/Learn proving idempotence, identity preservation, and zero reset
 * Cleanup. Delete disposable Supabase user through Admin API.
 */

import { randomUUID } from 'node:crypto';
import {
  createDisposableSupabaseUser,
  authenticateDisposableLearner,
  deleteDisposableSupabaseUser,
  verifyDisposableUserDeletedFromAuth,
} from './supabase_users';
import {
  captureLearnerDigestFromPostgres,
  teardownDisposableLearnerPostgres,
  verifyLearnerCleanupFromPostgres,
  type LearnerStateDigest,
  type PostgresCleanupVerificationResult,
} from './postgres_probe_client';

export const FRLL_ANCHOR_CONCEPT_ID = '7f110000-0000-4000-8000-000000000004';
export const FRLL_ANCHOR_LEMMA = 'frll-anchor';

export interface ParsedMeResponse {
  id: string;
  email: string | null;
  displayName: string | null;
  interfaceLanguageCode: string;
  timeZone: string | null;
  languageProfiles: Array<{ id: string }>;
  createdAt: string;
  updatedAt: string;
}

export function parseMeResponse(json: unknown): ParsedMeResponse {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/me response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /v1/me response: data is not an object');
  }
  const d = data as Record<string, unknown>;
  if (typeof d.id !== 'string') {
    throw new Error('Invalid /v1/me response: missing or invalid data.id');
  }
  return {
    id: d.id,
    email: typeof d.email === 'string' ? d.email : null,
    displayName: typeof d.displayName === 'string' ? d.displayName : null,
    interfaceLanguageCode: typeof d.interfaceLanguageCode === 'string' ? d.interfaceLanguageCode : 'en',
    timeZone: typeof d.timeZone === 'string' ? d.timeZone : null,
    languageProfiles: Array.isArray(d.languageProfiles) ? (d.languageProfiles as Array<{ id: string }>) : [],
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
  };
}

export interface ParsedConceptSummary {
  readonly id: string;
  readonly canonicalForm: string;
  readonly lemma?: string;
}

export function parseDictionarySearchResponse(json: unknown): ParsedConceptSummary[] {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/dictionary/search response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  let rawItems: unknown[] | null = null;
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (
    data &&
    typeof data === 'object' &&
    'items' in data &&
    Array.isArray((data as Record<string, unknown>).items)
  ) {
    rawItems = (data as { items: unknown[] }).items;
  }
  if (!rawItems) {
    throw new Error('Invalid /v1/dictionary/search response: data is neither an array nor an object with items');
  }
  return rawItems.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const id = typeof it.id === 'string' ? it.id : '';
    const canonicalForm =
      typeof it.canonicalForm === 'string'
        ? it.canonicalForm
        : typeof it.lemma === 'string'
          ? it.lemma
          : '';
    const lemma =
      typeof it.lemma === 'string'
        ? it.lemma
        : typeof it.canonicalForm === 'string'
          ? it.canonicalForm
          : undefined;
    return { id, canonicalForm, lemma };
  });
}

export interface PhaseBOptions {
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly goal?: string;
  readonly dailyMinutes?: number;
}

export interface PhaseBCleanupReport {
  readonly authDeleted: boolean;
  readonly postgresClean: boolean;
  readonly postgresDetails: PostgresCleanupVerificationResult;
}

export type FrllCleanupReport = PhaseBCleanupReport;

export function isTeardownVerified(
  report: PhaseBCleanupReport | undefined | null
): boolean {
  if (!report) return false;
  return Boolean(
    report.authDeleted === true &&
      report.postgresClean === true &&
      report.postgresDetails &&
      report.postgresDetails.clean === true &&
      report.postgresDetails.anchor_concept_intact === true
  );
}

export interface PhaseBReport {
  readonly success: boolean;
  readonly userId: string;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly preSaveDigest: LearnerStateDigest;
  readonly postSaveDigest: LearnerStateDigest;
  readonly postResaveDigest: LearnerStateDigest;
  readonly firstSaveTimestamp: string;
  readonly secondSaveTimestamp: string;
  readonly durationMs: number;
  readonly cleanupVerified: boolean;
  readonly cleanupReport?: PhaseBCleanupReport;
}
export interface SetupRealLearnerOptions {
  readonly tag?: string;
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly goal?: string;
  readonly dailyMinutes?: number;
  readonly onUserCreated?: (userId: string) => void;
}

export interface RealLearnerContext {
  readonly user: { id: string; email: string; password?: string };
  readonly session: { accessToken: string; userId: string };
  readonly authHeaders: Record<string, string>;
  readonly me: ParsedMeResponse;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly firstSaveTimestamp: string;
  readonly preSaveDigest: LearnerStateDigest;
  readonly postSaveDigest: LearnerStateDigest;
  readonly apiBaseUrl: string;
  readonly reviewItemId: string;
}

export async function setupRealLearnerThroughSaveLearn(
  options: SetupRealLearnerOptions = {}
): Promise<RealLearnerContext> {
  const apiBaseUrl = (
    options.apiBaseUrl ??
    process.env.API_BASE_URL ??
    'http://127.0.0.1:8000'
  ).replace(/\/+$/, '');
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;
  const targetLanguageCode = options.targetLanguageCode ?? 'en';
  const nativeLanguageCode = options.nativeLanguageCode ?? 'vi';
  const timeZone = options.timeZone ?? 'Asia/Ho_Chi_Minh';
  const goal = options.goal ?? 'communication';
  const dailyMinutes = options.dailyMinutes ?? 15;
  const tag = options.tag ?? 'frll';

  // -------------------------------------------------------------------------
  // 1. Provision disposable Supabase actor
  // -------------------------------------------------------------------------
  console.log(`[Setup][1/8] Provisioning disposable Supabase test user (${tag})...`);
  const user = await createDisposableSupabaseUser({ tag });
  options.onUserCreated?.(user.id);
  console.log(`  [OK] Provisioned actor UUID: ${user.id}`);

  // -------------------------------------------------------------------------
  // 2. Authenticate with real email/password & obtain real access token
  // -------------------------------------------------------------------------
  console.log('[Setup][2/8] Authenticating via standard Supabase learner auth flow...');
  const session = await authenticateDisposableLearner({
    email: user.email,
    password: user.password,
  });

  if (!session.accessToken || session.accessToken.trim() === '') {
    throw new Error('FRLL-01 failure: Real access token is empty or missing.');
  }
  if (session.userId !== user.id) {
    throw new Error(
      `FRLL-01 failure: Authenticated session userId (${session.userId}) != created userId (${user.id}).`
    );
  }
  console.log('  [OK] Successfully authenticated. Real JWT bearer token acquired.');

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // -------------------------------------------------------------------------
  // 3. Call FastAPI GET /v1/me and assert actor parity
  // -------------------------------------------------------------------------
  console.log('[Setup][3/8] Calling FastAPI GET /v1/me...');
  const meRes = await fetch(`${apiBaseUrl}/v1/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (meRes.status !== 200) {
    const errorBody = await meRes.text();
    throw new Error(
      `FRLL-01 failure: GET /v1/me returned HTTP ${meRes.status} (expected 200). Body: ${errorBody}`
    );
  }

  const rawMeJson = await meRes.json();
  const me = parseMeResponse(rawMeJson);

  if (me.id !== user.id) {
    throw new Error(
      `FRLL-02 identity parity failure: /v1/me data.id (${me.id}) != JWT subject (${user.id}).`
    );
  }

  let currentEtag = meRes.headers.get('etag');
  console.log(`  [OK] Identity parity verified. FastApi resolved subject: ${me.id}`);

  // -------------------------------------------------------------------------
  // 4. Create/update required vi->en profile + timezone using existing API
  // -------------------------------------------------------------------------
  console.log(`[Setup][4/8] Ensuring persisted timezone is '${timeZone}'...`);
  if (me.timeZone !== timeZone) {
    const patchHeaders: Record<string, string> = { ...authHeaders };
    if (currentEtag) {
      patchHeaders['If-Match'] = currentEtag;
    }

    const patchRes = await fetch(`${apiBaseUrl}/v1/me`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify({ timeZone }),
    });

    if (patchRes.status !== 200) {
      const patchError = await patchRes.text();
      throw new Error(
        `PATCH /v1/me failed with HTTP ${patchRes.status}. Body: ${patchError}`
      );
    }
    currentEtag = patchRes.headers.get('etag');
    console.log(`  [OK] Timezone persisted: ${timeZone}`);
  } else {
    console.log(`  [OK] Timezone already set to: ${timeZone}`);
  }

  console.log('[Setup][5/8] Creating active vi -> en language profile...');
  const listRes = await fetch(`${apiBaseUrl}/v1/me/languages`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (listRes.status !== 200) {
    throw new Error(`GET /v1/me/languages failed with HTTP ${listRes.status}`);
  }
  const listData = (await listRes.json()) as { data: Array<{ id: string }> };
  if (listData.data.length !== 0) {
    throw new Error(
      `FRLL-03 failure: Fresh actor has ${listData.data.length} language profiles (expected 0).`
    );
  }

  const idempotencyKey = randomUUID();
  const createRes = await fetch(`${apiBaseUrl}/v1/me/languages`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      targetLanguageCode,
      nativeLanguageCode,
      goal,
      dailyMinutes,
    }),
  });

  if (createRes.status !== 201) {
    const createError = await createRes.text();
    throw new Error(
      `POST /v1/me/languages failed with HTTP ${createRes.status}. Body: ${createError}`
    );
  }

  const createdLanguage = (await createRes.json()) as {
    data: {
      id: string;
      targetLanguageCode: string;
      nativeLanguageCode: string;
    };
  };
  const languageProfileId = createdLanguage.data.id;
  console.log(
    `  [OK] Created language profile: ${languageProfileId} (${nativeLanguageCode} -> ${targetLanguageCode})`
  );

  // Confirm profile readiness
  const confirmRes = await fetch(`${apiBaseUrl}/v1/me/languages`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (confirmRes.status !== 200) {
    throw new Error(`GET /v1/me/languages confirmation failed: ${confirmRes.status}`);
  }
  const confirmData = (await confirmRes.json()) as {
    data: Array<{ id: string; targetLanguageCode: string; nativeLanguageCode: string }>;
  };
  if (confirmData.data.length !== 1 || confirmData.data[0].id !== languageProfileId) {
    throw new Error(
      `FRLL-02 failure: Profile confirmation mismatch. Expected 1 profile (${languageProfileId}), got ${confirmData.data.length}.`
    );
  }
  console.log('  [OK] Profile readiness confirmed.');

  // -------------------------------------------------------------------------
  // 5. Discover deterministic anchor concept through dictionary + read-only check
  // -------------------------------------------------------------------------
  console.log(`[Setup][6/8] Discovering anchor concept '${FRLL_ANCHOR_LEMMA}' via dictionary search...`);
  const searchRes = await fetch(
    `${apiBaseUrl}/v1/dictionary/search?query=${encodeURIComponent(FRLL_ANCHOR_LEMMA)}&languageCode=${encodeURIComponent(targetLanguageCode)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }
  );
  if (searchRes.status !== 200) {
    const searchErr = await searchRes.text();
    throw new Error(`Dictionary search failed with HTTP ${searchRes.status}. Body: ${searchErr}`);
  }
  const rawSearchJson = await searchRes.json();
  const searchItems = parseDictionarySearchResponse(rawSearchJson);
  const foundConcept = searchItems.find((item) => item.id === conceptId);
  if (!foundConcept) {
    throw new Error(
      `FRLL-04 failure: Anchor concept ${conceptId} not found in dictionary search results.`
    );
  }
  console.log(
    `  [OK] Found anchor concept '${foundConcept.canonicalForm || foundConcept.lemma || foundConcept.id}' (${foundConcept.id}).`
  );

  // -------------------------------------------------------------------------
  // 6. Pre-Save observational probe
  // -------------------------------------------------------------------------
  console.log('  Running pre-Save PostgreSQL observational probe (FRLL-03 & FRLL-05)...');
  const preSaveDigest = await captureLearnerDigestFromPostgres(user.id, conceptId);
  if (preSaveDigest.is_concept_saved) {
    throw new Error('FRLL-05 violation: concept is already marked saved prior to explicit Save/Learn.');
  }
  if (preSaveDigest.save_intent_count !== 0) {
    throw new Error(
      `FRLL-03 violation: pre-save save_intent_count is ${preSaveDigest.save_intent_count} (expected 0).`
    );
  }
  if (preSaveDigest.review_item_count !== 0) {
    throw new Error(
      `FRLL-03 violation: pre-save review_item_count is ${preSaveDigest.review_item_count} (expected 0).`
    );
  }
  if (preSaveDigest.fsrs_state_count !== 0) {
    throw new Error(
      `FRLL-03 violation: pre-save fsrs_state_count is ${preSaveDigest.fsrs_state_count} (expected 0).`
    );
  }
  if (preSaveDigest.learning_event_count !== 0) {
    throw new Error(
      `FRLL-03 violation: pre-save learning_event_count is ${preSaveDigest.learning_event_count} (expected 0).`
    );
  }
  if (preSaveDigest.concept_state !== null) {
    throw new Error('FRLL-03 violation: pre-save concept_state exists before explicit Save/Learn.');
  }
  console.log('  [OK] Pre-Save state is clean (0 review items, 0 intents, 0 FSRS rows, 0 learning events).');

  // -------------------------------------------------------------------------
  // 7. Explicit Save/Learn: PUT /v1/library/concepts/{conceptId}
  // -------------------------------------------------------------------------
  console.log(`[Setup][7/8] Executing explicit Save/Learn: PUT /v1/library/concepts/${conceptId}...`);
  const saveRes = await fetch(`${apiBaseUrl}/v1/library/concepts/${conceptId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (saveRes.status !== 200) {
    const saveError = await saveRes.text();
    throw new Error(
      `FRLL-05 failure: PUT /v1/library/concepts/${conceptId} returned HTTP ${saveRes.status}. Body: ${saveError}`
    );
  }

  const saveResult = (await saveRes.json()) as {
    data: {
      id: string;
      itemType: string;
      isSaved: boolean;
      savedAt: string;
    };
  };

  if (!saveResult.data.isSaved || saveResult.data.id !== conceptId) {
    throw new Error(
      `FRLL-05 failure: Invalid Save mutation response: ${JSON.stringify(saveResult)}`
    );
  }
  const firstSaveTimestamp = saveResult.data.savedAt;
  console.log(`  [OK] Concept saved successfully at: ${firstSaveTimestamp}`);

  // -------------------------------------------------------------------------
  // 8. Post-Save observational probe: verifying exactly ONE Memory lineage
  // -------------------------------------------------------------------------
  console.log('[Setup][8/8] Observational PostgreSQL proof: verifying exactly ONE Memory scheduler lineage...');
  const postSaveDigest = await captureLearnerDigestFromPostgres(user.id, conceptId);

  if (!postSaveDigest.user_exists) {
    throw new Error(`FRLL-02 failure: public.users row missing for ${user.id}.`);
  }
  if (postSaveDigest.profile_time_zone !== timeZone) {
    throw new Error(
      `FRLL-02 failure: Profile timezone (${postSaveDigest.profile_time_zone}) != '${timeZone}'.`
    );
  }
  if (!postSaveDigest.is_concept_saved) {
    throw new Error('FRLL-05 failure: user_saved_concepts row not found after Save/Learn.');
  }
  if (postSaveDigest.save_intent_count !== 1) {
    throw new Error(
      `FRLL-05 failure: save_intent_count is ${postSaveDigest.save_intent_count} (expected exactly 1).`
    );
  }
  if (postSaveDigest.review_item_count !== 1) {
    throw new Error(
      `FRLL-06 failure: review_item_count is ${postSaveDigest.review_item_count} (expected exactly 1).`
    );
  }
  if (postSaveDigest.fsrs_state_count !== 1) {
    throw new Error(
      `FRLL-06 failure: fsrs_state_count is ${postSaveDigest.fsrs_state_count} (expected exactly 1).`
    );
  }
  if (postSaveDigest.learning_event_count !== 1) {
    throw new Error(
      `FRLL-05 failure: learning_event_count is ${postSaveDigest.learning_event_count} (expected exactly 1).`
    );
  }
  if (postSaveDigest.review_event_count !== 0) {
    throw new Error(
      `FRLL-06 failure: review_event_count is ${postSaveDigest.review_event_count} (expected 0 before Review).`
    );
  }
  if (!postSaveDigest.concept_state) {
    throw new Error('FRLL-05 failure: user_concept_states missing after Save/Learn.');
  }

  const reviewItemId = postSaveDigest.review_item_ids[0];
  const fsrsState = postSaveDigest.fsrs_states[0];

  if (fsrsState.state !== 'new') {
    throw new Error(`FRLL-06 failure: FSRS state is '${fsrsState.state}' (expected 'new').`);
  }
  if (fsrsState.state_version !== 1) {
    throw new Error(`FRLL-06 failure: FSRS state_version is ${fsrsState.state_version} (expected 1).`);
  }
  if (fsrsState.last_review_at !== null) {
    throw new Error('FRLL-06 failure: FSRS last_review_at must be NULL before first review.');
  }
  if (!fsrsState.due_at) {
    throw new Error('FRLL-06 failure: FSRS due_at is null upon activation (must equal activated_at).');
  }

  console.log(
    `  [OK] Exactly ONE Memory lineage proved: review_item_id=${reviewItemId}, state=new, version=1, due_at=${fsrsState.due_at}`
  );

  return {
    user,
    session,
    authHeaders,
    me,
    languageProfileId,
    conceptId,
    firstSaveTimestamp,
    preSaveDigest,
    postSaveDigest,
    apiBaseUrl,
    reviewItemId,
  };
}

export async function teardownRealLearner(
  userId: string,
  conceptId: string = FRLL_ANCHOR_CONCEPT_ID
): Promise<PhaseBCleanupReport> {
  console.log(`[Cleanup] Tearing down application state for disposable user ${userId}...`);
  const pgTeardown = await teardownDisposableLearnerPostgres(userId);
  console.log(
    `  [OK] PostgreSQL application state torn down (deleted: ${pgTeardown.deleted_users ?? 0} user, ${pgTeardown.deleted_intents ?? 0} intents, ${pgTeardown.deleted_profile_mutations ?? 0} profile mutations).`
  );

  console.log(`[Cleanup] Deleting disposable Supabase Auth user: ${userId}...`);
  await deleteDisposableSupabaseUser({ userId });
  console.log('  [OK] Disposable test user safely deleted from Supabase Auth.');

  console.log('[Cleanup] Verifying complete post-cleanup isolation...');
  const authDeleted = await verifyDisposableUserDeletedFromAuth({ userId });
  if (!authDeleted) {
    throw new Error(
      `Cleanup verification failed: Supabase Auth user ${userId} still exists after delete.`
    );
  }

  const pgVerification = await verifyLearnerCleanupFromPostgres(userId, conceptId);
  if (!pgVerification.clean) {
    throw new Error(
      `Cleanup verification failed: PostgreSQL rows still exist for actor ${userId}: ${JSON.stringify(pgVerification.counts)}`
    );
  }
  if (!pgVerification.anchor_concept_intact) {
    throw new Error('Cleanup safety violation: catalog anchor concept was affected during cleanup.');
  }

  console.log('  [OK] Post-cleanup observational verification passed: 0 auth rows, 0 app rows, catalog intact.');

  return {
    authDeleted,
    postgresClean: pgVerification.clean,
    postgresDetails: pgVerification,
  };
}

export async function runPhaseBLearningLoop(
  options: PhaseBOptions = {}
): Promise<PhaseBReport> {
  const startTime = Date.now();
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;

  let provisionedUserId: string | null = null;
  let resultReport: PhaseBReport | null = null;

  try {
    const context = await setupRealLearnerThroughSaveLearn({
      ...options,
      tag: 'phase-b',
      onUserCreated: (uid) => {
        provisionedUserId = uid;
      },
    });

    // -------------------------------------------------------------------------
    // B10. Repeat Save/Learn and prove no duplicate/reset
    // -------------------------------------------------------------------------
    console.log('[Phase B][10/10] Repeating Save/Learn to prove idempotence and identity preservation...');
    const resaveRes = await fetch(`${context.apiBaseUrl}/v1/library/concepts/${conceptId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${context.session.accessToken}` },
    });

    if (resaveRes.status !== 200) {
      const resaveErr = await resaveRes.text();
      throw new Error(`Repeated PUT /v1/library/concepts failed: ${resaveRes.status}. Body: ${resaveErr}`);
    }

    const resaveResult = (await resaveRes.json()) as {
      data: { isSaved: boolean; savedAt: string };
    };
    if (!resaveResult.data.isSaved) {
      throw new Error(`Repeated Save returned isSaved=false: ${JSON.stringify(resaveResult)}`);
    }
    const secondSaveTimestamp = resaveResult.data.savedAt;

    const postResaveDigest = await captureLearnerDigestFromPostgres(context.user.id, conceptId);

    // Verify invariant preservation: EXACT same review item and FSRS state
    const saveIntentId = context.postSaveDigest.save_intent_ids[0];
    const reviewItemId = context.postSaveDigest.review_item_ids[0];
    const fsrsState = context.postSaveDigest.fsrs_states[0];

    if (postResaveDigest.save_intent_count !== 1) {
      throw new Error(
        `FRLL-06 failure: save_intent_count duplicated on re-save: ${postResaveDigest.save_intent_count}`
      );
    }
    if (postResaveDigest.save_intent_ids[0] !== saveIntentId) {
      throw new Error('FRLL-06 failure: save_intent_id mutated on repeated save.');
    }
    if (postResaveDigest.review_item_count !== 1) {
      throw new Error(
        `FRLL-06 failure: review_item_count duplicated on re-save: ${postResaveDigest.review_item_count}`
      );
    }
    if (postResaveDigest.review_item_ids[0] !== reviewItemId) {
      throw new Error('FRLL-06 failure: review_item_id mutated on repeated save.');
    }
    if (postResaveDigest.fsrs_state_count !== 1) {
      throw new Error(
        `FRLL-06 failure: fsrs_state_count duplicated on re-save: ${postResaveDigest.fsrs_state_count}`
      );
    }
    const resaveFsrsState = postResaveDigest.fsrs_states[0];
    if (resaveFsrsState.state_version !== 1) {
      throw new Error(
        `FRLL-06 failure: FSRS state_version reset or mutated on re-save: ${resaveFsrsState.state_version}`
      );
    }
    if (resaveFsrsState.due_at !== fsrsState.due_at) {
      throw new Error(
        `FRLL-06 failure: FSRS due_at mutated on re-save: ${resaveFsrsState.due_at} != ${fsrsState.due_at}`
      );
    }
    if (postResaveDigest.learning_event_count !== 1) {
      throw new Error(
        `FRLL-06 failure: learning_event_count duplicated on re-save: ${postResaveDigest.learning_event_count}`
      );
    }

    console.log('  [OK] Idempotence verified: Zero duplicate rows, zero state reset, stable Memory lineage preserved.');

    const durationMs = Date.now() - startTime;
    resultReport = {
      success: true,
      userId: context.user.id,
      languageProfileId: context.languageProfileId,
      conceptId,
      preSaveDigest: context.preSaveDigest,
      postSaveDigest: context.postSaveDigest,
      postResaveDigest,
      firstSaveTimestamp: context.firstSaveTimestamp,
      secondSaveTimestamp,
      durationMs,
      cleanupVerified: false,
    };
  } finally {
    if (provisionedUserId) {
      try {
        const cleanupReport = await teardownRealLearner(provisionedUserId, conceptId);
        const cleanupVerified = isTeardownVerified(cleanupReport);
        if (resultReport) {
          resultReport = {
            ...resultReport,
            cleanupVerified,
            cleanupReport,
          };
        }
      } catch (cleanupErr) {
        console.error(
          `  [FAIL] Post-scenario cleanup failed for ${provisionedUserId}: ${(cleanupErr as Error).message}`
        );
        if (resultReport) {
          throw new Error(`FRLL Phase B cleanup failure: ${(cleanupErr as Error).message}`);
        }
        throw cleanupErr;
      }
    }
  }

  return resultReport!;
}

