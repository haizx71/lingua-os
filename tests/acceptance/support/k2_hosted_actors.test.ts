import { AuthApiError, type User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  K2_HOSTED_MARKER_KEY,
  K2_HOSTED_FIXTURE_OIDC_AUDIENCE,
  K2_HOSTED_FIXTURE_API_ORIGIN,
  K2_HOSTED_FIXTURE_READ_TOKEN_HEADER,
  K2_HOSTED_OWNER_LOGIN,
  K2_HOSTED_READONLY_DATABASE_ROLE,
  K2_HOSTED_STAGING_SUPABASE_REF,
  K2_HOSTED_UNMARKED_RECOVERY_MAX_AGE_MS,
  K2_VERCEL_ATTESTATION_PATH,
  K2_HOSTED_WORKFLOW_REF,
  authenticateK2HostedActor,
  createK2HostedActor,
  cleanupK2RunActors,
  cleanupK2Actor,
  cleanupFreshK2HostedActorIdentity,
  assertNoK2ActorsRemain,
  createGithubTrustedSourceToken,
  createK2HostedFixtureOidcToken,
  cleanupK2HostedFixtureWithRecovery,
  requestK2HostedFixtureControl,
  setupK2HostedFixtureWithRecovery,
  getK2ActorOwnership,
  reapExpiredK2Actors,
  validateK2HostedEnvironment,
  verifyK2StagingApiHealth,
  verifyK2HostedDeploymentAttestations,
  verifyK2HostedCurrentMasterSha,
  verifyProtectedVercelOrigin,
  verifyK2FreshActorOwnership,
  type K2AdminClient,
  type K2HostedActor,
  type K2FreshActorIdentity,
  type K2HostedConfig,
} from './k2_hosted_actors';
import {
  K2_VERCEL_TRUSTED_SOURCE_HEADER,
  headersForK2ProtectedOrigin,
} from './k2_vercel_header';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const IMMUTABLE_VERCEL_ORIGIN = 'https://lingua-os-8qh2r4ehj-haizx71-6910.vercel.app';
const CANONICAL_VERCEL_ORIGIN = 'https://lingua-os-web-mocha.vercel.app';

function vercelChallenge(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: 'https://vercel.com/sso-api?redirect=%2Fauth',
      'x-vercel-id': 'region::request-id',
    },
  });
}

function operationalAttestation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sourceSha: 'a'.repeat(40),
    deploymentOrigin: IMMUTABLE_VERCEL_ORIGIN,
    deploymentId: 'dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3',
    environment: 'production',
    repositoryOwner: 'haizx71',
    repositorySlug: 'lingua-os',
    canonicalOrigin: CANONICAL_VERCEL_ORIGIN,
    ...overrides,
  };
}

function attestationResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json(operationalAttestation(overrides), {
    status: 200,
    headers: { 'x-vercel-id': 'region::request-id' },
  });
}

function acceptedGateResponses(
  overrides: { readonly immutable?: Response; readonly canonical?: Response; readonly redirect?: Response; readonly auth?: Response } = {},
): Response[] {
  return [
    vercelChallenge(),
    vercelChallenge(),
    overrides.immutable ?? attestationResponse(),
    overrides.redirect ?? new Response(null, {
      status: 308,
      headers: { location: `${CANONICAL_VERCEL_ORIGIN}/auth`, 'x-vercel-id': 'region::request-id' },
    }),
    vercelChallenge(),
    vercelChallenge(),
    overrides.canonical ?? attestationResponse(),
    overrides.auth ?? new Response('<html><input id="auth-email"><input id="auth-password"></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-vercel-id': 'region::request-id' },
    }),
  ];
}

function mockFetchSequence(responses: Response[]) {
  let nextResponse = 0;
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    responses[nextResponse++] ?? new Response(null, { status: 500 }));
}

async function errorMessage(operation: Promise<unknown>): Promise<string> {
  try { await operation; }
  catch (error) { return error instanceof Error ? error.message : ''; }
  return '';
}

function config(overrides: Partial<K2HostedConfig> = {}): K2HostedConfig {
  return {
    apiOrigin: 'https://lingua-api-staging.onrender.com',
    supabaseUrl: `https://${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co`,
    supabaseProjectRef: K2_HOSTED_STAGING_SUPABASE_REF,
    publishableKey: 'test-publishable-placeholder',
    secretKey: 'test-admin-placeholder',
    readonlyDatabaseUrl:
      `postgresql://${K2_HOSTED_READONLY_DATABASE_ROLE}.${K2_HOSTED_STAGING_SUPABASE_REF}:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`,
    githubRepository: 'haizx71/lingua-os',
    githubRef: 'refs/heads/master',
    githubEventName: 'workflow_dispatch',
    githubRunId: '123456789',
    githubRunAttempt: '2',
    githubWorkflow: 'K2 Hosted Acceptance',
    githubWorkflowRef: K2_HOSTED_WORKFLOW_REF,
    githubSha: 'a'.repeat(40),
    githubToken: 'test-github-placeholder',
    oidcRequestUrl: 'https://pipelines.actions.githubusercontent.com/runtime/token',
    oidcRequestToken: 'test-oidc-placeholder',
    ...overrides,
  };
}

function validEnvironment(): Record<string, string> {
  return {
    K2_STAGING_API_ORIGIN: 'https://lingua-api-staging.onrender.com',
    K2_STAGING_SUPABASE_URL: `https://${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co`,
    K2_STAGING_SUPABASE_PROJECT_REF: K2_HOSTED_STAGING_SUPABASE_REF,
    K2_STAGING_SUPABASE_PUBLISHABLE_KEY: 'placeholder',
    K2_STAGING_SUPABASE_SECRET_KEY: 'placeholder',
    K2_STAGING_READONLY_DATABASE_URL:
      `postgresql://${K2_HOSTED_READONLY_DATABASE_ROLE}.${K2_HOSTED_STAGING_SUPABASE_REF}:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`,
    GITHUB_REPOSITORY: 'haizx71/lingua-os',
    GITHUB_REF: 'refs/heads/master',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_WORKFLOW: 'K2 Hosted Acceptance',
    GITHUB_WORKFLOW_REF: K2_HOSTED_WORKFLOW_REF,
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_ACTOR: K2_HOSTED_OWNER_LOGIN,
    GITHUB_TRIGGERING_ACTOR: K2_HOSTED_OWNER_LOGIN,
    K2_GITHUB_TOKEN: 'placeholder',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/runtime/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'placeholder',
  };
}

const FIXTURE_LEMMA = `kfixture${'a'.repeat(64)}`;
const FIXTURE_PRESENT_COUNTS = {
  sourceRecords: 1, concepts: 2, lexemes: 1, forms: 1, senses: 2, bridges: 3,
} as const;
const FIXTURE_ZERO_COUNTS = {
  sourceRecords: 0, concepts: 0, lexemes: 0, forms: 0, senses: 0, bridges: 0,
} as const;
const FIXTURE_DESCRIPTOR = {
  handles: {
    ownerConcept: 'k2-09-owner',
    secondaryConcept: 'k2-09-secondary',
    lexeme: 'k2-09-lexeme',
  },
  ids: {
    ownerConceptId: '00000000-0000-4000-8000-000000000001',
    secondaryConceptId: '00000000-0000-4000-8000-000000000002',
    lexemeId: '00000000-0000-4000-8000-000000000003',
  },
  lemma: FIXTURE_LEMMA,
  inflectedForm: `${FIXTURE_LEMMA}s`,
} as const;

function activeFixtureInspection() {
  return {
    protocolVersion: 'k2-09-bridge-fixture.v1',
    receiptState: 'ACTIVE',
    fixturePresent: true,
    fixture: FIXTURE_DESCRIPTOR,
    counts: FIXTURE_PRESENT_COUNTS,
  };
}

function closedFixtureInspection() {
  return {
    protocolVersion: 'k2-09-bridge-fixture.v1',
    receiptState: 'CLOSED',
    fixturePresent: false,
    fixture: null,
    counts: FIXTURE_ZERO_COUNTS,
  };
}

function absentFixtureInspection() {
  return {
    protocolVersion: 'k2-09-bridge-fixture.v1',
    receiptState: 'ABSENT',
    fixturePresent: false,
    fixture: null,
    counts: FIXTURE_ZERO_COUNTS,
  };
}

function ownership(cfg: K2HostedConfig = config(), now = NOW) {
  return getK2ActorOwnership(cfg, now);
}

function authUser(
  id: string,
  email: string,
  appMark: unknown,
  userMetadata?: Record<string, unknown>,
): User {
  return {
    id,
    email,
    app_metadata: appMark ? { [K2_HOSTED_MARKER_KEY]: appMark } : {},
    user_metadata: userMetadata ?? {},
    created_at: NOW.toISOString(),
    email_confirmed_at: NOW.toISOString(),
    last_sign_in_at: null,
  } as User;
}

function reverseOwnershipKeys(value: ReturnType<typeof ownership>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).reverse());
}

function makeActor(cfg: K2HostedConfig = config()): K2HostedActor {
  const mark = ownership(cfg);
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: `k2ha-${cfg.githubRunId}-${cfg.githubRunAttempt}-aaaaaaaaaaaaaaaa@example.invalid`,
    password: 'memory-only-test-password',
    ownership: mark,
  };
}

