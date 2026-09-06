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
} from './supabase_users';
import {
  captureLearnerDigestFromPostgres,
  type LearnerStateDigest,
} from './postgres_probe_client';

export const FRLL_ANCHOR_CONCEPT_ID = '7f110000-0000-4000-8000-000000000004';
export const FRLL_ANCHOR_LEMMA = 'frll-anchor';

export interface PhaseBOptions {
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly goal?: string;
  readonly dailyMinutes?: number;
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
}

export async function runPhaseBLearningLoop(
  options: PhaseBOptions = {}
): Promise<PhaseBReport> {
  const startTime = Date.now();
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

  let provisionedUserId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // B1. Provision disposable Supabase actor
    // -------------------------------------------------------------------------
    console.log('[Phase B][1/10] Provisioning disposable Supabase test user...');
    const user = await createDisposableSupabaseUser({ tag: 'phase-b' });
    provisionedUserId = user.id;
    console.log(`  [OK] Provisioned actor UUID: ${user.id}`);

    // -------------------------------------------------------------------------
    // B2 & B3. Authenticate with real email/password & obtain real access token
    // -------------------------------------------------------------------------
    console.log('[Phase B][2/10] Authenticating via standard Supabase learner auth flow...');
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
    // B4. Call FastAPI GET /v1/me and assert actor parity
    // -------------------------------------------------------------------------
    console.log('[Phase B][3/10] Calling FastAPI GET /v1/me...');
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

    const meData = (await meRes.json()) as {
      data: {
        user: { id: string; email?: string };
        profile: { timeZone?: string | null };
      };
    };

    if (meData.data.user.id !== user.id) {
      throw new Error(
        `FRLL-02 identity parity failure: /v1/me user.id (${meData.data.user.id}) != JWT subject (${user.id}).`
      );
    }

    let currentEtag = meRes.headers.get('etag');
    console.log(`  [OK] Identity parity verified. FastApi resolved subject: ${meData.data.user.id}`);

    // -------------------------------------------------------------------------
    // B5. Create/update required vi->en profile + timezone using existing API
    // -------------------------------------------------------------------------
    console.log(`[Phase B][4/10] Ensuring persisted timezone is '${timeZone}'...`);
    if (meData.data.profile?.timeZone !== timeZone) {
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

    console.log('[Phase B][5/10] Creating active vi -> en language profile...');
    // Verify fresh language profile list is empty
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

    // Create language profile
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
    console.log(`  [OK] Created language profile: ${languageProfileId} (${nativeLanguageCode} -> ${targetLanguageCode})`);

    // -------------------------------------------------------------------------
    // B6. Confirm profile readiness
    // -------------------------------------------------------------------------
    console.log('[Phase B][6/10] Confirming language profile readiness...');
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
    // B7. Discover deterministic anchor concept through dictionary + read-only check
    // -------------------------------------------------------------------------
    console.log(`[Phase B][7/10] Discovering anchor concept '${FRLL_ANCHOR_LEMMA}' via dictionary search...`);
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
    const searchData = (await searchRes.json()) as {
      data: {
        items: Array<{ id: string; lemma: string }>;
      };
    };
    const foundConcept = searchData.data.items.find((item) => item.id === conceptId);
    if (!foundConcept) {
      throw new Error(
        `FRLL-04 failure: Anchor concept ${conceptId} not found in dictionary search results.`
      );
    }
    console.log(`  [OK] Found anchor concept '${foundConcept.lemma}' (${foundConcept.id}).`);

    // Observational check BEFORE Save: zero evidence created by discovery
    console.log('  Running pre-Save PostgreSQL observational probe (FRLL-03 & FRLL-05)...');
    const preSaveDigest = await captureLearnerDigestFromPostgres(user.id, conceptId);
    if (preSaveDigest.is_concept_saved) {
      throw new Error('FRLL-05 violation: concept is already marked saved prior to explicit Save/Learn.');
    }
    if (preSaveDigest.save_intent_count !== 0) {
      throw new Error(`FRLL-03 violation: pre-save save_intent_count is ${preSaveDigest.save_intent_count} (expected 0).`);
    }
    if (preSaveDigest.review_item_count !== 0) {
      throw new Error(`FRLL-03 violation: pre-save review_item_count is ${preSaveDigest.review_item_count} (expected 0).`);
    }
    if (preSaveDigest.fsrs_state_count !== 0) {
      throw new Error(`FRLL-03 violation: pre-save fsrs_state_count is ${preSaveDigest.fsrs_state_count} (expected 0).`);
    }
    if (preSaveDigest.learning_event_count !== 0) {
      throw new Error(`FRLL-03 violation: pre-save learning_event_count is ${preSaveDigest.learning_event_count} (expected 0).`);
    }
    if (preSaveDigest.concept_state !== null) {
      throw new Error('FRLL-03 violation: pre-save concept_state exists before explicit Save/Learn.');
    }
    console.log('  [OK] Pre-Save state is clean (0 review items, 0 intents, 0 FSRS rows, 0 learning events).');

    // -------------------------------------------------------------------------
    // B8. Call PUT /v1/library/concepts/{conceptId}
    // -------------------------------------------------------------------------
    console.log(`[Phase B][8/10] Executing explicit Save/Learn: PUT /v1/library/concepts/${conceptId}...`);
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
    // B9. Read PostgreSQL observationally to prove exactly one Memory lineage
    // -------------------------------------------------------------------------
    console.log('[Phase B][9/10] Observational PostgreSQL proof: verifying exactly ONE Memory scheduler lineage...');
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
    const saveIntentId = postSaveDigest.save_intent_ids[0];

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

    console.log(`  [OK] Exactly ONE Memory lineage proved: review_item_id=${reviewItemId}, state=new, version=1, due_at=${fsrsState.due_at}`);

    // -------------------------------------------------------------------------
    // B10. Repeat Save/Learn and prove no duplicate/reset
    // -------------------------------------------------------------------------
    console.log('[Phase B][10/10] Repeating Save/Learn to prove idempotence and identity preservation...');
    const resaveRes = await fetch(`${apiBaseUrl}/v1/library/concepts/${conceptId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.accessToken}` },
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

    const postResaveDigest = await captureLearnerDigestFromPostgres(user.id, conceptId);

    // Verify invariant preservation: EXACT same review item and FSRS state
    if (postResaveDigest.save_intent_count !== 1) {
      throw new Error(`FRLL-06 failure: save_intent_count duplicated on re-save: ${postResaveDigest.save_intent_count}`);
    }
    if (postResaveDigest.save_intent_ids[0] !== saveIntentId) {
      throw new Error('FRLL-06 failure: save_intent_id mutated on repeated save.');
    }
    if (postResaveDigest.review_item_count !== 1) {
      throw new Error(`FRLL-06 failure: review_item_count duplicated on re-save: ${postResaveDigest.review_item_count}`);
    }
    if (postResaveDigest.review_item_ids[0] !== reviewItemId) {
      throw new Error('FRLL-06 failure: review_item_id mutated on repeated save.');
    }
    if (postResaveDigest.fsrs_state_count !== 1) {
      throw new Error(`FRLL-06 failure: fsrs_state_count duplicated on re-save: ${postResaveDigest.fsrs_state_count}`);
    }
    const resaveFsrsState = postResaveDigest.fsrs_states[0];
    if (resaveFsrsState.state_version !== 1) {
      throw new Error(`FRLL-06 failure: FSRS state_version reset or mutated on re-save: ${resaveFsrsState.state_version}`);
    }
    if (resaveFsrsState.due_at !== fsrsState.due_at) {
      throw new Error(`FRLL-06 failure: FSRS due_at mutated on re-save: ${resaveFsrsState.due_at} != ${fsrsState.due_at}`);
    }
    if (postResaveDigest.learning_event_count !== 1) {
      throw new Error(`FRLL-06 failure: learning_event_count duplicated on re-save: ${postResaveDigest.learning_event_count}`);
    }

    console.log('  [OK] Idempotence verified: Zero duplicate rows, zero state reset, stable Memory lineage preserved.');

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      userId: user.id,
      languageProfileId,
      conceptId,
      preSaveDigest,
      postSaveDigest,
      postResaveDigest,
      firstSaveTimestamp,
      secondSaveTimestamp,
      durationMs,
    };
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Delete disposable Supabase Auth user (cascading all learner state)
    // -------------------------------------------------------------------------
    if (provisionedUserId) {
      try {
        console.log(`[Phase B][Cleanup] Deleting disposable Supabase user: ${provisionedUserId}...`);
        await deleteDisposableSupabaseUser({ userId: provisionedUserId });
        console.log('  [OK] Disposable test user safely deleted from Supabase Auth.');
      } catch (cleanupErr) {
        console.warn(
          `  [WARN] Failed to delete disposable test user ${provisionedUserId}: ${(cleanupErr as Error).message}`
        );
      }
    }
  }
}
