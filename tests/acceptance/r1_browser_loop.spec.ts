/**
 * First Real Learning Loop (FRLL) - R1 Real Playwright Browser Proof
 *
 * Implements the complete end-to-end browser loop across product surfaces:
 * R1-A: Real Playwright browser loop (Auth -> Save/Learn -> Today -> Review -> Brain)
 * R1-B: Committed response-loss at browser transport boundary
 * R1-C: Reload and re-entry recovery with same-receipt idempotency retry
 * R1-D: Actor B ownership and late Actor A response isolation
 * R1-E: Passive browser actions produce zero learner-derived state mutations
 * R1-F: Browser rendering and navigation proofs (semantic locators, cards, badges)
 * R1-G: Authoritative backend PostgreSQL evidence correlation
 * R1-H: Fail-closed cleanup verification for disposable actors
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import type { components } from '../../packages/types/src/generated/openapi';
import { randomUUID } from 'node:crypto';
import {
  createDisposableSupabaseUser,
  authenticateDisposableLearner,
  deleteDisposableSupabaseUser,
  verifyDisposableUserDeletedFromAuth,
  type DisposableSupabaseUser,
} from './support/supabase_users';
import {
  captureLearnerDigestFromPostgres,
  teardownDisposableLearnerPostgres,
  verifyLearnerCleanupFromPostgres,
  type LearnerStateDigest,
} from './support/postgres_probe_client';
import { FRLL_ANCHOR_CONCEPT_ID, FRLL_ANCHOR_LEMMA } from './support/phase_b_runner';
import { assertExact, assertPersistedCompetence, assertProjectionNumber } from './support/persisted_assertions';
import { assertReviewPersistence } from './support/review_persistence';
import { assertCleanupEvidence, assertNoLearningMutation, assertSameReceipt } from './support/r1_assertions';
import { validateContract, validateBrowserResponse } from './support/contract_validation';
import { signInSecondBrowserActor } from './support/browser_actor_switch';

// Live Supabase/PostgreSQL runs can legitimately spend several seconds in a
// cold pooler connection before the already-authoritative UI state appears.
// Keep the assertions strict while allowing the transport/readiness boundary
// enough time to settle during an external integration run.
const liveExpect = expect.configure({ timeout: 30_000 });

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

const API_BASE_URL = 'http://127.0.0.1:3005/api';
const boundedFetch: typeof globalThis.fetch = (input, init) =>
  globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(30_000) });

async function cleanupActor(user: DisposableSupabaseUser): Promise<void> {
  await teardownDisposableLearnerPostgres(user.id);
  await deleteDisposableSupabaseUser({ userId: user.id });
  const authDeleted = await verifyDisposableUserDeletedFromAuth({ userId: user.id });
  const pg = await verifyLearnerCleanupFromPostgres(user.id, FRLL_ANCHOR_CONCEPT_ID);
  assertCleanupEvidence(authDeleted, pg);
  const digest = await captureLearnerDigestFromPostgres(user.id, FRLL_ANCHOR_CONCEPT_ID);
  expect(digest.learner_rows).toBeDefined();
  for (const rows of Object.values(digest.learner_rows!)) expect(rows).toEqual([]);
  console.log('R1 cleanup verified: actor=' + user.id + '; all owned tables empty; anchor intact');
}

// All controller requests use the same proxy and a bounded transport deadline.
const fetch = boundedFetch;

let wireChecks: Array<Promise<void>> = [];
let wireFailures: string[] = [];
let wireResponseCount = 0;
function observeBrowserContracts(context: BrowserContext): void {
  // Validate at the response boundary, before a subsequent navigation can make
  // Chromium discard the response body. Deliberately aborted requests do not
  // emit a response and are therefore excluded from this wire-level audit.
  context.on('response', response => {
    const request = response.request();
    const pathname = new URL(response.url()).pathname;
    if (!pathname.startsWith('/api/v1/')) return;
    // The auth shell can navigate away immediately after its bootstrap GET
    // /v1/me, making Chromium discard that body before a context observer can
    // read it. Every R1 actor explicitly validates this DTO in
    // bootstrapLearnerProfile; leave this navigation-only response out of the
    // asynchronous observer while retaining status/schema checks at source.
    if (
      request.method() === 'GET' &&
      (pathname === '/api/v1/me' || pathname === '/api/v1/me/languages')
    ) return;
    wireChecks.push((async () => {
      validateBrowserResponse(request.method(), pathname.slice(4), response.status(), await response.json());
      wireResponseCount += 1;
    })().catch(error => {
      const detail = error instanceof Error ? error.message : 'unknown validation error';
      wireFailures.push(request.method() + ' ' + pathname + ': ' + detail);
    }));
  });
}

/**
 * Bootstraps learner application profile and active vi->en language profile
 * in accordance with frozen FRLL Section 5 requirements.
 */