type K2AdminTestClient = K2AdminClient & {
  readonly todayPlanDeleteFilter: ReturnType<typeof vi.fn>;
  readonly todayPlanSelectFilter: ReturnType<typeof vi.fn>;
  readonly todayPlanSelectLimit: ReturnType<typeof vi.fn>;
  readonly cleanupEvents: string[];
  readonly todayPlanOwners: Set<string>;
};

function todayPlansCleanupMock(initialPlanOwnerIds: readonly string[] = []): Pick<
  K2AdminTestClient,
  'from' | 'todayPlanDeleteFilter' | 'todayPlanSelectFilter' | 'todayPlanSelectLimit' | 'cleanupEvents' |
  'todayPlanOwners'
> {
  const cleanupEvents: string[] = [];
  const todayPlanOwners = new Set(initialPlanOwnerIds);
  let selectedOwnerId = '';
  const todayPlanDeleteFilter = vi.fn(async (column: string, userId: string) => {
    cleanupEvents.push(`delete:${column}:${userId}`);
    if (column === 'user_id') todayPlanOwners.delete(userId);
    return { error: null };
  });
  const todayPlanSelectLimit = vi.fn(async (limit: number) => {
    cleanupEvents.push(`limit:${limit}`);
    const data = [...todayPlanOwners]
      .filter(userId => userId === selectedOwnerId)
      .slice(0, limit)
      .map(userId => ({ id: `plan:${userId}` }));
    return { data, error: null };
  });
  const todayPlanSelectFilter = vi.fn((column: string, userId: string) => {
    cleanupEvents.push(`verify:${column}:${userId}`);
    if (column === 'user_id') selectedOwnerId = userId;
    return { limit: todayPlanSelectLimit };
  });
  const from = vi.fn((table: string) => {
    cleanupEvents.push(`from:${table}`);
    return {
      delete: () => ({ eq: todayPlanDeleteFilter }),
      select: () => ({ eq: todayPlanSelectFilter }),
    };
  });
  return { from, todayPlanDeleteFilter, todayPlanSelectFilter, todayPlanSelectLimit, cleanupEvents, todayPlanOwners };
}

function adminWithUsers(users: readonly User[], todayPlanOwnerIds: readonly string[] = []): K2AdminTestClient {
  const todayPlans = todayPlansCleanupMock(todayPlanOwnerIds);
  return {
    ...todayPlans,
    auth: {
      admin: {
        createUser: vi.fn(),
        listUsers: vi.fn(async ({ page }) => ({
          data: {
            users: page === 1 ? users : [],
            nextPage: null,
            lastPage: 1,
            total: users.length,
          },
          error: null,
        })),
        getUserById: vi.fn(async (userId: string) => ({
          data: { user: users.find(user => user.id === userId) ?? null },
          error: null,
        })),
        deleteUser: vi.fn(async (userId: string) => {
          todayPlans.cleanupEvents.push(`auth-delete:${userId}`);
          return { error: null };
        }),
      },
    },
  } as unknown as K2AdminTestClient;
}

