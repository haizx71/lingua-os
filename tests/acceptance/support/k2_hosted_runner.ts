import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import {
  assertNoK2ActorsRemain,
  K2_HOSTED_STAGING_SUPABASE_REF,
  authenticateK2HostedActor,
  cleanupK2RunActors,
  cleanupFreshK2HostedActorIdentity,
  createGithubTrustedSourceToken,
  createK2AdminClient,
  createK2HostedActor,
  createK2LearnerClient,
  reapExpiredK2Actors,
  validateK2HostedEnvironment,
  verifyK2HostedDeploymentAttestations,
  verifyK2HostedCurrentMasterSha,
  verifyK2StagingApiHealth,
  verifyProtectedVercelOrigin,
  type K2AdminClient,
  type K2AuthenticatedActor,
  type K2HostedActor,
  type K2FreshActorIdentity,
  type K2HostedConfig,
} from './k2_hosted_actors';
import {
  assertK2RetainedStateUnchanged,
  K2_APPROVED_APP_MIGRATION_HEAD,
  runK2HostedProbe,
  type K2HostedActorLineageProof,
  type K2HostedAnchorMaterial,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';
import { installK2BrowserRequestGuard } from './k2_playwright_network';
import { parseK2LanguageProfileList } from './k2_hosted_acceptance_helpers';

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

export interface K2HostedWaveContext {
  readonly config: K2HostedConfig;
  readonly primaryActor: K2HostedActor;
  readonly observerActor: K2HostedActor;
  readonly primarySession: K2AuthenticatedActor;
  readonly observerSession: K2AuthenticatedActor;
  readonly primaryProfileId: string;
  readonly observerProfileId: string;
  readonly page: Page;
  readonly testInfo: TestInfo;
  readonly apiRequest: K2HostedApiRequest;
  readonly actorSnapshot: (actorId: string) => Promise<K2RetainedSnapshot>;
  readonly actorLineage: (actorId: string) => Promise<K2HostedActorLineageProof>;
  readonly anchorMaterial: () => Promise<K2HostedAnchorMaterial>;
  readonly requireSnapshotRows: (snapshot: K2RetainedSnapshot, expected: Readonly<Record<string, number>>) => void;
}

export interface K2HostedWavePlugin {
  readonly waveId: 'K2-07' | 'K2-08' | 'K2-09' | 'K2-10';
  run(context: K2HostedWaveContext): Promise<void>;
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

export function requireK2ActorSnapshotRows(
  snapshot: K2RetainedSnapshot,
  expected: Readonly<Record<string, number>>,
): void {
  for (const [table, count] of Object.entries(expected)) {
    const rows = snapshot.tables[table as keyof K2RetainedSnapshot['tables']]?.rows;
    if (rows !== count) throw new Error('K2 hosted acceptance actor fixture did not match expected row counts.');
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

export async function createLearnerProfile(config: K2HostedConfig, session: K2AuthenticatedActor): Promise<string> {
  const meResponse = await requestK2HostedApi(config, session.accessToken, '/v1/me');
  const me = dataObject(meResponse.payload,
    'K2 hosted acceptance application identity bootstrap was invalid.');
  if (me.id !== session.userId) {
    throw new Error('K2 hosted acceptance application identity did not match the confirmed Auth actor.');
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
    const updatedMe = dataObject(timezoneResponse.payload,
      'K2 hosted acceptance timezone update response was invalid.');
    if (updatedMe.id !== session.userId || updatedMe.timeZone !== 'Asia/Ho_Chi_Minh' ||
        !timezoneResponse.response.headers.get('etag')) {
      throw new Error('K2 hosted acceptance learner timezone was not persisted.');
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

/**
 * Shared harness lifecycle for K2-07 through K2-10. Plugins own only their
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
  const admin = createK2AdminClient(config);
  const learner = createK2LearnerClient(config);
  const actors: K2HostedActor[] = [];
  const freshActorIdentities: K2FreshActorIdentity[] = [];
  let primarySession: K2AuthenticatedActor | null = null;
  let observerSession: K2AuthenticatedActor | null = null;
  let retainedBaseline: K2RetainedSnapshot | null = null;
  let cleanupError = false;

  try {
    if (config.supabaseProjectRef !== K2_HOSTED_STAGING_SUPABASE_REF) {
      throw new Error('K2 hosted acceptance refused a non-staging Supabase project.');
    }
    await verifyK2HostedCurrentMasterSha(config);
    const immutableVercelOrigin = await verifyK2HostedDeploymentAttestations(config);
    const oidc = await createGithubTrustedSourceToken(config);
    const vercelOrigin = await verifyProtectedVercelOrigin(
      immutableVercelOrigin,
      oidc,
      config.githubSha,
    );
    await verifyK2StagingApiHealth(config.apiOrigin, config.githubSha);
    const migration = await runK2HostedProbe('migrations', config.readonlyDatabaseUrl);
    if (!('appMigrationHead' in migration) || migration.appMigrationHead !== K2_APPROVED_APP_MIGRATION_HEAD) {
      throw new Error('K2 hosted acceptance staging migration head is not approved.');
    }

    const expired = await reapExpiredK2Actors(config, admin as unknown as K2AdminClient, Date.now(),
      actorId => verifyActorGone(config, actorId),
      { allowSameRunUnmarked: config });
    testInfo.annotations.push({ type: 'expired-actors-reaped', description: String(expired) });
    const priorAttemptActors = await cleanupK2RunActors(config, admin as unknown as K2AdminClient,
      actorId => verifyActorGone(config, actorId));
    testInfo.annotations.push({ type: 'interrupted-run-actors-cleaned', description: String(priorAttemptActors) });
    await assertNoK2ActorsRemain(config, admin as unknown as K2AdminClient);
    retainedBaseline = await runK2HostedProbe('retained_snapshot', config.readonlyDatabaseUrl) as K2RetainedSnapshot;

    await verifyK2HostedCurrentMasterSha(config);
    const primary = await createK2HostedActor(
      config,
      admin as unknown as K2AdminClient,
      identity => freshActorIdentities.push(identity),
    );
    actors.push(primary);
    const observer = await createK2HostedActor(
      config,
      admin as unknown as K2AdminClient,
      identity => freshActorIdentities.push(identity),
    );
    actors.push(observer);
    primarySession = await authenticateK2HostedActor(primary, config, learner);
    observerSession = await authenticateK2HostedActor(observer, config, learner);

    const browserOidc = await createGithubTrustedSourceToken(config);
    const reverifiedBrowserOrigin = await verifyProtectedVercelOrigin(
      immutableVercelOrigin,
      browserOidc,
      config.githubSha,
    );
    if (reverifiedBrowserOrigin !== vercelOrigin) {
      throw new Error('K2 hosted acceptance canonical browser origin changed; browser flow was stopped.');
    }
    await installK2BrowserRequestGuard(browserContext, {
      vercelOrigin,
      supabaseUrl: config.supabaseUrl,
    }, browserOidc);
    await verifyAuthUiSignIn(page, primary, vercelOrigin, config);

    const primaryProfileId = await createLearnerProfile(config, primarySession);
    const observerProfileId = await createLearnerProfile(config, observerSession);
    await plugin.run({
      config,
      primaryActor: primary,
      observerActor: observer,
      primarySession,
      observerSession,
      primaryProfileId,
      observerProfileId,
      page,
      testInfo,
      apiRequest: (accessToken, route, options, statuses) =>
        requestK2HostedApi(config, accessToken, route, options, statuses),
      actorSnapshot: actorId => actorSnapshot(config, actorId),
      actorLineage: actorId => actorLineage(config, actorId),
      anchorMaterial: () => anchorMaterial(config),
      requireSnapshotRows: requireK2ActorSnapshotRows,
    });
  } finally {
    try { await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); }
    catch { /* The page may not have reached the protected origin. */ }
    try { await browserContext.clearCookies(); } catch { /* Context may already be closing. */ }
    try { await learner.auth.signOut({ scope: 'global' }); } catch { /* Auth deletion still follows. */ }
    primarySession = null;
    observerSession = null;

    let cleanedActorCount = 0;
    try {
      cleanedActorCount = await cleanupK2RunActors(
        config,
        admin as unknown as K2AdminClient,
        actorId => verifyActorGone(config, actorId),
      );
    } catch { cleanupError = true; }
    if (cleanedActorCount < actors.length) cleanupError = true;
    actors.splice(0, actors.length);
    for (const identity of freshActorIdentities) {
      try {
        await cleanupFreshK2HostedActorIdentity(
          config,
          identity,
          admin as unknown as K2AdminClient,
          actorId => verifyActorGone(config, actorId),
        );
      } catch { cleanupError = true; }
    }
    freshActorIdentities.splice(0, freshActorIdentities.length);

    if (retainedBaseline) {
      try {
        const retainedAfter = await runK2HostedProbe('retained_snapshot', config.readonlyDatabaseUrl) as K2RetainedSnapshot;
        assertK2RetainedStateUnchanged(retainedBaseline, retainedAfter);
      } catch { cleanupError = true; }
      retainedBaseline = null;
    }
    if (cleanupError) {
      throw new Error('K2 hosted acceptance cleanup, zero-residue, or retained-state proof failed.');
    }
  }
}

export function validateK2AcceptanceConfiguration(): K2HostedConfig {
  return validateK2HostedEnvironment(process.env, 'acceptance');
}
