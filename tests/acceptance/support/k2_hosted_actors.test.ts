import { AuthApiError, type User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  K2_HOSTED_MARKER_KEY,
  K2_HOSTED_READONLY_DATABASE_ROLE,
  K2_HOSTED_STAGING_SUPABASE_REF,
  K2_HOSTED_UNMARKED_RECOVERY_MAX_AGE_MS,
  K2_HOSTED_WORKFLOW_REF,
  authenticateK2HostedActor,
  createK2HostedActor,
  cleanupK2RunActors,
  cleanupK2Actor,
  cleanupFreshK2HostedActorIdentity,
  assertNoK2ActorsRemain,
  createGithubTrustedSourceToken,
  getK2ActorOwnership,
  reapExpiredK2Actors,
  validateK2HostedEnvironment,
  verifyK2StagingApiHealth,
  verifyK2HostedDeploymentAttestations,
  verifyProtectedVercelOrigin,
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

function config(overrides: Partial<K2HostedConfig> = {}): K2HostedConfig {
  return {
    apiOrigin: 'https://lingua-api-staging.onrender.com',
    supabaseUrl: `https://${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co`,
    supabaseProjectRef: K2_HOSTED_STAGING_SUPABASE_REF,
    publishableKey: 'test-publishable-placeholder',
    secretKey: 'test-admin-placeholder',
    readonlyDatabaseUrl:
      `postgresql://supabase_read_only_user:placeholder@db.${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co/postgres?sslmode=require`,
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

function adminWithUsers(users: readonly User[]): K2AdminClient {
  return {
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
        getUserById: vi.fn(),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  } as unknown as K2AdminClient;
}

describe('K2 hosted actor lifecycle boundaries', () => {
  it('pins staging project and the read-only database identity before any hosted client is created', () => {
    const env = {
      K2_STAGING_API_ORIGIN: 'https://lingua-api-staging.onrender.com',
      K2_STAGING_SUPABASE_URL: `https://${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co`,
      K2_STAGING_SUPABASE_PROJECT_REF: K2_HOSTED_STAGING_SUPABASE_REF,
      K2_STAGING_SUPABASE_PUBLISHABLE_KEY: 'placeholder',
      K2_STAGING_SUPABASE_SECRET_KEY: 'placeholder',
      K2_STAGING_READONLY_DATABASE_URL:
        `postgresql://${K2_HOSTED_READONLY_DATABASE_ROLE}:placeholder@db.${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co/postgres?sslmode=require`,
      GITHUB_REPOSITORY: 'haizx71/lingua-os',
      GITHUB_REF: 'refs/heads/master',
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_RUN_ID: '123456789',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_WORKFLOW: 'K2 Hosted Acceptance',
      GITHUB_WORKFLOW_REF: K2_HOSTED_WORKFLOW_REF,
      GITHUB_SHA: 'a'.repeat(40),
      K2_GITHUB_TOKEN: 'placeholder',
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/runtime/token',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'placeholder',
    };
    expect(validateK2HostedEnvironment(env).supabaseProjectRef).toBe(K2_HOSTED_STAGING_SUPABASE_REF);
    expect(() => validateK2HostedEnvironment({
      ...env,
      K2_STAGING_SUPABASE_PROJECT_REF: 'productionref123456',
      K2_STAGING_SUPABASE_URL: 'https://productionref123456.supabase.co',
      K2_STAGING_READONLY_DATABASE_URL:
        'postgresql://supabase_read_only_user:placeholder@db.productionref123456.supabase.co/postgres?sslmode=require',
    })).toThrow('Supabase project reference is invalid');
    expect(() => validateK2HostedEnvironment({
      ...env,
      K2_STAGING_READONLY_DATABASE_URL:
        `postgresql://postgres:placeholder@db.${K2_HOSTED_STAGING_SUPABASE_REF}.supabase.co/postgres?sslmode=require`,
    })).toThrow('read-only database URL');
  });

  it('uses marker comparison independent of JSONB key order and confirms canonical Auth absence', async () => {
    const cfg = config();
    const actor = makeActor(cfg);
    const user = authUser(actor.id, actor.email, reverseOwnershipKeys(actor.ownership));
    let lookup = 0;
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 2) return { data: { user }, error: null };
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
    expect(lookup).toBe(3);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(actor.id);
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
    const admin = {
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return { data: { user: user() }, error: null };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 2) return { data: { user: user() }, error: null };
            return { data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') };
          }),
          deleteUser: vi.fn(async () => ({ error: null })),
          listUsers: vi.fn(),
        },
      },
    } as unknown as K2AdminClient;

    await expect(createK2HostedActor(config(), admin, () => undefined, NOW))
      .rejects.toThrow('server-owned actor mark was not persisted');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(id);
    expect(lookup).toBe(3);
  });

  it('rolls back an exact partial identity when createUser reports an error with a user result', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440035';
    let email = '';
    let lookup = 0;
    const fresh: K2FreshActorIdentity[] = [];
    const admin = {
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
            if (lookup === 1) return { data: { user: authUser(id, email, null) }, error: null };
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
    expect(lookup).toBe(2);
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
      auth: {
        admin: {
          createUser: vi.fn(async (attributes: Record<string, unknown>) => {
            email = String(attributes.email);
            return { data: { user: authUser(id, email, null) }, error: null };
          }),
          getUserById: vi.fn(async () => {
            lookup += 1;
            if (lookup <= 2) return { data: { user: authUser(id, email, alteredMark) }, error: null };
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
    expect(lookup).toBe(3);
    expect(fresh).toHaveLength(1);
  });

  it('recovers the exact fresh identity in finally after rollback deletion and Auth listing both fail', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440034';
    let email = '';
    let lookup = 0;
    let deletion = 0;
    const fresh: K2FreshActorIdentity[] = [];
    const admin = {
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
          deleteUser: vi.fn(async () => {
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
    expect(lookup).toBe(3);
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
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('suppressed', 404, 'user_not_found') });
    (admin.auth.admin.getUserById as ReturnType<typeof vi.fn>).mockImplementation(lookup);
    const verifyDeleted = vi.fn(async () => undefined);

    await expect(cleanupK2RunActors(current, admin, verifyDeleted, NOW.getTime())).resolves.toBe(1);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(oldActor.id);
    expect(verifyDeleted).toHaveBeenCalledTimes(1);
    expect(verifyDeleted).toHaveBeenCalledWith(oldActor.id);
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
    await expect(createGithubTrustedSourceToken({
      oidcRequestUrl: 'https://attacker.example/steal',
      oidcRequestToken: 'runtime-secret-placeholder',
    }, request)).rejects.toThrow('OIDC request endpoint is invalid');
    expect(request).not.toHaveBeenCalled();
  });

  it('fails closed on a public Vercel deployment before sending the trusted-source token', async () => {
    const request = vi.fn(async () => new Response('public', { status: 200 }));
    await expect(verifyProtectedVercelOrigin(
      'https://lingua-os-preview.vercel.app',
      'trusted-source-token-placeholder',
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

  it('accepts only a Vercel Authentication redirect before using the OIDC header', async () => {
    let calls = 0;
    const request = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, {
          status: 302,
          headers: {
            location: 'https://vercel.com/sso-api?redirect=https%3A%2F%2Flingua-os-preview.vercel.app',
            'x-vercel-id': 'region::request-id',
          },
        });
      }
      return new Response('<html>app</html>', {
        status: 200,
        headers: { 'x-vercel-id': 'region::request-id' },
      });
    });
    await expect(verifyProtectedVercelOrigin(
      'https://lingua-os-preview.vercel.app',
      'trusted-source-token-placeholder',
      request,
    )).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
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