describe('K2 hosted actor lifecycle boundaries', () => {
  it('revalidates only the exact fresh in-memory actor and its current server-owned run marker', async () => {
    const actor = makeActor();
    const admin = adminWithUsers([authUser(actor.id, actor.email, actor.ownership)]);

    await expect(verifyK2FreshActorOwnership(config(), actor, admin, NOW.getTime())).resolves.toBeUndefined();
    expect(admin.auth.admin.getUserById).toHaveBeenCalledExactlyOnceWith(actor.id);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it.each([
    ['changed server marker', (actor: K2HostedActor) => ({
      ...actor.ownership,
      runAttempt: '999',
    })],
    ['expired marker', (actor: K2HostedActor) => ({
      ...actor.ownership,
      expiresAt: new Date(NOW.getTime() - 1).toISOString(),
    })],
  ])('fails closed for a %s without enumerating Auth users', async (_label, marker) => {
    const actor = makeActor();
    const admin = adminWithUsers([authUser(actor.id, actor.email, marker(actor))]);

    await expect(verifyK2FreshActorOwnership(config(), actor, admin, NOW.getTime()))
      .rejects.toThrow('fixture actor ownership could not be revalidated');
    expect(admin.auth.admin.getUserById).toHaveBeenCalledExactlyOnceWith(actor.id);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it('pins staging project and the read-only database identity before any hosted client is created', () => {
    const env = validEnvironment();
    expect(validateK2HostedEnvironment(env).supabaseProjectRef).toBe(K2_HOSTED_STAGING_SUPABASE_REF);
    expect(() => validateK2HostedEnvironment({
      ...env,
      K2_STAGING_SUPABASE_PROJECT_REF: 'productionref123456',
      K2_STAGING_SUPABASE_URL: 'https://productionref123456.supabase.co',
      K2_STAGING_READONLY_DATABASE_URL:
        'postgresql://k2_hosted_acceptance_reader.productionref123456:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full',
    })).toThrow('Supabase project reference is invalid');
    expect(() => validateK2HostedEnvironment({
      ...env,
      K2_STAGING_READONLY_DATABASE_URL:
        `postgresql://postgres:placeholder@db.${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co/postgres?sslmode=require`,
    })).toThrow('read-only database URL');
    expect(() => validateK2HostedEnvironment({
      ...env,
      K2_STAGING_READONLY_DATABASE_URL: env.K2_STAGING_READONLY_DATABASE_URL.replace(':5432/', ':6543/'),
    })).toThrow('read-only database URL');
  });

  it('keeps reaper minimal and requires read proof only for K2-09 current-run recovery', () => {
    const reaperEnv = validEnvironment();
    for (const key of [
      'K2_STAGING_API_ORIGIN', 'K2_STAGING_SUPABASE_URL', 'K2_STAGING_SUPABASE_PROJECT_REF',
      'K2_STAGING_SUPABASE_PUBLISHABLE_KEY', 'K2_STAGING_SUPABASE_SECRET_KEY',
      'K2_STAGING_READONLY_DATABASE_URL',
    ]) delete reaperEnv[key];
    const reaper = validateK2HostedEnvironment(reaperEnv, 'fixture-reap');
    expect(reaper.apiOrigin).toBe(K2_HOSTED_FIXTURE_API_ORIGIN);
    expect(reaper.supabaseUrl).toBe('');
    expect(reaper.secretKey).toBe('');
    expect(reaper.readonlyDatabaseUrl).toBe('');

    const recoveryEnv = validEnvironment();
    delete recoveryEnv.K2_STAGING_API_ORIGIN;
    delete recoveryEnv.K2_GITHUB_TOKEN;
    recoveryEnv.K2_ACCEPTANCE_WAVE = 'K2-09';
    expect(() => validateK2HostedEnvironment(recoveryEnv, 'cleanup-current'))
      .toThrow('K2_GITHUB_TOKEN');
    recoveryEnv.K2_GITHUB_TOKEN = 'github-read-token-placeholder';
    const recovery = validateK2HostedEnvironment(recoveryEnv, 'cleanup-current');
    expect(recovery.githubToken).toBe('github-read-token-placeholder');
    expect(recovery.apiOrigin).toBe('');
    const priorWaveEnv = { ...recoveryEnv, K2_ACCEPTANCE_WAVE: 'K2-08' };
    delete priorWaveEnv.K2_GITHUB_TOKEN;
    expect(validateK2HostedEnvironment(priorWaveEnv, 'cleanup-current').githubToken).toBe('');
    expect(() => validateK2HostedEnvironment({
      ...recoveryEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: '',
    }, 'cleanup-current')).toThrow('ACTIONS_ID_TOKEN_REQUEST_URL');
  });

  it('requires both the repository owner and owner-triggered acceptance dispatch', () => {
    const env = validEnvironment();
    expect(() => validateK2HostedEnvironment({ ...env, GITHUB_ACTOR: 'trusted-collaborator' }))
      .toThrow('repository owner');
    expect(() => validateK2HostedEnvironment({ ...env, GITHUB_TRIGGERING_ACTOR: 'trusted-collaborator' }))
      .toThrow('repository owner');
    expect(validateK2HostedEnvironment({
      ...env,
      GITHUB_EVENT_NAME: 'schedule',
      GITHUB_ACTOR: '',
      GITHUB_TRIGGERING_ACTOR: '',
    }, 'janitor').supabaseProjectRef).toBe(K2_HOSTED_STAGING_SUPABASE_REF);
  });

  it('uses marker comparison independent of JSONB key order and confirms canonical Auth absence', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, reverseOwnershipKeys(actor.ownership));
    let lookup = 0;
    const admin = {
      ...todayPlansCleanupMock(),
      auth: {
        admin: {
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 3) return { data: { user }, error: null };
            return {
              data: { user: null },
              error: new AuthApiError('suppressed', 404, 'user_not_found'),
            };
          }),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
          createUser: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(cleanupK2Actor(cfg, actor, admin)).resolves.toBeUndefined();
    expect(lookup).toBe(4);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(actor.id);
  });

  it('clears only the exact actor Today parents before Auth deletion and verifies the parent set is empty', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, actor.ownership);
    const foreignOwnerId = '550e8400-e29b-41d4-a716-446655440099';
    const admin = adminWithUsers([user], [actor.id, foreignOwnerId]);
    let lookup = 0;
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      lookup += 1;
      return lookup <= 3
        ? { data: { user }, error: null }
        : { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
    });

    await expect(cleanupK2Actor(cfg, actor, admin)).resolves.toBeUndefined();

    expect(admin.from).toHaveBeenCalledTimes(2);
    expect(admin.from).toHaveBeenNthCalledWith(1, 'today_plans');
    expect(admin.from).toHaveBeenNthCalledWith(2, 'today_plans');
    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.todayPlanSelectFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.todayPlanSelectLimit).toHaveBeenCalledExactlyOnceWith(1);
    expect(admin.todayPlanOwners.has(actor.id)).toBe(false);
    expect(admin.todayPlanOwners.has(foreignOwnerId)).toBe(true);
    expect(admin.cleanupEvents.indexOf(`delete:user_id:${actor.id}`))
      .toBeLessThan(admin.cleanupEvents.indexOf(`auth-delete:${actor.id}`));
  });

  it('stops before Auth deletion when the scoped Today parent cleanup fails', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, actor.ownership);
    const admin = adminWithUsers([user]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null });
    admin.todayPlanDeleteFilter.mockResolvedValue({ error: new Error('sensitive provider detail') });

    await expect(cleanupK2Actor(cfg, actor, admin))
      .rejects.toThrow('Today plan cleanup failed; Auth deletion stopped');

    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.todayPlanSelectFilter).not.toHaveBeenCalled();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(admin.cleanupEvents).not.toContain(`auth-delete:${actor.id}`);
  });

  it('stops before Auth deletion when a Today parent remains after the bounded delete', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, actor.ownership);
    const admin = adminWithUsers([user]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null });
    admin.todayPlanSelectLimit.mockResolvedValue({ data: [{ id: 'remaining-plan' }], error: null });

    await expect(cleanupK2Actor(cfg, actor, admin))
      .rejects.toThrow('Today plan cleanup failed; Auth deletion stopped');

    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.todayPlanSelectLimit).toHaveBeenCalledExactlyOnceWith(1);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('retries safely when Auth deletion fails after Today parents were cleared', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, actor.ownership);
    const admin = adminWithUsers([user], [actor.id]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    (admin.auth.admin.deleteUser as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ error: new Error('provider detail suppressed') });

    await expect(cleanupK2Actor(cfg, actor, admin))
      .rejects.toThrow('Auth deletion failed; the guarded janitor may retry after TTL');
    expect(admin.todayPlanOwners.has(actor.id)).toBe(false);

    await expect(cleanupK2Actor(cfg, actor, admin)).resolves.toBeUndefined();

    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledTimes(2);
    expect(admin.todayPlanDeleteFilter).toHaveBeenNthCalledWith(1, 'user_id', actor.id);
    expect(admin.todayPlanDeleteFilter).toHaveBeenNthCalledWith(2, 'user_id', actor.id);
    expect(admin.todayPlanSelectLimit).toHaveBeenCalledTimes(2);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(2);
    expect(admin.todayPlanOwners.has(actor.id)).toBe(false);
  });

  it('returns an actor only after Auth re-fetch confirms the exact server-owned mark', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440030';
    let email = '';
    let mark: unknown;
    const admin = {
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            mark = (attributes.app_metadata as Record<string, unknown>)[K2_HOSTED_MARKER_KEY];
            return { data: { user: authUser(id, email, null) }, error: null };
          }),
          getUserById: vi.fn(async () => ({
            data: { user: authUser(id, email, mark) },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    const actor = await createK2HostedActor(config(), admin, () => undefined, NOW);
    expect(actor.id).toBe(id);
    expect(admin.auth.admin.getUserById).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('rolls back a freshly created actor only after exact UUID and reserved email are re-confirmed when its mark is absent', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440031';
    let email = '';
    const user = () => authUser(id, email, null);
    let lookup = 0;
    const todayPlans = todayPlansCleanupMock();
    const admin = {
      ...todayPlans,
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return { data: { user: user() }, error: null };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 3) return { data: { user: user() }, error: null };
            return { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
          }),
          deleteUser: vi.fn(async (userId: string) => {
            todayPlans.cleanupEvents.push(`auth-delete:${userId}`);
            return { error: null };
          }),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, () => undefined, NOW))
      .rejects.toThrow('server-owned actor mark was not persisted');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(id);
    expect(lookup).toBe(4);
    expect(todayPlans.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', id);
    expect(todayPlans.cleanupEvents.indexOf(`delete:user_id:${id}`))
      .toBeLessThan(todayPlans.cleanupEvents.indexOf(`auth-delete:${id}`));
  });

  it('rolls back an exact partial identity when createUser reports an error with a user result', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440035';
    let email = '';
    let lookup = 0;
    const fresh: K2FreshActorIdentity[] = [];
    const admin = {
      ...todayPlansCleanupMock(),
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return {
              data: { user: authUser(id, email, null) },
              error: new Error('provider details suppressed'),
            };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 2) return { data: { user: authUser(id, email, null) }, error: null };
            return { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
          }),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, identity => fresh.push(identity), NOW))
      .rejects.toThrow('actor creation returned an error; its exact fresh identity was rolled back');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(id);
    expect(lookup).toBe(3);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ id, email });
  });

  it('rolls back a freshly created actor with an altered server mark after exact identity re-fetch', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440032';
    let email = '';
    const alteredMark = { ...ownership(), workflowRef: `${K2_HOSTED_WORKFLOW_REF}@refs/heads/other` };
    let lookup = 0;
    const fresh: K2FreshActorIdentity[] = [];
    const admin = {
      ...todayPlansCleanupMock(),
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return { data: { user: authUser(id, email, null) }, error: null };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 3) return { data: { user: authUser(id, email, alteredMark) }, error: null };
            return { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
          }),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, identity => fresh.push(identity), NOW))
      .rejects.toThrow('server-owned actor mark was not persisted exactly; the fresh actor was rolled back');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(id);
    expect(lookup).toBe(4);
    expect(fresh).toHaveLength(1);
  });

  it('recovers the exact fresh identity in finally after rollback deletion and Auth listing both fail', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440034';
    let email = '';
    let serverMark: unknown;
    let lookup = 0;
    let deletion = 0;
    const fresh: K2FreshActorIdentity[] = [];
    const todayPlans = todayPlansCleanupMock([id]);
    const admin = {
      ...todayPlans,
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            serverMark = (attributes.app_metadata as Record<string, unknown>)[K2_HOSTED_MARKER_KEY];
            return {
              data: { user: authUser(id, email, serverMark) },
              error: new Error('provider details suppressed'),
            };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 4) return { data: { user: authUser(id, email, serverMark) }, error: null };
            return { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
          }),
          deleteUser: vi.fn(async (userId: string) => {
            todayPlans.cleanupEvents.push(`auth-delete:${userId}`);
            deletion += 1;
            return { error: deletion === 1 ? new Error('provider details suppressed') : null };
          }),
          listUsers: vi.fn(async () => { throw new Error('provider details suppressed'); }),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, identity => fresh.push(identity), NOW))
      .rejects.toThrow('could not roll back the fresh unmarked Auth actor');
    expect(fresh).toHaveLength(1);
    await expect(cleanupK2RunActors(config(), admin)).rejects.toThrow('Auth enumeration failed');
    const verifyDeletedActor = vi.fn(async () => undefined);
    await expect(cleanupFreshK2HostedActorIdentity(config(), fresh[0], admin, verifyDeletedActor))
      .resolves.toBe(true);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(2);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(id);
    expect(lookup).toBe(5);
    expect(todayPlans.todayPlanDeleteFilter).toHaveBeenCalledTimes(2);
    expect(todayPlans.todayPlanDeleteFilter).toHaveBeenNthCalledWith(1, 'user_id', id);
    expect(todayPlans.todayPlanDeleteFilter).toHaveBeenNthCalledWith(2, 'user_id', id);
    const planDeleteEvents = todayPlans.cleanupEvents
      .map((event, index) => event.startsWith(`delete:user_id:${id}`) ? index : -1)
      .filter(index => index >= 0);
    const authDeleteEvents = todayPlans.cleanupEvents
      .map((event, index) => event === `auth-delete:${id}` ? index : -1)
      .filter(index => index >= 0);
    expect(planDeleteEvents).toHaveLength(2);
    expect(authDeleteEvents).toHaveLength(2);
    expect(planDeleteEvents[0]).toBeLessThan(authDeleteEvents[0]);
    expect(planDeleteEvents[1]).toBeLessThan(authDeleteEvents[1]);
    expect(todayPlans.todayPlanOwners.has(id)).toBe(false);
    expect(verifyDeletedActor).toHaveBeenCalledOnce();
    expect(verifyDeletedActor).toHaveBeenCalledWith(id);
  });

  it('refuses unmarked rollback when the re-fetched generated identity no longer matches', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440033';
    let email = '';
    let lookup = 0;
    const admin = {
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return { data: { user: authUser(id, email, null) }, error: null };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            return {
              data: { user: authUser(id, lookup === 1 ? email : 'different@example.invalid', null) },
              error: null,
            };
          }),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, () => undefined, NOW)).rejects.toThrow('fresh actor rollback because identity did not match');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses a stale actor handle before reading or deleting another run identity', async () => {
    const cfg = config();
    const actor = makeActor(config({ githubRunId: 'other-run' }));
    const admin = adminWithUsers([]);

    await expect(cleanupK2Actor(cfg, actor, admin)).rejects.toThrow('outside the current staging mark');
    expect(admin.auth.admin.getUserById).not.toHaveBeenCalled();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses deletion when the re-fetched server-owned workflow ref changed', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const changedMark = { ...actor.ownership, workflowRef: `${K2_HOSTED_WORKFLOW_REF}@refs/heads/other` };
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: authUser(actor.id, actor.email, changedMark) },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
          createUser: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(cleanupK2Actor(cfg, actor, admin)).rejects.toThrow('ownership mark changed');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('ignores a learner-writable user_metadata decoy during TTL cleanup', async () => {
    const decoy = authUser(
      '550e8400-e29b-41d4-a716-446655440001',
      'learner@example.invalid',
      null,
      { [K2_HOSTED_MARKER_KEY]: ownership(config(), new Date(NOW.getTime() - 10_000)) },
    );
    const admin = adminWithUsers([decoy]);

    await expect(reapExpiredK2Actors(config(), admin, NOW.getTime())).resolves.toBe(0);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('clears only an expired marked actor Today parent before the janitor Auth deletion', async () => {
    const cfg = config();
    const actor = authUser(
      '550e8400-e29b-41d4-a716-446655440054',
      'k2ha-123456789-2-eeeeeeeeeeeeeeee@example.invalid',
      ownership(cfg, new Date(NOW.getTime() - 3 * 60 * 60 * 1000)),
    );
    const admin = adminWithUsers([actor]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });

    await expect(reapExpiredK2Actors(cfg, admin, NOW.getTime())).resolves.toBe(1);

    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.cleanupEvents.indexOf(`delete:user_id:${actor.id}`))
      .toBeLessThan(admin.cleanupEvents.indexOf(`auth-delete:${actor.id}`));
  });

  it('follows explicit pagination metadata when GoTrue caps a page below the requested size', async () => {
    const first = authUser('first', 'ordinary-one@example.invalid', null);
    const second = authUser('second', 'ordinary-two@example.invalid', null);
    const listUsers = vi.fn(async ({ page }: { page: number }) => ({
      data: page === 1
        ? { users: [first], nextPage: 2, lastPage: 2, total: 2 }
        : { users: [second], nextPage: null, lastPage: 2, total: 2 },
      error: null,
    }));
    const admin = {
      auth: { admin: { ...adminWithUsers([]).auth.admin, listUsers } },
    } as unknown as K2AdminClient;

    await expect(reapExpiredK2Actors(config(), admin, NOW.getTime())).resolves.toBe(0);
    expect(listUsers).toHaveBeenCalledTimes(4);
  });

  it('refuses inconsistent or incomplete Auth pagination before any deletion', async () => {
    const candidateOwnership = ownership(config(), new Date(NOW.getTime() - 3 * 60 * 60 * 1000));
    const email = 'k2ha-123456789-2-aaaaaaaaaaaaaaaa@example.invalid';
    const expired = authUser(
      '550e8400-e29b-41d4-a716-446655440002',
      email,
      candidateOwnership,
    );
    const admin = {
      auth: {
        admin: {
          ...adminWithUsers([]).auth.admin,
          listUsers: vi.fn(async () => ({
            data: { users: [expired], nextPage: null, lastPage: 2, total: 2 },
            error: null,
          })),
        },
      },
    } as unknown as K2AdminClient;

    await expect(reapExpiredK2Actors(config(), admin, NOW.getTime())).rejects.toThrow('pagination metadata');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('cleans only earlier attempts of the same workflow run before a rerun baseline', async () => {
    const current = config({ githubRunAttempt: '3' });
    const previous = config({ githubRunAttempt: '2' });
    const oldMark = ownership(previous, new Date(NOW.getTime() - 10_000));
    const oldActor = authUser(
      '550e8400-e29b-41d4-a716-446655440008',
      'k2ha-123456789-2-aaaaaaaaaaaaaaaa@example.invalid',
      oldMark,
    );
    const otherRunMark = ownership(config({ githubRunId: '999999999' }), new Date(NOW.getTime() - 10_000));
    const otherRun = authUser(
      '550e8400-e29b-41d4-a716-446655440009',
      'k2ha-999999999-2-bbbbbbbbbbbbbbbb@example.invalid',
      otherRunMark,
    );
    const admin = adminWithUsers([oldActor, otherRun]);
    const lookup = vi.fn()
      .mockResolvedValueOnce({ data: { user: oldActor }, error: null })
      .mockResolvedValueOnce({ data: { user: oldActor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>).mockImplementation(lookup);
    const verifyDeleted = vi.fn(async () => undefined);

    await expect(cleanupK2RunActors(current, admin, verifyDeleted, NOW.getTime())).resolves.toBe(1);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(oldActor.id);
    expect(verifyDeleted).toHaveBeenCalledTimes(1);
    expect(verifyDeleted).toHaveBeenCalledWith(oldActor.id);
  });

  it('attempts guarded Auth deletion before reporting an unverifiable zero-residue snapshot', async () => {
    const cfg = config();
    const actor = authUser(
      '550e8400-e29b-41d4-a716-446655440050',
      'k2ha-123456789-2-eeeeeeeeeeeeeeee@example.invalid',
      ownership(cfg, new Date(NOW.getTime() - 10_000)),
    );
    const admin = adminWithUsers([actor]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    const residueProof = vi.fn(async () => { throw new Error('schema fingerprint changed'); });

    await expect(cleanupK2RunActors(cfg, admin, residueProof, NOW.getTime()))
      .rejects.toThrow('deleted actor residue proof failed');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(actor.id);
    expect(residueProof).toHaveBeenCalledOnce();
    expect(residueProof).toHaveBeenCalledWith(actor.id);
  });

  it('continues all eligible same-run deletions when one post-delete residue proof fails', async () => {
    const cfg = config({ githubRunAttempt: '2' });
    const markedActor = authUser(
      '550e8400-e29b-41d4-a716-446655440051',
      'k2ha-123456789-2-eeeeeeeeeeeeeeee@example.invalid',
      ownership(cfg, new Date(NOW.getTime() - 10_000)),
    );
    const unmarkedActor = authUser(
      '550e8400-e29b-41d4-a716-446655440052',
      'k2ha-123456789-1-ffffffffffffffff@example.invalid',
      null,
    );
    const secondUnmarkedActor = authUser(
      '550e8400-e29b-41d4-a716-446655440053',
      'k2ha-123456789-1-1111111111111111@example.invalid',
      null,
    );
    const admin = adminWithUsers([markedActor, unmarkedActor, secondUnmarkedActor]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: markedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: markedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') })
      .mockResolvedValueOnce({ data: { user: unmarkedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: unmarkedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') })
      .mockResolvedValueOnce({ data: { user: secondUnmarkedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: secondUnmarkedActor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    const residueProof = vi.fn()
      .mockRejectedValueOnce(new Error('schema fingerprint changed'))
      .mockRejectedValueOnce(new Error('schema fingerprint still changed'))
      .mockResolvedValueOnce(undefined);

    await expect(cleanupK2RunActors(cfg, admin, residueProof, NOW.getTime()))
      .rejects.toThrow('deleted actor residue proof failed');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(3);
    expect(admin.auth.admin.deleteUser).toHaveBeenNthCalledWith(1, markedActor.id);
    expect(admin.auth.admin.deleteUser).toHaveBeenNthCalledWith(2, unmarkedActor.id);
    expect(admin.auth.admin.deleteUser).toHaveBeenNthCalledWith(3, secondUnmarkedActor.id);
    expect(residueProof).toHaveBeenCalledTimes(3);
    expect(residueProof).toHaveBeenNthCalledWith(1, markedActor.id);
    expect(residueProof).toHaveBeenNthCalledWith(2, unmarkedActor.id);
    expect(residueProof).toHaveBeenNthCalledWith(3, secondUnmarkedActor.id);
  });

  it('recovers only a confirmed, never-signed-in unmarked actor from this run attempt prefix', async () => {
    const current = config({ githubRunAttempt: '3' });
    const actor = authUser(
      '550e8400-e29b-41d4-a716-446655440036',
      'k2ha-123456789-2-aaaaaaaaaaaaaaaa@example.invalid',
      null,
    );
    const admin = adminWithUsers([actor]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: actor }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    const verifyDeleted = vi.fn(async () => undefined);

    await expect(reapExpiredK2Actors(current, admin, NOW.getTime()))
      .rejects.toThrow('unmarked reserved actor');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    await expect(reapExpiredK2Actors(
      current,
      admin,
      NOW.getTime(),
      undefined,
      { allowSameRunUnmarked: current },
    )).resolves.toBe(0);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    await expect(cleanupK2RunActors(current, admin, verifyDeleted, NOW.getTime())).resolves.toBe(1);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(actor.id);
    expect(verifyDeleted).toHaveBeenCalledOnce();
    expect(verifyDeleted).toHaveBeenCalledWith(actor.id);
    expect(admin.todayPlanDeleteFilter).toHaveBeenCalledExactlyOnceWith('user_id', actor.id);
    expect(admin.cleanupEvents.indexOf(`delete:user_id:${actor.id}`))
      .toBeLessThan(admin.cleanupEvents.indexOf(`auth-delete:${actor.id}`));
  });

  it.each([
    ['unconfirmed', { email_confirmed_at: null }],
    ['already signed in', { last_sign_in_at: NOW.toISOString() }],
  ])('refuses an unmarked recovery identity that is %s', async (_reason, override) => {
    const actor = {
      ...authUser(
        '550e8400-e29b-41d4-a716-446655440039',
        'k2ha-123456789-1-aaaaaaaaaaaaaaaa@example.invalid',
        null,
      ),
      ...override,
    } as User;
    const admin = adminWithUsers([actor]);

    await expect(cleanupK2RunActors(config({ githubRunAttempt: '2' }), admin, undefined, NOW.getTime()))
      .rejects.toThrow('stale or ambiguous');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses deletion when an unmarked recovery identity changes after enumeration', async () => {
    const listed = authUser(
      '550e8400-e29b-41d4-a716-446655440040',
      'k2ha-123456789-1-aaaaaaaaaaaaaaaa@example.invalid',
      null,
    );
    const changed = authUser(listed.id, 'different@example.invalid', null);
    const admin = adminWithUsers([listed]);
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { user: changed }, error: null });

    await expect(cleanupK2RunActors(config({ githubRunAttempt: '2' }), admin, undefined, NOW.getTime()))
      .rejects.toThrow('recovery identity changed');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('does not delete a reserved-prefix user_metadata decoy from another run', async () => {
    const decoy = authUser(
      '550e8400-e29b-41d4-a716-446655440037',
      'k2ha-999999999-1-aaaaaaaaaaaaaaaa@example.invalid',
      null,
      { [K2_HOSTED_MARKER_KEY]: ownership(config({ githubRunId: '999999999' })) },
    );
    const admin = adminWithUsers([decoy]);

    await expect(assertNoK2ActorsRemain(config(), admin)).rejects.toThrow('another reserved Auth actor');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('fails closed for stale unmarked same-run recovery identities', async () => {
    const staleAt = new Date(NOW.getTime() - K2_HOSTED_UNMARKED_RECOVERY_MAX_AGE_MS - 1).toISOString();
    const stale = {
      ...authUser(
        '550e8400-e29b-41d4-a716-446655440038',
        'k2ha-123456789-1-aaaaaaaaaaaaaaaa@example.invalid',
        null,
      ),
      created_at: staleAt,
      email_confirmed_at: staleAt,
    } as User;
    const admin = adminWithUsers([stale]);

    await expect(cleanupK2RunActors(config({ githubRunAttempt: '2' }), admin, undefined, NOW.getTime()))
      .rejects.toThrow('stale or ambiguous');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('fails closed when same-run unmarked recovery cannot complete Auth enumeration', async () => {
    const listUsers = vi.fn()
      .mockResolvedValueOnce({
        data: { users: [], nextPage: null, lastPage: 0, total: 0 },
        error: null,
      })
      .mockRejectedValueOnce(new Error('provider details suppressed'));
    const admin = {
      auth: { admin: { ...adminWithUsers([]).auth.admin, listUsers } },
    } as unknown as K2AdminClient;

    await expect(cleanupK2RunActors(config(), admin)).rejects.toThrow('Auth enumeration failed');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('blocks the retained baseline while another unexpired marked staging run exists', async () => {
    const foreignConfig = config({ githubRunId: '999999999' });
    const foreignMark = ownership(foreignConfig, new Date(NOW.getTime() - 10_000));
    const foreignActor = authUser(
      '550e8400-e29b-41d4-a716-446655440019',
      'k2ha-999999999-2-cccccccccccccccc@example.invalid',
      foreignMark,
    );
    const admin = adminWithUsers([foreignActor]);

    await expect(assertNoK2ActorsRemain(config(), admin)).rejects.toThrow('baseline and actor creation stopped');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(admin.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it('accepts only an exact per-response Render source SHA attestation', async () => {
    const expected = 'a'.repeat(40);
    const request = vi.fn(async () => new Response(JSON.stringify({
      service: 'lingua-api', status: 'ok', sourceSha: expected,
    }), {
      status: 200,
      headers: { 'x-lingua-source-sha': expected, 'cache-control': 'no-store' },
    }));

    await expect(verifyK2StagingApiHealth(
      'https://lingua-api-staging.onrender.com', expected, request,
    )).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('derives the unique immutable Vercel origin from a successful deployment for the exact SHA', async () => {
    const sha = 'a'.repeat(40);
    const origin = 'https://lingua-os-abcdef123-haizx71-6910.vercel.app';
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname.endsWith('/deployments')) {
        return new Response(JSON.stringify([{
          id: 6694099896,
          sha,
          ref: sha,
          environment: 'Production',
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{
        state: 'success',
        environment_url: origin,
        target_url: origin,
        log_url: origin,
        creator: { login: 'vercel[bot]' },
      }]), { status: 200 });
    });

    await expect(verifyK2HostedDeploymentAttestations(config({ githubSha: sha }), request))
      .resolves.toBe(origin);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects stale, mismatched, untrusted, or ambiguous Vercel deployment attestations', async () => {
    const sha = 'a'.repeat(40);
    const deploymentOrigin = 'https://lingua-os-abcdef123-haizx71-6910.vercel.app';
    const createRequest = (
      deploymentShas: readonly string[],
      statuses: readonly Record<string, unknown>[],
    ) => vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname.endsWith('/deployments')) {
        return new Response(JSON.stringify(deploymentShas.map((deploymentSha, index) => ({
          id: 100 + index,
          sha: deploymentSha,
          ref: deploymentSha,
          environment: 'Production',
        }))), { status: 200 });
      }
      const deploymentId = Number(url.pathname.split('/').at(-2));
      const status = statuses[deploymentId - 100];
      return new Response(JSON.stringify(status ? [status] : []), { status: 200 });
    });
    const goodStatus = {
      state: 'success',
      environment_url: deploymentOrigin,
      target_url: deploymentOrigin,
      log_url: deploymentOrigin,
      creator: { login: 'vercel[bot]' },
    };

    await expect(verifyK2HostedDeploymentAttestations(
      config({ githubSha: sha }), createRequest(['b'.repeat(40)], [goodStatus]),
    )).rejects.toThrow('no successful Vercel Production deployment');
    await expect(verifyK2HostedDeploymentAttestations(
      config({ githubSha: sha }),
      createRequest([sha, sha], [
        goodStatus,
        {
          ...goodStatus,
          environment_url: 'https://lingua-os-xyz987654-haizx71-6911.vercel.app',
          target_url: 'https://lingua-os-xyz987654-haizx71-6911.vercel.app',
          log_url: 'https://lingua-os-xyz987654-haizx71-6911.vercel.app',
        },
      ]),
    )).rejects.toThrow('no successful Vercel Production deployment');
    await expect(verifyK2HostedDeploymentAttestations(
      config({ githubSha: sha }),
      createRequest([sha], [{ ...goodStatus, creator: { login: 'untrusted[bot]' } }]),
    )).rejects.toThrow('no successful Vercel Production deployment');
    await expect(verifyK2HostedDeploymentAttestations(
      config({ githubSha: sha }),
      createRequest([sha], [{
        ...goodStatus,
        log_url: 'https://lingua-os-abcdef123-haizx71-6911.vercel.app',
      }]),
    )).rejects.toThrow('no successful Vercel Production deployment');
    await expect(verifyK2HostedDeploymentAttestations(
      config({ githubSha: sha }),
      createRequest([sha], [{
        ...goodStatus,
        environment_url: 'https://lingua-os-preview.vercel.app',
        target_url: 'https://lingua-os-preview.vercel.app',
        log_url: 'https://lingua-os-preview.vercel.app',
      }]),
    )).rejects.toThrow('no successful Vercel Production deployment');
  });

  it('requires an exact live master ref before staging preflight can continue', async () => {
    const expectedSha = 'a'.repeat(40);
    const request = vi.fn(async () => new Response(JSON.stringify({
      ref: 'refs/heads/master',
      object: { type: 'commit', sha: expectedSha },
    }), { status: 200 }));
    await expect(verifyK2HostedCurrentMasterSha(config({ githubSha: expectedSha }), request))
      .resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://api.github.com/repos/haizx71/lingua-os/git/ref/heads/master' }),
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it.each([
    [{ ref: 'refs/heads/master', object: { type: 'commit', sha: 'b'.repeat(40) } }],
    [{ ref: 'refs/heads/other', object: { type: 'commit', sha: 'a'.repeat(40) } }],
    [{ ref: 'refs/heads/master', object: { type: 'tag', sha: 'a'.repeat(40) } }],
    [{ ref: 'refs/heads/master', object: { type: 'commit', sha: 'malformed' } }],
  ])('fails closed when live master differs or the ref response is malformed', async payload => {
    const request = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    await expect(verifyK2HostedCurrentMasterSha(config(), request))
      .rejects.toThrow('source SHA is not the current master tip');
  });

  it('fails closed if current-master lookup errors or redirects', async () => {
    const failure = vi.fn(async () => { throw new Error('provider details are not surfaced'); });
    await expect(verifyK2HostedCurrentMasterSha(config(), failure))
      .rejects.toThrow('could not verify the current master source SHA');
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://attacker.example/' } }));
    await expect(verifyK2HostedCurrentMasterSha(config(), redirect))
      .rejects.toThrow('could not verify the current master source SHA');
  });

  it.each([
    [undefined, 'a'.repeat(40)],
    ['not-a-sha', 'a'.repeat(40)],
    ['b'.repeat(40), 'a'.repeat(40)],
  ])('fails closed for missing, malformed, or stale Render source attestations', async (headerSha, bodySha) => {
    const expected = 'a'.repeat(40);
    const request = vi.fn(async () => new Response(JSON.stringify({
      service: 'lingua-api', status: 'ok', sourceSha: bodySha,
    }), {
      status: 200,
      headers: headerSha ? { 'x-lingua-source-sha': headerSha } : {},
    }));
    await expect(verifyK2StagingApiHealth(
      'https://lingua-api-staging.onrender.com', expected, request,
    )).rejects.toThrow('health response was invalid');
  });

  it('rejects an arbitrary OIDC URL before sending the runtime request token', async () => {
    const request = vi.fn();
    let failureMessage = '';
    try {
      await createGithubTrustedSourceToken({
        oidcRequestUrl: 'https://attacker.example/hidden-path?redacted-query=redacted-value',
        oidcRequestToken: 'runtime-secret-placeholder',
      }, request);
    } catch (error) {
      if (error instanceof Error) failureMessage = error.message;
    }
    expect(failureMessage).toContain('hostname=other');
    expect(failureMessage).toContain('hostnameAllowed=false');
    expect(failureMessage).not.toContain('attacker.example');
    expect(failureMessage).not.toContain('hidden-path');
    expect(failureMessage).not.toContain('redacted-query');
    expect(failureMessage).not.toContain('redacted-value');
    expect(failureMessage).not.toContain('runtime-secret-placeholder');
    expect(request).not.toHaveBeenCalled();
  });

  it('reports a trusted-domain hostname and validation flags without endpoint values', async () => {
    const request = vi.fn();
    let failureMessage = '';
    try {
      await createGithubTrustedSourceToken({
        oidcRequestUrl: 'http://runtime-user:runtime-password@vstoken.actions.githubusercontent.com:8443/private-path?redacted-query=redacted-value#redacted-fragment',
        oidcRequestToken: 'runtime-secret-placeholder',
      }, request);
    } catch (error) {
      if (error instanceof Error) failureMessage = error.message;
    }
    expect(failureMessage).toContain('hostname=vstoken.actions.githubusercontent.com');
    expect(failureMessage).toContain('hostnameAllowed=false');
    expect(failureMessage).toContain('httpsInvalid=true');
    expect(failureMessage).toContain('portInvalid=true');
    expect(failureMessage).toContain('userinfoInvalid=true');
    expect(failureMessage).toContain('fragmentInvalid=true');
    for (const hiddenValue of [
      'runtime-user', 'runtime-password', 'private-path', 'redacted-query',
      'redacted-value', 'redacted-fragment', 'runtime-secret-placeholder',
    ]) {
      expect(failureMessage).not.toContain(hiddenValue);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('reports malformed OIDC endpoints without echoing their input', async () => {
    const request = vi.fn();
    let failureMessage = '';
    try {
      await createGithubTrustedSourceToken({
        oidcRequestUrl: 'malformed endpoint query-redacted-value',
        oidcRequestToken: 'runtime-secret-placeholder',
      }, request);
    } catch (error) {
      if (error instanceof Error) failureMessage = error.message;
    }
    expect(failureMessage).toContain('parseFailure=true');
    expect(failureMessage).toContain('hostname=unavailable');
    expect(failureMessage).toContain('httpsInvalid=unknown');
    expect(failureMessage).not.toContain('malformed endpoint');
    expect(failureMessage).not.toContain('query-redacted-value');
    expect(failureMessage).not.toContain('runtime-secret-placeholder');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ['global', 'https://pipelines.actions.githubusercontent.com/runtime/token', 'pipelines.actions.githubusercontent.com'],
    ['regional', 'https://pipelinesghubeus6.actions.githubusercontent.com/runtime/token', 'pipelinesghubeus6.actions.githubusercontent.com'],
    ['runner Azure', 'https://run-actions-1-azure-eastus.actions.githubusercontent.com/runtime/token', 'run-actions-1-azure-eastus.actions.githubusercontent.com'],
  ])('accepts the %s GitHub Actions OIDC host and refuses redirects', async (
    _kind: string,
    oidcRequestUrl: string,
    expectedHostname: string,
  ) => {
    let requestedHostname = '';
    let authorization = '';
    let redirectMode: RequestRedirect | undefined;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      requestedHostname = new URL(String(input)).hostname;
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      redirectMode = init?.redirect;
      return new Response(JSON.stringify({ value: 'trusted-source-token-placeholder' }), { status: 200 });
    });

    await expect(createGithubTrustedSourceToken({
      oidcRequestUrl,
      oidcRequestToken: 'runtime-oidc-token-placeholder',
    }, request)).resolves.toBe('trusted-source-token-placeholder');
    expect(requestedHostname).toBe(expectedHostname);
    expect(authorization).toBe('Bearer runtime-oidc-token-placeholder');
    expect(redirectMode).toBe('error');
  });

  it('mints the private fixture token only for its fixed internal audience', async () => {
    let requestedAudience = '';
    const request = vi.fn<typeof fetch>(async (input, init) => {
      requestedAudience = new URL(String(input)).searchParams.get('audience') ?? '';
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer runtime-oidc-token-placeholder');
      expect(init?.redirect).toBe('error');
      return Response.json({ value: 'fixture-token-placeholder' });
    });

    await expect(createK2HostedFixtureOidcToken({
      oidcRequestUrl: 'https://pipelines.actions.githubusercontent.com/runtime/token',
      oidcRequestToken: 'runtime-oidc-token-placeholder',
    }, request)).resolves.toBe('fixture-token-placeholder');
    expect(requestedAudience).toBe(K2_HOSTED_FIXTURE_OIDC_AUDIENCE);
  });

  it('sends only fixed fixture routes and uses GitHub read tokens on the approved operations', async () => {
    const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: new URL(String(input)), init });
      if (new URL(String(input)).pathname.endsWith('/setup')) {
        return Response.json({
          ...activeFixtureInspection(),
          disposition: 'created',
        });
      }
      if (new URL(String(input)).pathname.endsWith('/cleanup')) {
        return Response.json({
          protocolVersion: 'k2-09-bridge-fixture.v1',
          receiptState: 'CLOSED',
          fixturePresent: false,
          counts: FIXTURE_PRESENT_COUNTS,
        });
      }
      return Response.json(activeFixtureInspection());
    });
    const cfg = config({ apiOrigin: 'https://untrusted.invalid' });

    await requestK2HostedFixtureControl(cfg, 'inspect', 'oidc-placeholder', undefined, request);
    await requestK2HostedFixtureControl(cfg, 'inspect', 'oidc-placeholder', 'read-token-placeholder', request);
    await requestK2HostedFixtureControl(cfg, 'setup', 'oidc-placeholder', 'read-token-placeholder', request);
    await requestK2HostedFixtureControl(cfg, 'cleanup', 'oidc-placeholder', undefined, request);
    await expect(requestK2HostedFixtureControl(cfg, 'setup', 'oidc-placeholder', undefined, request))
      .rejects.toThrow('configuration was invalid');
    await expect(requestK2HostedFixtureControl(cfg, 'cleanup', 'oidc-placeholder', 'unexpected-token', request))
      .rejects.toThrow('configuration was invalid');

    expect(calls.map(({ url }) => url.href)).toEqual([
      `${K2_HOSTED_FIXTURE_API_ORIGIN}/internal/k2-hosted-fixtures/k2-09/inspect`,
      `${K2_HOSTED_FIXTURE_API_ORIGIN}/internal/k2-hosted-fixtures/k2-09/inspect`,
      `${K2_HOSTED_FIXTURE_API_ORIGIN}/internal/k2-hosted-fixtures/k2-09/setup`,
      `${K2_HOSTED_FIXTURE_API_ORIGIN}/internal/k2-hosted-fixtures/k2-09/cleanup`,
    ]);
    expect(calls.map(({ init }) => init?.method)).toEqual(['GET', 'GET', 'POST', 'POST']);
    expect(calls.every(({ url, init }) => url.search === '' && init?.body === undefined &&
      init?.redirect === 'error')).toBe(true);
    expect(new Headers(calls[0]?.init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER)).toBeNull();
    expect(new Headers(calls[1]?.init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER))
      .toBe('read-token-placeholder');
    expect(new Headers(calls[2]?.init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER))
      .toBe('read-token-placeholder');
    expect(new Headers(calls[3]?.init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER)).toBeNull();
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('recovers a committed fixture after setup response loss without retrying setup', async () => {
    const routes: string[] = [];
    let setupCount = 0;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      routes.push(`${init?.method}:${url.pathname}`);
      if (url.pathname.endsWith('/setup')) {
        setupCount += 1;
        expect(new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER))
          .toBe('test-github-placeholder');
        throw new Error('response lost');
      }
      expect(new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER)).toBeNull();
      return Response.json(activeFixtureInspection());
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(setupK2HostedFixtureWithRecovery(config())).resolves.toEqual(FIXTURE_DESCRIPTOR);
      expect(setupCount).toBe(1);
      expect(routes).toEqual([
        'POST:/internal/k2-hosted-fixtures/k2-09/setup',
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('starts from ACTIVE, retries a lost cleanup only after ACTIVE inspect, then proves CLOSED', async () => {
    const routes: Array<{ path: string; method: string | undefined; readToken: string | null }> = [];
    let activeInspectCount = 0;
    let cleanupCount = 0;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      routes.push({
        path: url.pathname,
        method: init?.method,
        readToken: new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER),
      });
      if (url.pathname.endsWith('/cleanup')) {
        cleanupCount += 1;
        if (cleanupCount === 1) throw new Error('response lost');
        return Response.json({
          protocolVersion: 'k2-09-bridge-fixture.v1',
          receiptState: 'CLOSED',
          fixturePresent: false,
          counts: FIXTURE_PRESENT_COUNTS,
        });
      }
      activeInspectCount += 1;
      return Response.json(activeInspectCount < 3 ? activeFixtureInspection() : closedFixtureInspection());
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(cleanupK2HostedFixtureWithRecovery(config())).resolves.toBe('closed');
      expect(cleanupCount).toBe(2);
      expect(activeInspectCount).toBe(3);
      expect(routes.map(({ method, path }) => `${method}:${path}`)).toEqual([
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
        'POST:/internal/k2-hosted-fixtures/k2-09/cleanup',
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
        'POST:/internal/k2-hosted-fixtures/k2-09/cleanup',
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
      ]);
      expect(routes.every(({ readToken }) => readToken === null)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('treats current-run ABSENT as a no-op only after authenticated exact-zero inspection', async () => {
    const routes: Array<{ path: string; method: string | undefined; readToken: string | null }> = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      const readToken = new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER);
      routes.push({ path: url.pathname, method: init?.method, readToken });
      if (!readToken) return Response.json(absentFixtureInspection());
      return Response.json(absentFixtureInspection());
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(cleanupK2HostedFixtureWithRecovery(config())).resolves.toBe('absent');
      expect(routes).toEqual([
        {
          path: '/internal/k2-hosted-fixtures/k2-09/inspect',
          method: 'GET',
          readToken: null,
        },
        {
          path: '/internal/k2-hosted-fixtures/k2-09/inspect',
          method: 'GET',
          readToken: 'test-github-placeholder',
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed when the current-master check rejects an ABSENT receipt and never posts cleanup', async () => {
    const routes: Array<{ path: string; method: string | undefined; readToken: string | null }> = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      const readToken = new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER);
      routes.push({ path: url.pathname, method: init?.method, readToken });
      return Response.json({ error: 'forbidden' }, { status: 403 });
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(cleanupK2HostedFixtureWithRecovery(config()))
        .rejects.toThrow('could not be independently verified');
      expect(routes.map(({ method, path }) => `${method}:${path}`)).toEqual([
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
        'GET:/internal/k2-hosted-fixtures/k2-09/inspect',
      ]);
      expect(routes[0]?.readToken).toBeNull();
      expect(routes[1]?.readToken).toBe('test-github-placeholder');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects authenticated ABSENT with any fixture rows instead of treating it as a no-op', async () => {
    const routes: Array<{ method: string | undefined; readToken: string | null }> = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      const readToken = new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER);
      routes.push({ method: init?.method, readToken });
      if (!readToken) return Response.json({ error: 'forbidden' }, { status: 403 });
      return Response.json({ ...absentFixtureInspection(), counts: FIXTURE_PRESENT_COUNTS });
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(cleanupK2HostedFixtureWithRecovery(config()))
        .rejects.toThrow('could not be independently verified');
      expect(routes.map(route => route.method)).toEqual(['GET', 'GET']);
      expect(routes[1]?.readToken).toBe('test-github-placeholder');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ['ACTIVE', activeFixtureInspection(), 'active'],
    ['CLOSED', closedFixtureInspection(), 'closed'],
  ] as const)('handles an existing %s receipt without GitHub-read fallback', async (_name, inspection, state) => {
    const routes: Array<{ path: string; method: string | undefined; readToken: string | null }> = [];
    let cleanupCount = 0;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      const readToken = new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER);
      routes.push({ path: url.pathname, method: init?.method, readToken });
      if (url.pathname.endsWith('/cleanup')) {
        cleanupCount += 1;
        return Response.json({
          protocolVersion: 'k2-09-bridge-fixture.v1',
          receiptState: 'CLOSED',
          fixturePresent: false,
          counts: FIXTURE_PRESENT_COUNTS,
        });
      }
      return Response.json(state === 'active' && cleanupCount > 0 ? closedFixtureInspection() : inspection);
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(cleanupK2HostedFixtureWithRecovery(config())).resolves.toBe('closed');
      expect(cleanupCount).toBe(state === 'active' ? 1 : 0);
      expect(routes.every(route => route.readToken === null)).toBe(true);
      expect(routes[0]?.path).toBe('/internal/k2-hosted-fixtures/k2-09/inspect');
      if (state === 'active') {
        expect(routes.map(({ method }) => method)).toEqual(['GET', 'POST', 'GET']);
      } else {
        expect(routes.map(({ method }) => method)).toEqual(['GET']);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['never reaches the controller', 'loses its uncommitted response'] as const)(
    'leaves setup that %s failed while current-run cleanup proves ABSENT', async setupFailure => {
    const routes: Array<{ path: string; method: string | undefined; readToken: string | null }> = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname.endsWith('actions.githubusercontent.com')) {
        return Response.json({ value: 'fixture-oidc-placeholder' });
      }
      const readToken = new Headers(init?.headers).get(K2_HOSTED_FIXTURE_READ_TOKEN_HEADER);
      routes.push({ path: url.pathname, method: init?.method, readToken });
      if (url.pathname.endsWith('/setup')) {
        if (setupFailure === 'never reaches the controller') {
          return Response.json({ error: 'unavailable' }, { status: 503 });
        }
        throw new Error('setup response lost before commit');
      }
      if (!readToken) return Response.json({ error: 'forbidden' }, { status: 403 });
      return Response.json(absentFixtureInspection());
    });
    vi.stubGlobal('fetch', request);
    try {
      await expect(setupK2HostedFixtureWithRecovery(config()))
        .rejects.toThrow('setup could not be confirmed');
      await expect(cleanupK2HostedFixtureWithRecovery(config())).resolves.toBe('absent');
      expect(routes.some(({ method, path }) => method === 'POST' && path.endsWith('/cleanup'))).toBe(false);
      expect(routes.filter(({ path }) => path.endsWith('/setup'))).toHaveLength(1);
      expect(routes.at(-1)?.readToken).toBe('test-github-placeholder');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ['a nested subdomain', 'https://pipelines.attacker.actions.githubusercontent.com/runtime/token'],
    ['a suffix lookalike', 'https://pipelines.actions.githubusercontent.com.attacker.example/runtime/token'],
    ['a nested runner host', 'https://run-actions-1-azure-eastus.attacker.actions.githubusercontent.com/runtime/token'],
    ['a runner-host suffix lookalike', 'https://run-actions-1-azure-eastus.actions.githubusercontent.com.attacker.example/runtime/token'],
    ['a runner-host lookalike outside Actions', 'https://run-actions-1-azure-eastus.actions.example.com/runtime/token'],
    ['a runner host with a nonnumeric slot', 'https://run-actions-eastus-azure-eastus.actions.githubusercontent.com/runtime/token'],
    ['an insecure scheme', 'http://pipelines.actions.githubusercontent.com/runtime/token'],
    ['a nonstandard port', 'https://pipelines.actions.githubusercontent.com:8443/runtime/token'],
    ['userinfo', 'https://attacker@pipelines.actions.githubusercontent.com/runtime/token'],
    ['a fragment', 'https://pipelines.actions.githubusercontent.com/runtime/token#fragment'],
  ])('rejects an OIDC endpoint with %s before sending the runtime request token', async (
    _case: string,
    oidcRequestUrl: string,
  ) => {
    const request = vi.fn();
    await expect(createGithubTrustedSourceToken({
      oidcRequestUrl,
      oidcRequestToken: 'runtime-secret-placeholder',
    }, request)).rejects.toThrow('OIDC request endpoint is invalid');
    expect(request).not.toHaveBeenCalled();
  });

  it('fails closed on a public Vercel deployment before sending the trusted-source token', async () => {
    const request = vi.fn(async () => new Response('public', { status: 200 }));
    await expect(verifyProtectedVercelOrigin(
      IMMUTABLE_VERCEL_ORIGIN,
      'trusted-source-token-placeholder',
      'a'.repeat(40),
      request,
    )).rejects.toThrow('target is not protected');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('scopes the Vercel OIDC header to the exact attested origin and strips it on third-party requests', () => {
    const attested = 'https://lingua-os-preview.vercel.app';
    const token = 'trusted-source-token-placeholder';
    const appHeaders = headersForK2ProtectedOrigin(
      `${attested}/auth`,
      { accept: 'text/html' },
      attested,
      token,
    );
    expect(appHeaders[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBe(token);

    const thirdParty = headersForK2ProtectedOrigin(
      'https://bdmtdvvnbicgkfririjo.supabase.co/auth/v1/token',
      { accept: 'application/json', [K2_VERCEL_TRUSTED_SOURCE_HEADER]: token },
      attested,
      token,
    );
    expect(thirdParty[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBeUndefined();
  });

  it('attests the immutable Production deployment before using the canonical browser origin', async () => {
    const request = mockFetchSequence(acceptedGateResponses());
    await expect(verifyProtectedVercelOrigin(
      IMMUTABLE_VERCEL_ORIGIN,
      'trusted-source-token-placeholder',
      'a'.repeat(40),
      request,
    )).resolves.toBe(CANONICAL_VERCEL_ORIGIN);
    expect(request).toHaveBeenCalledTimes(8);

    const callUrls = request.mock.calls.map(([input]) => new URL(String(input)).href);
    expect(callUrls).toEqual([
      `${IMMUTABLE_VERCEL_ORIGIN}/auth`,
      `${IMMUTABLE_VERCEL_ORIGIN}${K2_VERCEL_ATTESTATION_PATH}`,
      `${IMMUTABLE_VERCEL_ORIGIN}${K2_VERCEL_ATTESTATION_PATH}`,
      `${IMMUTABLE_VERCEL_ORIGIN}/auth`,
      `${CANONICAL_VERCEL_ORIGIN}${K2_VERCEL_ATTESTATION_PATH}`,
      `${CANONICAL_VERCEL_ORIGIN}/auth`,
      `${CANONICAL_VERCEL_ORIGIN}${K2_VERCEL_ATTESTATION_PATH}`,
      `${CANONICAL_VERCEL_ORIGIN}/auth`,
    ]);

    const tokenCalls = new Set([2, 3, 6, 7]);
    request.mock.calls.forEach(([input, init], index) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      expect(headers.has(K2_VERCEL_TRUSTED_SOURCE_HEADER)).toBe(tokenCalls.has(index));
      if (headers.has(K2_VERCEL_TRUSTED_SOURCE_HEADER)) {
        expect([
          IMMUTABLE_VERCEL_ORIGIN,
          CANONICAL_VERCEL_ORIGIN,
        ]).toContain(url.origin);
        expect(headers.get(K2_VERCEL_TRUSTED_SOURCE_HEADER)).toBe('trusted-source-token-placeholder');
        expect(url.search).toBe('');
        expect(url.hash).toBe('');
        expect(init?.body).toBeUndefined();
      }
      expect(init?.cache).toBe('no-store');
      expect(init?.redirect).toBe(['manual', 'manual', 'error', 'manual', 'manual', 'manual', 'error', 'manual'][index]);
    });
  });

  it.each([
    ['a SHA mismatch', { sourceSha: 'b'.repeat(40) }],
    ['a different immutable deployment', { deploymentOrigin: 'https://other.vercel.app' }],
    ['a deployment ID mismatch', { deploymentId: 'dpl_other12345678' }],
    ['a repository owner mismatch', { repositoryOwner: 'attacker' }],
    ['a repository mismatch', { repositorySlug: 'other-repo' }],
    ['a non-production environment', { environment: 'preview' }],
    ['a canonical-origin mismatch', { canonicalOrigin: 'https://attacker.example' }],
  ])('rejects canonical metadata containing %s before the login page request', async (_name, mismatch) => {
    const request = mockFetchSequence(acceptedGateResponses({ canonical: attestationResponse(mismatch) }));

    const failureMessage = await errorMessage(verifyProtectedVercelOrigin(
      IMMUTABLE_VERCEL_ORIGIN,
      'trusted-source-token-placeholder',
      'a'.repeat(40),
      request,
    ));
    expect(failureMessage).toMatch(/Vercel deployment attestation did not match|canonical-attestation response was invalid/);
    expect(request).toHaveBeenCalledTimes(7);
    expect(new URL(String(request.mock.calls[6][0])).origin).toBe(CANONICAL_VERCEL_ORIGIN);
    expect(new URL(String(request.mock.calls[6][0])).pathname).toBe(K2_VERCEL_ATTESTATION_PATH);
    expect(failureMessage).not.toContain('https://');
    expect(failureMessage).not.toContain('trusted-source-token-placeholder');
  });

  it.each([
    ['userinfo', 'https://user@lingua-os-web-mocha.vercel.app/auth'],
    ['query parameters', 'https://lingua-os-web-mocha.vercel.app/auth?token=private-query-marker'],
    ['an empty query delimiter', 'https://lingua-os-web-mocha.vercel.app/auth?'],
    ['a fragment', 'https://lingua-os-web-mocha.vercel.app/auth#private-fragment-marker'],
    ['an empty fragment delimiter', 'https://lingua-os-web-mocha.vercel.app/auth#'],
    ['an unknown origin', 'https://other-app.vercel.app/auth'],
    ['an insecure origin', 'http://lingua-os-web-mocha.vercel.app/auth'],
    ['a different path', 'https://lingua-os-web-mocha.vercel.app/today'],
  ])('does not send OIDC to the canonical host when the immutable redirect contains %s', async (_name, location) => {
    const request = mockFetchSequence(acceptedGateResponses({
      redirect: new Response(null, { status: 308, headers: { location, 'x-vercel-id': 'region::request-id' } }),
    }));

    const failureMessage = await errorMessage(verifyProtectedVercelOrigin(
      IMMUTABLE_VERCEL_ORIGIN,
      'trusted-source-token-placeholder',
      'a'.repeat(40),
      request,
    ));
    expect(failureMessage).toContain('protected Vercel access is not authorized');
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls.some(([input, init]) =>
      new URL(String(input)).origin === CANONICAL_VERCEL_ORIGIN &&
      new Headers(init?.headers).has(K2_VERCEL_TRUSTED_SOURCE_HEADER),
    )).toBe(false);
    expect(failureMessage).not.toContain('lingua-os-web-mocha.vercel.app');
    expect(failureMessage).not.toContain('private-query-marker');
    expect(failureMessage).not.toContain('private-fragment-marker');
  });

  it.each([5, 6])('stops before canonical OIDC when anonymous canonical request %i is not challenged', async requestNumber => {
    const responses = acceptedGateResponses();
    responses[requestNumber - 1] = new Response('public', { status: 200 });
    const request = mockFetchSequence(responses);

    await expect(verifyProtectedVercelOrigin(
      IMMUTABLE_VERCEL_ORIGIN,
      'trusted-source-token-placeholder',
      'a'.repeat(40),
      request,
    )).rejects.toThrow('target is not protected');
    expect(request).toHaveBeenCalledTimes(requestNumber);
    expect(request.mock.calls.some(([input, init]) =>
      new URL(String(input)).origin === CANONICAL_VERCEL_ORIGIN &&
      new Headers(init?.headers).has(K2_VERCEL_TRUSTED_SOURCE_HEADER),
    )).toBe(false);
  });

  it('requires an authorized canonical sign-in HTML response before returning the browser origin', async () => {
    const request = mockFetchSequence(acceptedGateResponses({
      auth: new Response('private-response-body-marker', {
        status: 308,
        headers: {
          location: 'https://lingua-os-web-mocha.vercel.app/auth?token=private-query-marker',
          'x-vercel-id': 'region::request-id',
          'set-cookie': 'session=private-cookie-marker',
          'content-type': 'application/json',
        },
      }),
    }));

    let failureMessage = '';
    try {
      await verifyProtectedVercelOrigin(
        IMMUTABLE_VERCEL_ORIGIN,
        'trusted-source-token-placeholder',
        'a'.repeat(40),
        request,
      );
    } catch (error) {
      if (error instanceof Error) failureMessage = error.message;
    }

    expect(failureMessage).toContain('status=308');
    expect(failureMessage).toContain('x-vercel-id=true');
    expect(failureMessage).toContain('redirect=same-origin');
    expect(failureMessage).toContain('no actor was created');
    expect(failureMessage).not.toContain('lingua-os-web-mocha.vercel.app');
    expect(failureMessage).not.toContain('private-query-marker');
    expect(failureMessage).not.toContain('private-cookie-marker');
    expect(failureMessage).not.toContain('private-response-body-marker');
    expect(failureMessage).not.toContain('trusted-source-token-placeholder');
  });

  it('reports only bounded response facts for a rejected trusted metadata request', async () => {
    const request = mockFetchSequence([
      vercelChallenge(),
      vercelChallenge(),
      new Response('private-response-body-marker', {
        status: 403,
        headers: { 'set-cookie': 'session=private-cookie-marker' },
      }),
    ]);

    let failureMessage = '';
    try {
      await verifyProtectedVercelOrigin(
        IMMUTABLE_VERCEL_ORIGIN,
        'trusted-source-token-placeholder',
        'a'.repeat(40),
        request,
      );
    } catch (error) {
      if (error instanceof Error) failureMessage = error.message;
    }

    expect(failureMessage).toContain('status=403');
    expect(failureMessage).toContain('x-vercel-id=false');
    expect(failureMessage).toContain('redirect=none');
    expect(failureMessage).not.toContain('private-response-body-marker');
    expect(failureMessage).not.toContain('private-cookie-marker');
    expect(failureMessage).not.toContain('trusted-source-token-placeholder');
  });

  it('normal actor sign-in suppresses provider details and checks identity parity', async () => {
    const actor = makeActor();
    const signInWithPassword = vi.fn(async () => ({
      data: { user: { id: actor.id } as User, session: { access_token: 'session-token-placeholder' } },
      error: null,
    }));
    const session = await authenticateK2HostedActor(actor, config(), {
      auth: { signInWithPassword, signOut: vi.fn() },
    });
    expect(session).toEqual({ userId: actor.id, accessToken: 'session-token-placeholder' });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: actor.email, password: actor.password });
  });
});