async function bootstrapLearnerProfile(
  apiBase: string,
  accessToken: string,
  timeZone = 'Asia/Ho_Chi_Minh'
): Promise<{ readonly userId: string; readonly languageProfileId: string }> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // 1. GET /v1/me (bootstraps public.users & learner_profiles)
  const meRes = await fetch(`${apiBase}/v1/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (meRes.status !== 200) {
    throw new Error(`Bootstrap GET /v1/me failed (${meRes.status})`);
  }
  const meData = validateContract('MeResponse', await meRes.json()).data;
  const etag = meRes.headers.get('etag');

  // 2. PATCH /v1/me (ensures persisted timeZone)
  if (meData.timeZone !== timeZone) {
    const patchHeaders: Record<string, string> = { ...authHeaders };
    if (etag) patchHeaders['If-Match'] = etag;
    const patchRes = await fetch(`${apiBase}/v1/me`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify({ timeZone }),
    });
    if (patchRes.status !== 200) {
      throw new Error(`Bootstrap PATCH /v1/me failed (${patchRes.status})`);
    }
    validateContract('MeResponse', await patchRes.json());
  }

  // 3. POST /v1/me/languages (creates active vi->en language profile)
  const createLangRes = await fetch(`${apiBase}/v1/me/languages`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      targetLanguageCode: 'en',
      nativeLanguageCode: 'vi',
      goal: 'communication',
      dailyMinutes: 15,
    }),
  });
  if (createLangRes.status !== 201 && createLangRes.status !== 200) {
    throw new Error(`Bootstrap POST /v1/me/languages failed (${createLangRes.status})`);
  }
  const langData = validateContract('LanguageProfileResponse', await createLangRes.json()).data;

  return {
    userId: meData.id,
    languageProfileId: langData.id,
  };
}

/**
 * Performs real browser login through /auth UI.
 */
async function performBrowserLogin(page: Page, user: DisposableSupabaseUser): Promise<void> {
  await page.goto('/auth');

  // Assert auth form is rendered
  const emailInput = page.locator('#auth-email');
  const passwordInput = page.locator('#auth-password');
  const submitButton = page.locator('button[type="submit"]', { hasText: 'Đăng nhập' });

  await liveExpect(emailInput).toBeVisible();
  await liveExpect(passwordInput).toBeVisible();
  await liveExpect(submitButton).toBeVisible();
  await liveExpect(submitButton).toBeEnabled();

  // Fill real credentials
  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);
  const authenticated = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password';
  }, { timeout: 30_000 });
  await submitButton.click();
  const authResponse = await authenticated;
  expect(authResponse.status()).toBe(200);
  expect((await authResponse.json()).user.id).toBe(user.id);
  // Ready profiles redirect onward to Today immediately; onboarding is not
  // necessarily observable at load. Assert the real authenticated identity above.
  await page.waitForURL(url => ['/onboarding', '/today'].includes(url.pathname), { timeout: 30_000 });
}

// Auth traces include passwords, cookies and bearer headers. Never retain them.
test.use({ trace: 'off', screenshot: 'off' });

test.describe('FRLL R1: Real Browser Learning Loop Scenarios (Playwright E2E)', () => {
  // Real remote auth/SQL plus multiple page transitions exceed a unit-test budget.
  // Individual assertions and network/probe deadlines remain bounded separately.
  test.setTimeout(240_000);
  test.beforeEach(({ context }) => {
    wireChecks = [];
    wireFailures = [];
    wireResponseCount = 0;
    observeBrowserContracts(context);
    if (!hasRealSupabaseEnv || process.env.NEXT_PUBLIC_API_BASE_URL !== '/api') {
      throw new Error('BLOCKED_EXTERNAL_INFRASTRUCTURE: real credentials and canonical proxy required.');
    }
  });

  test.afterEach(async () => {
    await Promise.all(wireChecks);
    expect(wireFailures, 'Completed browser responses must match frozen OpenAPI').toEqual([]);
    expect(wireResponseCount).toBeGreaterThan(0);
  });

  test('R1 primary: successful browser answer receives HTTP 200 and reconciles authoritative state', async ({ page }) => {
    const actor = await createDisposableSupabaseUser({ tag: 'r1-primary' });
    try {
      const session = await authenticateDisposableLearner(actor);
      await performBrowserLogin(page, actor);
      const profile = await bootstrapLearnerProfile(API_BASE_URL, session.accessToken);
      const initial = await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(initial.today_plan_count).toBe(0);
      expect(initial.review_item_count).toBe(0);
      expect(initial.learning_event_count).toBe(0);
      await page.goto('/dictionary');
      await page.locator('input[type="search"]').fill(FRLL_ANCHOR_LEMMA);
      await liveExpect(page.locator('h2', { hasText: FRLL_ANCHOR_LEMMA })).toBeVisible();
      assertNoLearningMutation(initial.learner_rows,
        (await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID)).learner_rows);
      await page.getByRole('button', { name: `Lưu từ ${FRLL_ANCHOR_LEMMA} để học`, exact: true }).click();
      await liveExpect(page.locator(`span[aria-label="Đã lưu từ ${FRLL_ANCHOR_LEMMA} vào kho học"]`)).toBeVisible();
      const saved = await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(saved.review_item_count).toBe(1);
      expect(saved.fsrs_state_count).toBe(1);
      expect(saved.save_intent_count).toBe(1);
      expect(saved.learning_event_count).toBe(1);
      expect(saved.concept_state?.has_projectable_evidence).toBe(false);
      const itemId = saved.fsrs_states[0].review_item_id;
      const repeatSave = await fetch(API_BASE_URL + '/v1/library/concepts/' + FRLL_ANCHOR_CONCEPT_ID, {
        method: 'PUT', headers: { Authorization: 'Bearer ' + session.accessToken },
      });
      expect(repeatSave.status).toBe(200);
      assertExact(await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID), saved, 'Primary repeat-save equality');
      await page.goto('/today');
      await liveExpect(page.locator('h3', { hasText: 'Ôn tập đến hạn' })).toBeVisible();
      const today = await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(today.today_activity_review_item_ids).toContain(itemId);
      assertNoLearningMutation(saved.learner_rows, today.learner_rows, true);
      await page.goto('/review');
      await liveExpect(page.getByRole('heading', { name: FRLL_ANCHOR_LEMMA })).toBeVisible();
      await page.getByRole('button', { name: 'Hiện đáp án & nghĩa' }).click();
      const before = await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID);
      assertNoLearningMutation(today.learner_rows, before.learner_rows);
      const answerPath = '/api/v1/review/' + itemId + '/answer';
      let submissions = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === answerPath) submissions += 1; });
      const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === answerPath);
      await page.getByRole('button', { name: 'Tốt (Good)' }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const answer = validateContract('ReviewAnswerResponse', await response.json()).data;
      const request = validateContract('ReviewAnswerRequest', response.request().postDataJSON());
      expect(request.rating).toBe('good');
      expect(request.responseTimeMs).toBeGreaterThan(0);
      expect(response.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
      await liveExpect(page.getByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!', { exact: true })).toBeVisible();
      expect(submissions).toBe(1);
      expect(await page.evaluate(key => sessionStorage.getItem(key), `lingua.review.pending.v1:${actor.id}:default`)).toBeNull();
      const committed = await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID);
      assertReviewPersistence(answer, before, committed, profile.languageProfileId);
      expect(committed.review_events[0].idempotency_key).toBe(response.request().headers()['idempotency-key']);
      await page.goto('/brain');
      const node = page.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA });
      await liveExpect(node).toBeVisible();
      const brainResponse = page.waitForResponse(result =>
        new URL(result.url()).pathname === '/api/v1/brain/concepts/' + FRLL_ANCHOR_CONCEPT_ID);
      await node.click();
      const brainWire = await brainResponse;
      expect(brainWire.status()).toBe(200);
      const detail = validateContract('BrainConceptResponse', await brainWire.json()).data;
      assertExact(detail.memory, answer.memory, 'Primary Brain Memory');
      assertPersistedCompetence(detail.competence, committed.concept_state!, 'Primary Brain competence');
      expect(detail.evidence.reviewCount).toBe(1);
      await liveExpect(page.getByRole('dialog', { name: 'Chi tiết khái niệm' })).toBeVisible();
      assertExact(await captureLearnerDigestFromPostgres(actor.id, FRLL_ANCHOR_CONCEPT_ID), committed, 'Primary Brain zero writes');
    } finally { await cleanupActor(actor); }
  });

  test('R1-A/B/C/F/G: Canonical Browser Learning Loop with Committed Response-Loss Recovery & Exact Replay', async ({
    page,
  }) => {
    // -------------------------------------------------------------------------
    // Phase 1: Real Auth & Identity Parity
    // -------------------------------------------------------------------------
    const userA = await createDisposableSupabaseUser({ tag: 'r1-canonical' });

    try {
      // Sign in while the profile is unconfigured so the route guard cannot
      // create a same-day Today plan before explicit Save/Learn.
      const sessionA = await authenticateDisposableLearner({
        email: userA.email,
        password: userA.password,
      });
      // Real browser login
      await performBrowserLogin(page, userA);
      const { languageProfileId } = await bootstrapLearnerProfile(API_BASE_URL, sessionA.accessToken);

      // Verify initial PostgreSQL state: exactly zero learner-derived rows
      const preSaveDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(preSaveDigest.review_item_count).toBe(0);
      expect(preSaveDigest.fsrs_state_count).toBe(0);
      expect(preSaveDigest.save_intent_count).toBe(0);
      expect(preSaveDigest.learning_event_count).toBe(0);
      expect(preSaveDigest.today_plan_count).toBe(0);
      expect(preSaveDigest.user_id).toBe(sessionA.userId);
      expect(preSaveDigest.user_exists).toBe(true);
      expect(preSaveDigest.language_profile_ids).toEqual([languageProfileId]);

      // -------------------------------------------------------------------------
      // Phase 2: Real Save/Learn via Dictionary UI
      // -------------------------------------------------------------------------
      await page.goto('/dictionary');

      // Search anchor concept
      const searchInput = page.locator('input[type="search"]');
      await liveExpect(searchInput).toBeVisible();
      await searchInput.fill(FRLL_ANCHOR_LEMMA);

      // Concept card appears
      const termHeading = page.locator('h2', { hasText: FRLL_ANCHOR_LEMMA });
      await liveExpect(termHeading).toBeVisible();
      const passiveDictionary = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertNoLearningMutation(preSaveDigest.learner_rows, passiveDictionary.learner_rows);

      // Click "Lưu để học"
      const saveButton = page.locator(`button[aria-label="Lưu từ ${FRLL_ANCHOR_LEMMA} để học"]`);
      await liveExpect(saveButton).toBeVisible();
      await saveButton.click();

      // Verify UI reflects saved state
      const savedBadge = page.locator(`span[aria-label="Đã lưu từ ${FRLL_ANCHOR_LEMMA} vào kho học"]`);
      await liveExpect(savedBadge).toBeVisible();

      // PostgreSQL verification: exactly one Memory lineage & save event created
      const postSaveDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(postSaveDigest.review_item_count).toBe(1);
      expect(postSaveDigest.fsrs_state_count).toBe(1);
      expect(postSaveDigest.fsrs_states[0].state).toBe('new');
      expect(postSaveDigest.fsrs_states[0].state_version).toBe(1);
      expect(postSaveDigest.fsrs_states[0].due_at).not.toBeNull();
      expect(postSaveDigest.save_intent_count).toBe(1);
      expect(postSaveDigest.learning_event_count).toBe(1);
      expect(postSaveDigest.review_event_count).toBe(0);
      expect(postSaveDigest.concept_state?.status).toBe('learning');
      expect(postSaveDigest.concept_state?.has_projectable_evidence).toBe(false);

      const reviewItemId = postSaveDigest.fsrs_states[0].review_item_id;
      const repeatSave = await fetch(API_BASE_URL + '/v1/library/concepts/' + FRLL_ANCHOR_CONCEPT_ID, {
        method: 'PUT', headers: { Authorization: 'Bearer ' + sessionA.accessToken },
      });
      expect(repeatSave.status).toBe(200);
      assertExact(await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID), postSaveDigest, 'Repeated Save exact persistence');

      // -------------------------------------------------------------------------
      // Phase 3: Real Today via UI
      // -------------------------------------------------------------------------
      await page.goto('/today');

      // Assert Today dashboard rendered
      await liveExpect(page.locator('h1', { hasText: 'Chào buổi sáng' })).toBeVisible();

      // Review activity present with FSRS_DUE reason
      const reviewActivityHeading = page.locator('h3', { hasText: 'Ôn tập đến hạn' });
      await liveExpect(reviewActivityHeading).toBeVisible();

      // Today read creates zero review events
      const todayDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(todayDigest.today_plans).toHaveLength(1);
      expect(todayDigest.review_event_count).toBe(0);
      expect(todayDigest.today_activity_review_item_ids).toContain(reviewItemId);
      assertNoLearningMutation(postSaveDigest.learner_rows, todayDigest.learner_rows, true);

      // -------------------------------------------------------------------------
      // Phase 4: Real Review & Committed Response Loss Simulation (R1-B)
      // -------------------------------------------------------------------------
      await page.goto('/review');

      // Verify Review card renders anchor concept
      await liveExpect(page.getByRole('heading', { name: FRLL_ANCHOR_LEMMA })).toBeVisible();

      // Reveal answer
      const revealBtn = page.locator('button:has-text("Hiện đáp án & nghĩa")');
      await liveExpect(revealBtn).toBeVisible();
      await revealBtn.click();

      // Assert rating buttons are visible
      const goodRatingBtn = page.locator('button:has-text("Tốt (Good)")');
      await liveExpect(goodRatingBtn).toBeVisible();
      const preAnswerDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertNoLearningMutation(todayDigest.learner_rows, preAnswerDigest.learner_rows);

      // Set up route interception for committed response-loss proof
      let answerDispatches = 0;
      let recordedIdempotencyKey: string | null = null;
      let recordedPayload: { rating?: string; responseTimeMs?: number } | null = null;
      const getRecordedPayload = () => validateContract('ReviewAnswerRequest', recordedPayload);
      let upstreamCommittedData: components['schemas']['ReviewAnswerResult'] | null = null;
      let committedBeforeLoss: LearnerStateDigest | null = null;
      let replayData: components['schemas']['ReviewAnswerResult'] | null = null;

      await page.route('**/v1/review/*/answer', async (route) => {
        answerDispatches++;
        const req = route.request();
        const headers = req.headers();
        const body = req.postDataJSON();

        if (answerDispatches === 1) {
          // Record dispatch metadata
          recordedIdempotencyKey = headers['idempotency-key'] ?? null;
          recordedPayload = body;

          // Forward to backend so FastAPI commits the review transaction
          const response = await route.fetch({ timeout: 30_000 });
          expect(response.status()).toBe(200);
          upstreamCommittedData = validateContract('ReviewAnswerResponse', await response.json()).data;
          committedBeforeLoss = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
          expect(committedBeforeLoss.review_event_count).toBe(1);
          expect(committedBeforeLoss.learning_event_count).toBe(2);
          expect(committedBeforeLoss.fsrs_states[0].state_version).toBe(2);
          assertReviewPersistence(upstreamCommittedData, preAnswerDigest, committedBeforeLoss, languageProfileId);

          // Deliberately drop/abort the response to simulate client transport failure
          await route.abort('failed');
        } else {
          // Replay attempt: verify exact same idempotency key and byte-equivalent payload
          expect(headers['idempotency-key']).toBe(recordedIdempotencyKey);
          expect(body.rating).toBe(recordedPayload?.rating);
          expect(body.responseTimeMs).toBe(recordedPayload?.responseTimeMs);
          assertSameReceipt(
            { reviewItemId, idempotencyKey: recordedIdempotencyKey, ...recordedPayload },
            { reviewItemId: req.url().split('/').at(-2), idempotencyKey: headers['idempotency-key'], ...body },
          );

          // Allow replay to reach backend normally
          const replay = await route.fetch({ timeout: 30_000 });
          expect(replay.status()).toBe(200);
          replayData = validateContract('ReviewAnswerResponse', await replay.json()).data;
          assertExact(replayData, upstreamCommittedData, 'Complete raw answer replay');
          await route.fulfill({ response: replay });
        }
      });

      // Submit rating "good" -> triggers first call & response loss
      await goodRatingBtn.click();

      // 1. Browser UI evidence: wait for the aborted response to settle before
      // observing PostgreSQL. The route handler aborts only after route.fetch()
      // has received the committed upstream response; probing earlier would race
      // the in-flight answer request under real network latency.
      await liveExpect(page.locator('text=Lỗi gửi kết quả ôn tập')).toBeVisible();
      const retryBtn = page.locator('button:has-text("Thử lại")');
      await liveExpect(retryBtn).toBeVisible();

      // 2. Authoritative backend evidence: verify the review transaction COMMITTED in PostgreSQL
      const postCommitDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertExact(postCommitDigest, committedBeforeLoss, 'Committed before response loss');
      expect(postCommitDigest.review_event_count).toBe(1);
      expect(postCommitDigest.fsrs_states[0].state_version).toBe(2);
      expect(postCommitDigest.fsrs_states[0].last_review_at).not.toBeNull();
      expect(postCommitDigest.learning_event_count).toBe(2);
      expect(postCommitDigest.concept_state?.production_evidence_count).toBe(1);
      expect(postCommitDigest.concept_state?.has_projectable_evidence).toBe(true);

      // 3. Pending receipt preserved in browser storage
      // Review page uses the server-selected default profile (no query prop),
      // so the LOCAL_ONLY receipt key follows the adapter's `default` scope.
      const receiptStorageKey = `lingua.review.pending.v1:${userA.id}:default`;
      const rawStoredReceipt = await page.evaluate(
        (key) => sessionStorage.getItem(key),
        receiptStorageKey
      );
      expect(rawStoredReceipt).not.toBeNull();
      const storedReceipt = JSON.parse(rawStoredReceipt!);
      expect(storedReceipt.idempotencyKey).toBe(recordedIdempotencyKey);
      expect(storedReceipt.rating).toBe('good');
      expect(storedReceipt.reviewItemId).toBe(reviewItemId);
      expect(storedReceipt.responseTimeMs).toBe(getRecordedPayload().responseTimeMs);

      // -------------------------------------------------------------------------
      // Phase 5: Reload / Re-entry Recovery & Same-Receipt Idempotency Replay (R1-C)
      // -------------------------------------------------------------------------
      // Browser reload simulates user navigating away or refreshing
      await page.reload();

      // Recovery alert survives reload and renders retry action
      await liveExpect(page.locator('text=Lỗi gửi kết quả ôn tập')).toBeVisible();
      const reloadedRetryBtn = page.locator('button:has-text("Thử lại")');
      await liveExpect(reloadedRetryBtn).toBeVisible();
      const restored = await page.evaluate((key) => sessionStorage.getItem(key), receiptStorageKey);
      assertExact(restored, rawStoredReceipt, 'Durable receipt across real reload');

      // Trigger retry with exact same receipt
      await reloadedRetryBtn.click();

      // Wait for replay to complete and UI to reconcile
      await liveExpect(page.locator('text=Đã hoàn thành toàn bộ hàng đợi ôn tập!')).toBeVisible();

      // Verify pending receipt was purged from browser storage after reconciliation
      const receiptAfterReplay = await page.evaluate(
        (key) => sessionStorage.getItem(key),
        receiptStorageKey
      );
      expect(receiptAfterReplay).toBeNull();

      // Authoritative PostgreSQL proof: ZERO duplicate mutations
      const postReplayDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertExact(postReplayDigest, postCommitDigest, 'Replay complete learner digest');
      expect(answerDispatches).toBe(2);
      assertExact(replayData, upstreamCommittedData, 'Replay server result');
      const conflict = await fetch(API_BASE_URL + '/v1/review/' + reviewItemId + '/answer', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + sessionA.accessToken, 'Content-Type': 'application/json', 'Idempotency-Key': recordedIdempotencyKey! },
        body: JSON.stringify({ ...getRecordedPayload(), rating: 'easy' }),
      });
      expect(conflict.status).toBe(409);
      expect(validateContract('ErrorEnvelope', await conflict.json()).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      assertExact(await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID), postReplayDigest, 'Conflict zero mutation');
      expect(postReplayDigest.review_event_count).toBe(1); // Zero duplicate review event
      expect(postReplayDigest.learning_event_count).toBe(2); // Zero duplicate learning event
      expect(postReplayDigest.fsrs_states[0].state_version).toBe(2); // Zero second FSRS transition
      expect(postReplayDigest.concept_state?.production_evidence_count).toBe(1); // Zero duplicate competence update
      assertExact(postReplayDigest.review_events[0].id, postCommitDigest.review_events[0].id, 'Review event ID');

      // -------------------------------------------------------------------------
      // Phase 6: Brain Projection Proof (R1-A, R1-G)
      // -------------------------------------------------------------------------
      const preBrainDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);

      await page.goto('/brain');
      await liveExpect(page.locator('h1', { hasText: 'Language Brain của bạn' })).toBeVisible();

      // Metrics overview shows 1 learning concept
      const learningMetric = page.locator('text=Đang học (Learning)');
      await liveExpect(learningMetric).toBeVisible();

      // Canvas contains anchor concept node
      const conceptNode = page.locator(`button >> text=${FRLL_ANCHOR_LEMMA}`);
      await liveExpect(conceptNode).toBeVisible();

      // Click concept node to open detail drawer
      await conceptNode.click();
      const detailDrawer = page.locator('div[role="dialog"][aria-label="Chi tiết khái niệm"]');
      await liveExpect(detailDrawer).toBeVisible();
      const detailResponse = await fetch(API_BASE_URL + '/v1/brain/concepts/' + FRLL_ANCHOR_CONCEPT_ID, {
        headers: { Authorization: 'Bearer ' + sessionA.accessToken },
      });
      expect(detailResponse.status).toBe(200);
      const detail = validateContract('BrainConceptResponse', await detailResponse.json()).data;
      expect(detail.concept.id).toBe(FRLL_ANCHOR_CONCEPT_ID);
      expect(detail.evidence.reviewCount).toBe(1);
      assertPersistedCompetence(detail.competence, preBrainDigest.concept_state!, 'Brain persisted competence');
      assertProjectionNumber(detail.mastery, preBrainDigest.concept_state!.mastery, 'Brain mastery');
      assertProjectionNumber(detail.confidence, preBrainDigest.concept_state!.confidence, 'Brain confidence');
      assertExact(detail.memory, upstreamCommittedData!.memory, 'Brain Memory');
      await liveExpect(detailDrawer.locator(`h3:has-text("${FRLL_ANCHOR_LEMMA}")`)).toBeVisible();

      // Read-only invariant: Brain GETs performed zero database mutations
      const postBrainDigest = await captureLearnerDigestFromPostgres(userA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertExact(postBrainDigest, preBrainDigest, 'Brain complete zero-write digest');
      assertExact(postBrainDigest.review_item_count, preBrainDigest.review_item_count, 'Brain review_items count');
      assertExact(postBrainDigest.fsrs_states[0].state_version, preBrainDigest.fsrs_states[0].state_version, 'Brain FSRS version');
      assertExact(postBrainDigest.review_event_count, preBrainDigest.review_event_count, 'Brain review_events count');
      assertExact(postBrainDigest.learning_event_count, preBrainDigest.learning_event_count, 'Brain learning_events count');

      // -------------------------------------------------------------------------
      // Phase 7: Fail-Closed Cleanup (R1-H)
      // -------------------------------------------------------------------------
    } finally {
      await cleanupActor(userA);
    }
  });

  test('R1-E: Passive Browser Actions (Brain & Today Reads) Produce Zero Derived-State Mutations', async ({
    page,
  }) => {
    const user = await createDisposableSupabaseUser({ tag: 'r1-passive' });

    try {
      const session = await authenticateDisposableLearner({
        email: user.email,
        password: user.password,
      });
      await bootstrapLearnerProfile(API_BASE_URL, session.accessToken);
      await performBrowserLogin(page, user);
      // Let the authenticated shell finish its initial read-only hydration
      // before taking the passive-state baseline. This avoids racing a late
      // bootstrap read while keeping the learner-state assertions strict.
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

      // Baseline digest before any passive navigation
      const baselineDigest = await captureLearnerDigestFromPostgres(user.id, FRLL_ANCHOR_CONCEPT_ID);

      // 1. Passive Brain Navigation & Interaction
      await page.goto('/brain');
      await liveExpect(page.getByRole('heading', { name: 'Chưa có từ vựng trong Brain' })).toBeVisible();

      // Capture digest after Brain navigation: must be strictly equal
      const afterBrainDigest = await captureLearnerDigestFromPostgres(user.id, FRLL_ANCHOR_CONCEPT_ID);
      assertNoLearningMutation(baselineDigest.learner_rows, afterBrainDigest.learner_rows);
      assertExact(afterBrainDigest.review_item_count, baselineDigest.review_item_count, 'Brain read review_item_count');
      assertExact(afterBrainDigest.fsrs_state_count, baselineDigest.fsrs_state_count, 'Brain read fsrs_state_count');
      assertExact(afterBrainDigest.learning_event_count, baselineDigest.learning_event_count, 'Brain read learning_event_count');
      assertExact(afterBrainDigest.review_event_count, baselineDigest.review_event_count, 'Brain read review_event_count');

      // 2. Passive Today Navigation
      await page.goto('/today');
      await liveExpect(page.getByRole('heading', { name: 'Không có bài học nào cần ôn hôm nay' })).toBeVisible();

      // Capture digest after Today: no review events or FSRS transitions created
      const afterTodayDigest = await captureLearnerDigestFromPostgres(user.id, FRLL_ANCHOR_CONCEPT_ID);
      assertNoLearningMutation(baselineDigest.learner_rows, afterTodayDigest.learner_rows, true);
      assertExact(afterTodayDigest.review_item_count, baselineDigest.review_item_count, 'Today read review_item_count');
      assertExact(afterTodayDigest.fsrs_state_count, baselineDigest.fsrs_state_count, 'Today read fsrs_state_count');
      assertExact(afterTodayDigest.learning_event_count, baselineDigest.learning_event_count, 'Today read learning_event_count');
      assertExact(afterTodayDigest.review_event_count, baselineDigest.review_event_count, 'Today read review_event_count');

      // Cleanup
    } finally {
      await cleanupActor(user);
    }
  });

  test('R1-D: Actor B Ownership Isolation & Late Actor A Response Boundary', async ({
    browser, page: pageA,
  }) => {
    // Provision Actor A and establish real learner state
    const actorA = await createDisposableSupabaseUser({ tag: 'r1-iso-a' });
    let actorB: DisposableSupabaseUser | undefined;
    let releaseLate: (() => void) | undefined;

    try {
      actorB = await createDisposableSupabaseUser({ tag: 'r1-iso-b' });
      expect(actorB.id).not.toBe(actorA.id);
      // 1. Establish state for Actor A via API
      const sessionA = await authenticateDisposableLearner({
        email: actorA.email,
        password: actorA.password,
      });
      await bootstrapLearnerProfile(API_BASE_URL, sessionA.accessToken);

      // Actor A saves concept
      const saveRes = await fetch(`${API_BASE_URL}/v1/library/concepts/${FRLL_ANCHOR_CONCEPT_ID}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${sessionA.accessToken}` },
      });
      expect(saveRes.status).toBe(200);

      const digestA = await captureLearnerDigestFromPostgres(actorA.id, FRLL_ANCHOR_CONCEPT_ID);
      expect(digestA.review_item_count).toBe(1);
      const actorAReviewItemId = digestA.fsrs_states[0].review_item_id;

      // 2. Open clean, isolated browser context for Actor B
      const contextB = await browser.newContext({ baseURL: 'http://127.0.0.1:3005' });
      observeBrowserContracts(contextB);
      const pageB = await contextB.newPage();

      const sessionB = await authenticateDisposableLearner({
        email: actorB.email,
        password: actorB.password,
      });
      const profileB = await bootstrapLearnerProfile(API_BASE_URL, sessionB.accessToken);
      // Real browser login for Actor B, after profile readiness exists
      await performBrowserLogin(pageB, actorB);

      // 3. Verify Actor B cannot see Actor A's review queue
      await pageB.goto('/review');
      await liveExpect(pageB.locator('text=Đã hoàn thành toàn bộ hàng đợi ôn tập!')).toBeVisible();
      await liveExpect(pageB.locator(`text=${FRLL_ANCHOR_LEMMA}`)).not.toBeVisible();

      // 4. Verify Actor B cannot see Actor A's Brain projection
      await pageB.goto('/brain');
      await liveExpect(pageB.getByRole('heading', { name: 'Chưa có từ vựng trong Brain' })).toBeVisible();
      // Actor B has 0 mastered and 0 learning
      const zeroResponse = await fetch(API_BASE_URL + '/v1/brain/concepts/' + FRLL_ANCHOR_CONCEPT_ID, {
        headers: { Authorization: 'Bearer ' + sessionB.accessToken },
      });
      expect(zeroResponse.status).toBe(200);
      const zero = validateContract('BrainConceptResponse', await zeroResponse.json()).data;
      expect(zero.status).toBe('unseen');
      expect(zero.memory).toBeNull();
      expect(zero.mastery).toBeNull();
      expect(zero.confidence).toBe(0);
      expect(zero.evidence.reviewCount).toBe(0);
      for (const dimension of ['recognition', 'listening', 'production'] as const) {
        expect(zero.competence[dimension]).toEqual({ score: 0.5, confidence: 0, evidenceCount: 0 });
      }
      const bBeforeForbidden = await captureLearnerDigestFromPostgres(actorB.id, FRLL_ANCHOR_CONCEPT_ID);

      // 5. Negative Authorization: Actor B attempts to mutate Actor A's review item
      const forbiddenAnswerRes = await fetch(`${API_BASE_URL}/v1/review/${actorAReviewItemId}/answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionB.accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ rating: 'good', responseTimeMs: 1200 }),
      });
      // Forbidden action must return 404 NOT_FOUND without leaking ownership
      expect(forbiddenAnswerRes.status).toBe(404);
      expect(validateContract('ErrorEnvelope', await forbiddenAnswerRes.json()).error.code).toBe('NOT_FOUND');

      // Authoritative verification: Actor A's state was NOT mutated
      const digestAAfter = await captureLearnerDigestFromPostgres(actorA.id, FRLL_ANCHOR_CONCEPT_ID);
      assertExact(digestAAfter, digestA, 'Actor A forbidden mutation digest');
      assertExact(digestAAfter.fsrs_states[0].state_version, 1, 'Actor A FSRS state version after B forbidden attempt');
      assertExact(digestAAfter.review_event_count, 0, 'Actor A review events count');

      // Actor B has zero review items or FSRS states
      const digestB = await captureLearnerDigestFromPostgres(actorB.id, FRLL_ANCHOR_CONCEPT_ID);
      assertExact(digestB, bBeforeForbidden, 'Actor B forbidden mutation digest');
      expect(digestB.review_item_count).toBe(0);
      expect(digestB.fsrs_state_count).toBe(0);

      // 6. Late Actor A response isolation:
      await contextB.close();

      // Real same-runtime A -> B transition via Supabase's cross-tab sign-in.
      // Keep A's already-requested detail response pending while B signs in.
      await performBrowserLogin(pageA, actorA);
      await pageA.goto('/brain');
      const anchor = pageA.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA });
      await liveExpect(anchor).toBeVisible();
      let held = false;
      let delivered = false;
      const gate = new Promise<void>(resolve => { releaseLate = resolve; });
      await pageA.route('**/api/v1/brain/concepts/' + FRLL_ANCHOR_CONCEPT_ID, async route => {
        const response = await route.fetch({ timeout: 30_000 });
        expect(response.status()).toBe(200);
        const raw = validateContract('BrainConceptResponse', await response.json());
        expect(raw.data.memory).not.toBeNull();
        held = true;
        await gate;
        await route.fulfill({ response });
        delivered = true;
      });
      await anchor.click();
      await liveExpect.poll(() => held).toBe(true);
      const bSummary = pageA.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/api/v1/brain/summary') return false;
        expect(response.status()).toBe(200);
        return validateContract('BrainSummaryResponse', await response.json()).data.languageProfileId === profileB.languageProfileId;
      }, { timeout: 30_000 });
      const switchTab = await pageA.context().newPage();
      const [summaryResponse] = await Promise.all([
        bSummary,
        signInSecondBrowserActor(switchTab, actorB).then(id => {
          expect(id).toBe(actorB!.id);
        }),
      ]);
      expect(summaryResponse.status()).toBe(200);
      const summary = validateContract('BrainSummaryResponse', await summaryResponse.json()).data;
      expect(summary.languageProfileId).toBe(profileB.languageProfileId);
      expect(summary.statusCounts.learning).toBe(0);
      await liveExpect(pageA.getByRole('heading', { name: 'Chưa có từ vựng trong Brain' })).toBeVisible();
      const lateResponse = pageA.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/v1/brain/concepts/' + FRLL_ANCHOR_CONCEPT_ID);
      releaseLate!();
      const deliveredResponse = await lateResponse;
      expect(deliveredResponse.status()).toBe(200);
      expect(validateContract('BrainConceptResponse', await deliveredResponse.json()).data.memory).not.toBeNull();
      await deliveredResponse.finished();
      // Cross a browser paint after the stale body is actually consumed, rather
      // than asserting immediately when the Node interceptor releases bytes.
      await pageA.evaluate(() => new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await liveExpect.poll(() => delivered).toBe(true);
      await liveExpect(pageA.getByRole('dialog')).not.toBeVisible();
      await liveExpect(pageA.getByRole('button').filter({ hasText: FRLL_ANCHOR_LEMMA })).not.toBeVisible();
      await switchTab.close();
      assertNoLearningMutation(digestB.learner_rows,
        (await captureLearnerDigestFromPostgres(actorB.id, FRLL_ANCHOR_CONCEPT_ID)).learner_rows, true);
    } finally {
      releaseLate?.();
      // Attempt cleanup for both actors even if one cleanup fails, then fail closed.
      const failures: string[] = [];
      for (const actor of [actorA, ...(actorB ? [actorB] : [])]) {
        try { await cleanupActor(actor); }
        catch { failures.push(actor.id); }
      }
      if (failures.length) throw new Error('R1 Actor A/B cleanup failed for IDs: ' + failures.join(','));
    }
  });
});
