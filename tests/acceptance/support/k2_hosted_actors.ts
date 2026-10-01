import { randomBytes } from 'node:crypto';
import {
  createClient,
  isAuthApiError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { DEFAULT_CANONICAL_WEB_ORIGIN } from '../../../apps/web/src/lib/routing/canonical-host';

export const K2_HOSTED_ENVIRONMENT = 'k2-staging';
export const K2_HOSTED_WORKFLOW = 'K2 Hosted Acceptance';
export const K2_HOSTED_REPOSITORY = 'haizx71/lingua-os';
export const K2_HOSTED_OWNER_LOGIN = 'haizx71';
export const K2_HOSTED_WORKFLOW_REF =
  `${K2_HOSTED_REPOSITORY}/.github/workflows/k2-hosted-acceptance.yml@refs/heads/master`;
export const K2_HOSTED_STAGING_SUPABASE_REF = 'bdmtdvvnbicgkfririjo';
export const K2_HOSTED_READONLY_DATABASE_ROLE = 'k2_hosted_acceptance_reader';
export const K2_HOSTED_MARKER_KEY = 'lingua_k2_hosted_acceptance';
export const K2_VERCEL_ATTESTATION_PATH = '/api/k2-vercel-attestation';
export const K2_HOSTED_ACTOR_TTL_MS = 2 * 60 * 60 * 1000;
export const K2_HOSTED_UNMARKED_RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const USER_EMAIL_PREFIX = 'k2ha-';
const USER_EMAIL_SUFFIX = '@example.invalid';
const USER_PAGE_SIZE = 200;
const MAX_USER_PAGES = 100;
const MAX_UNMARKED_RECOVERY_ACTORS_PER_RUN = 20;
// Keep accepted OIDC hosts to the observed GitHub Actions runner endpoint families.
const GITHUB_ACTIONS_OIDC_HOSTS = [
  /^pipelines[a-z0-9-]*\.actions\.githubusercontent\.com$/,
  /^run-actions-[0-9]+-azure-[a-z0-9]+(?:-[a-z0-9]+)*\.actions\.githubusercontent\.com$/,
] as const;

function isAllowedGithubActionsOidcHostname(hostname: string): boolean {
  return GITHUB_ACTIONS_OIDC_HOSTS.some(pattern => pattern.test(hostname));
}

export interface K2HostedConfig {
  readonly apiOrigin: string;
  readonly supabaseUrl: string;
  readonly supabaseProjectRef: string;
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly readonlyDatabaseUrl: string;
  readonly githubRepository: string;
  readonly githubRef: string;
  readonly githubEventName: string;
  readonly githubRunId: string;
  readonly githubRunAttempt: string;
  readonly githubWorkflow: string;
  readonly githubWorkflowRef: string;
  readonly githubSha: string;
  readonly githubToken: string;
  readonly oidcRequestUrl: string;
  readonly oidcRequestToken: string;
}

export interface K2ActorOwnership {
  readonly version: 2;
  readonly repository: string;
  readonly environment: string;
  readonly workflow: string;
  readonly workflowRef: string;
  readonly runId: string;
  readonly runAttempt: string;
  readonly projectRef: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface K2HostedActor {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly ownership: K2ActorOwnership;
}

export interface K2FreshActorIdentity {
  readonly id: string;
  readonly email: string;
  readonly ownership: K2ActorOwnership;
}

export interface K2AuthenticatedActor {
  readonly userId: string;
  readonly accessToken: string;
}

export interface K2AdminClient {
  readonly auth: {
    readonly admin: {
      createUser(attributes: Record<string, unknown>): Promise<{
        readonly data?: { readonly user?: User | null };
        readonly error: unknown | null;
      }>;
      listUsers(options: { readonly page: number; readonly perPage: number }): Promise<{
        readonly data?: {
          readonly users?: readonly User[];
          readonly nextPage?: number | null;
          readonly lastPage?: number;
          readonly total?: number;
        };
        readonly error: unknown | null;
      }>;
      getUserById(userId: string): Promise<{
        readonly data?: { readonly user?: User | null };
        readonly error: unknown | null;
      }>;
      deleteUser(userId: string): Promise<{ readonly error: unknown | null }>;
    };
  };
}

export interface K2LearnerClient {
  readonly auth: {
    signInWithPassword(credentials: { readonly email: string; readonly password: string }): Promise<{
      readonly data?: {
        readonly user?: User | null;
        readonly session?: { readonly access_token?: string | null } | null;
      };
      readonly error: unknown | null;
    }>;
    signOut(options?: { readonly scope?: 'global' | 'local' | 'others' }): Promise<{
      readonly error: unknown | null;
    }>;
  };
}

export function validateK2HostedEnvironment(
  env: Record<string, string | undefined> = process.env,
  mode: 'acceptance' | 'janitor' | 'cleanup-current' = 'acceptance',
): K2HostedConfig {
  const required = [
    'K2_STAGING_SUPABASE_URL',
    'K2_STAGING_SUPABASE_PROJECT_REF',
    'K2_STAGING_SUPABASE_SECRET_KEY',
    'K2_STAGING_READONLY_DATABASE_URL',
    'GITHUB_REPOSITORY',
    'GITHUB_REF',
    'GITHUB_EVENT_NAME',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'GITHUB_WORKFLOW',
    'GITHUB_WORKFLOW_REF',
    'GITHUB_SHA',
  ] as const;
  const acceptanceRequired = [
    'K2_STAGING_API_ORIGIN',
    'K2_STAGING_SUPABASE_PUBLISHABLE_KEY',
    'K2_GITHUB_TOKEN',
    'ACTIONS_ID_TOKEN_REQUEST_URL',
    'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  ] as const;
  const ownerActorRequired = mode !== 'janitor' || env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  const githubApiTokenRequired = mode !== 'cleanup-current';
  const missing = [
    ...required,
    ...(mode === 'acceptance' ? acceptanceRequired : []),
    ...(githubApiTokenRequired && mode !== 'acceptance' ? ['K2_GITHUB_TOKEN'] : []),
    ...(ownerActorRequired ? ['GITHUB_ACTOR', 'GITHUB_TRIGGERING_ACTOR'] : []),
  ]
    .filter(name => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`K2 hosted acceptance is not configured: missing ${missing.join(', ')}.`);
  }

  const supabaseProjectRef = env.K2_STAGING_SUPABASE_PROJECT_REF!.trim();
  if (supabaseProjectRef !== K2_HOSTED_STAGING_SUPABASE_REF) {
    throw new Error('K2 hosted acceptance Supabase project reference is invalid.');
  }

  let supabaseUrl: URL;
  let apiOrigin = '';
  let databaseUrl: URL;
  try {
    supabaseUrl = new URL(env.K2_STAGING_SUPABASE_URL!.trim());
    if (mode === 'acceptance') {
      const apiUrl = new URL(env.K2_STAGING_API_ORIGIN!.trim());
      if (
        apiUrl.protocol !== 'https:' ||
        apiUrl.hostname !== 'lingua-api-staging.onrender.com' ||
        apiUrl.username !== '' ||
        apiUrl.password !== '' ||
        apiUrl.pathname !== '/' ||
        apiUrl.search !== '' ||
        apiUrl.hash !== ''
      ) {
        throw new Error('invalid API origin');
      }
      apiOrigin = apiUrl.origin;
    }
    databaseUrl = new URL(env.K2_STAGING_READONLY_DATABASE_URL!.trim());
  } catch {
    throw new Error('K2 hosted acceptance staging endpoints are invalid.');
  }

  if (
    supabaseUrl.protocol !== 'https:' ||
    supabaseUrl.hostname !== `${supabaseProjectRef}.supabase.co` ||
    supabaseUrl.username !== '' ||
    supabaseUrl.password !== '' ||
    supabaseUrl.pathname !== '/' ||
    supabaseUrl.search !== '' ||
    supabaseUrl.hash !== ''
  ) {
    throw new Error('K2 hosted acceptance Supabase URL does not match the declared staging project.');
  }
  const databaseUsername = decodeURIComponent(databaseUrl.username);
  const poolerDatabaseTarget =
    databaseUrl.hostname === 'aws-0-ap-southeast-1.pooler.supabase.com' &&
    databaseUrl.port === '5432' &&
    databaseUsername === `${K2_HOSTED_READONLY_DATABASE_ROLE}.${supabaseProjectRef}`;
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !poolerDatabaseTarget ||
    !databaseUrl.password ||
    databaseUrl.pathname !== '/postgres' ||
    databaseUrl.search !== '?sslmode=verify-full' ||
    databaseUrl.hash !== ''
  ) {
    throw new Error('K2 hosted acceptance read-only database URL does not match the staging project.');
  }
  if (
    env.GITHUB_REPOSITORY !== K2_HOSTED_REPOSITORY ||
    env.GITHUB_REF !== 'refs/heads/master' ||
    (mode !== 'janitor' && env.GITHUB_EVENT_NAME !== 'workflow_dispatch') ||
    (mode === 'janitor' && !['workflow_dispatch', 'schedule'].includes(env.GITHUB_EVENT_NAME!)) ||
    env.GITHUB_WORKFLOW !== K2_HOSTED_WORKFLOW ||
    env.GITHUB_WORKFLOW_REF !== K2_HOSTED_WORKFLOW_REF ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA!.trim()) ||
    !/^\d{1,20}$/.test(env.GITHUB_RUN_ID!) ||
    !/^\d{1,5}$/.test(env.GITHUB_RUN_ATTEMPT!) ||
    (ownerActorRequired && (
      env.GITHUB_ACTOR!.trim().toLowerCase() !== K2_HOSTED_OWNER_LOGIN ||
      env.GITHUB_TRIGGERING_ACTOR!.trim().toLowerCase() !== K2_HOSTED_OWNER_LOGIN
    ))
  ) {
    throw new Error('K2 hosted acceptance must run from the exact master workflow under the repository owner.');
  }

  return {
    apiOrigin,
    supabaseUrl: supabaseUrl.origin,
    supabaseProjectRef,
    publishableKey: (env.K2_STAGING_SUPABASE_PUBLISHABLE_KEY ?? '').trim(),
    secretKey: env.K2_STAGING_SUPABASE_SECRET_KEY!.trim(),
    readonlyDatabaseUrl: env.K2_STAGING_READONLY_DATABASE_URL!.trim(),
    githubRepository: env.GITHUB_REPOSITORY!,
    githubRef: env.GITHUB_REF!,
    githubEventName: env.GITHUB_EVENT_NAME!,
    githubRunId: env.GITHUB_RUN_ID!,
    githubRunAttempt: env.GITHUB_RUN_ATTEMPT!,
    githubWorkflow: env.GITHUB_WORKFLOW!,
    githubWorkflowRef: env.GITHUB_WORKFLOW_REF!,
    githubSha: env.GITHUB_SHA!.trim(),
    githubToken: (env.K2_GITHUB_TOKEN ?? '').trim(),
    oidcRequestUrl: (env.ACTIONS_ID_TOKEN_REQUEST_URL ?? '').trim(),
    oidcRequestToken: (env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? '').trim(),
  };
}

export function createK2AdminClient(config: K2HostedConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.secretKey, {
    global: { fetch: boundedK2Fetch },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function createK2LearnerClient(config: K2HostedConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.publishableKey, {
    global: { fetch: boundedK2Fetch },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

const boundedK2Fetch: typeof fetch = (input, init) => {
  const deadline = AbortSignal.timeout(15_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  return fetch(input, { ...init, signal, redirect: 'error' });
};

export function getK2ActorOwnership(
  config: Pick<K2HostedConfig, 'githubRepository' | 'githubWorkflowRef' | 'githubRunId' | 'githubRunAttempt' | 'supabaseProjectRef'>,
  now = new Date(),
): K2ActorOwnership {
  const createdAt = now.toISOString();
  return {
    version: 2,
    repository: config.githubRepository,
    environment: K2_HOSTED_ENVIRONMENT,
    workflow: K2_HOSTED_WORKFLOW,
    workflowRef: config.githubWorkflowRef,
    runId: config.githubRunId,
    runAttempt: config.githubRunAttempt,
    projectRef: config.supabaseProjectRef,
    createdAt,
    expiresAt: new Date(now.getTime() + K2_HOSTED_ACTOR_TTL_MS).toISOString(),
  };
}

export async function createK2HostedActor(
  config: K2HostedConfig,
  admin: K2AdminClient,
  onFreshIdentity: (identity: K2FreshActorIdentity) => void,
  now = new Date(),
): Promise<K2HostedActor> {
  const ownership = getK2ActorOwnership(config, now);
  const suffix = randomBytes(8).toString('hex');
  const email = `${USER_EMAIL_PREFIX}${ownership.runId}-${ownership.runAttempt}-${suffix}${USER_EMAIL_SUFFIX}`;
  const password = `K2!${randomBytes(36).toString('base64url')}#9`;
  let response;
  try {
    response = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { [K2_HOSTED_MARKER_KEY]: ownership },
    });
  } catch {
    throw new Error('K2 hosted acceptance actor creation failed; provider details were suppressed.');
  }
  const created = response.data?.user;
  if (created?.id && created.email === email) {
    onFreshIdentity({ id: created.id, email, ownership });
  }
  if (response.error && created?.id && created.email === email) {
    await rollbackFreshActor(admin, created.id, email, ownership);
    throw new Error('K2 hosted acceptance actor creation returned an error; its exact fresh identity was rolled back.');
  }
  if (response.error || !created?.id || created.email !== email) {
    throw new Error('K2 hosted acceptance actor creation returned an invalid Auth identity.');
  }
  let persisted;
  try {
    persisted = await admin.auth.admin.getUserById(created.id);
  } catch {
    throw new Error('K2 hosted acceptance actor ownership mark could not be verified.');
  }
  if (persisted.error || !persisted.data?.user || persisted.data.user.id !== created.id ||
      persisted.data.user.email !== email) {
    throw new Error('K2 hosted acceptance actor ownership mark could not be verified.');
  }
  if (!ownershipMatches(persisted.data.user, ownership, email)) {
    await rollbackFreshActor(admin, created.id, email, ownership);
    throw new Error('K2 hosted acceptance server-owned actor mark was not persisted exactly; the fresh actor was rolled back.');
  }
  return { id: created.id, email, password, ownership };
}

/** Revalidates the exact current-process actor and server-owned run marker before fixture access. */
export async function verifyK2FreshActorOwnership(
  config: K2HostedConfig,
  actor: K2HostedActor,
  admin: K2AdminClient,
  now = Date.now(),
): Promise<void> {
  if (!exactTargetOwner(actor.ownership, config) ||
      actor.ownership.runId !== config.githubRunId ||
      actor.ownership.runAttempt !== config.githubRunAttempt ||
      !actorEmailMatches({ email: actor.email } as User, actor.ownership)) {
    throw new Error('K2 hosted acceptance fixture actor binding was not current-run owned.');
  }
  const expiry = validateExpiry(actor.ownership);
  if (expiry.expires <= now) {
    throw new Error('K2 hosted acceptance fixture actor binding expired.');
  }
  let fetched;
  try { fetched = await admin.auth.admin.getUserById(actor.id); }
  catch { throw new Error('K2 hosted acceptance fixture actor ownership could not be revalidated.'); }
  const user = fetched.data?.user;
  if (fetched.error || !user || user.id !== actor.id ||
      !ownershipMatches(user, actor.ownership, actor.email)) {
    throw new Error('K2 hosted acceptance fixture actor ownership could not be revalidated.');
  }
}

async function rollbackFreshActor(
  admin: K2AdminClient,
  userId: string,
  email: string,
  ownership: K2ActorOwnership,
): Promise<void> {
  let current;
  try {
    current = await admin.auth.admin.getUserById(userId);
  } catch {
    throw new Error('K2 hosted acceptance refused fresh actor rollback because identity could not be re-checked.');
  }
  if (isCanonicalUserNotFound(current.error)) return;
  const user = current.data?.user;
  if (current.error || !user || user.id !== userId || user.email !== email ||
      !actorEmailMatches(user, ownership)) {
    throw new Error('K2 hosted acceptance refused fresh actor rollback because identity did not match.');
  }
  try {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error('delete failed');
  } catch {
    throw new Error('K2 hosted acceptance could not roll back the fresh unmarked Auth actor.');
  }
  try {
    const after = await admin.auth.admin.getUserById(userId);
    if (!isCanonicalUserNotFound(after.error)) {
      throw new Error('actor remains');
    }
  } catch {
    throw new Error('K2 hosted acceptance could not verify fresh actor rollback.');
  }
}

export async function authenticateK2HostedActor(
  actor: K2HostedActor,
  config: K2HostedConfig,
  learner: K2LearnerClient = createK2LearnerClient(config) as unknown as K2LearnerClient,
): Promise<K2AuthenticatedActor> {
  let response;
  try {
    response = await learner.auth.signInWithPassword({ email: actor.email, password: actor.password });
  } catch {
    throw new Error('K2 hosted acceptance normal Auth sign-in failed; provider details were suppressed.');
  }
  const userId = response.data?.user?.id;
  const accessToken = response.data?.session?.access_token;
  if (response.error || !userId || userId !== actor.id || !accessToken) {
    throw new Error('K2 hosted acceptance normal Auth sign-in returned an invalid actor session.');
  }
  return { userId, accessToken };
}

function ownershipMatches(user: User, expected: K2ActorOwnership, expectedEmail: string): boolean {
  const appMetadata = user.app_metadata;
  const mark = appMetadata?.[K2_HOSTED_MARKER_KEY] as unknown;
  if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return false;
  const value = mark as Partial<K2ActorOwnership>;
  const expectedKeys = [
    'version', 'repository', 'environment', 'workflow', 'workflowRef', 'runId',
    'runAttempt', 'projectRef', 'createdAt', 'expiresAt',
  ];
  return Boolean(
    user.email === expectedEmail &&
      expectedEmail.startsWith(`${USER_EMAIL_PREFIX}${expected.runId}-${expected.runAttempt}-`) &&
      expectedEmail.endsWith(USER_EMAIL_SUFFIX) &&
      value.version === expected.version &&
      value.repository === expected.repository &&
      value.environment === expected.environment &&
      value.workflow === expected.workflow &&
      value.workflowRef === expected.workflowRef &&
      value.runId === expected.runId &&
      value.runAttempt === expected.runAttempt &&
      value.projectRef === expected.projectRef &&
      value.createdAt === expected.createdAt &&
      value.expiresAt === expected.expiresAt &&
      Object.keys(value).length === expectedKeys.length &&
      expectedKeys.every(key => Object.hasOwn(value, key))
  );
}

function readMarker(user: User): K2ActorOwnership | null {
  const appMetadata = user.app_metadata;
  if (!Object.hasOwn(appMetadata ?? {}, K2_HOSTED_MARKER_KEY)) return null;
  const mark = appMetadata[K2_HOSTED_MARKER_KEY] as Partial<K2ActorOwnership> | null;
  if (
    !mark ||
    typeof mark !== 'object' ||
    Array.isArray(mark) ||
    mark.version !== 2 ||
    typeof mark.repository !== 'string' ||
    typeof mark.environment !== 'string' ||
    typeof mark.workflow !== 'string' ||
    mark.workflowRef !== K2_HOSTED_WORKFLOW_REF ||
    !/^\d{1,20}$/.test(mark.runId ?? '') ||
    !/^\d{1,5}$/.test(mark.runAttempt ?? '') ||
    !/^[a-z0-9]{10,32}$/.test(mark.projectRef ?? '') ||
    typeof mark.createdAt !== 'string' ||
    typeof mark.expiresAt !== 'string' ||
    Object.keys(mark).length !== 10 ||
    ![
      'version', 'repository', 'environment', 'workflow', 'workflowRef', 'runId',
      'runAttempt', 'projectRef', 'createdAt', 'expiresAt',
    ].every(key => Object.hasOwn(mark, key))
  ) {
    throw new Error('K2 hosted acceptance found a malformed marked Auth actor; cleanup stopped.');
  }
  return mark as K2ActorOwnership;
}

function actorEmailMatches(user: User, ownership: K2ActorOwnership): boolean {
  const expectedPrefix = `${USER_EMAIL_PREFIX}${ownership.runId}-${ownership.runAttempt}-`;
  const email = user.email;
  return Boolean(
    email &&
      email.startsWith(expectedPrefix) &&
      email.endsWith(USER_EMAIL_SUFFIX) &&
      /^[a-f0-9]{16}$/.test(email.slice(expectedPrefix.length, -USER_EMAIL_SUFFIX.length))
  );
}

interface ReservedK2ActorAddress {
  readonly runId: string;
  readonly runAttempt: number;
}

function parseReservedK2ActorAddress(email: string | null | undefined): ReservedK2ActorAddress | null {
  if (!email) return null;
  const match = email.match(/^k2ha-(\d{1,20})-([1-9]\d{0,4})-([a-f0-9]{16})@example\.invalid$/);
  if (!match) return null;
  return { runId: match[1], runAttempt: Number(match[2]) };
}

function hasServerOwnedK2Marker(user: User): boolean {
  return Object.hasOwn(user.app_metadata ?? {}, K2_HOSTED_MARKER_KEY);
}

function validateUnmarkedRecoveryIdentity(user: User, now: number): void {
  if (hasServerOwnedK2Marker(user) || Object.hasOwn(user.user_metadata ?? {}, K2_HOSTED_MARKER_KEY)) {
    throw new Error('K2 hosted acceptance unmarked recovery found ambiguous ownership metadata; deletion stopped.');
  }
  const createdAt = Date.parse(user.created_at);
  const confirmedAt = Date.parse(user.email_confirmed_at ?? '');
  const clockSkewMs = 5 * 60 * 1000;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(confirmedAt) ||
    createdAt > now + clockSkewMs ||
    now - createdAt > K2_HOSTED_UNMARKED_RECOVERY_MAX_AGE_MS ||
    confirmedAt < createdAt - clockSkewMs ||
    confirmedAt > now + clockSkewMs ||
    user.last_sign_in_at !== null
  ) {
    throw new Error('K2 hosted acceptance unmarked recovery identity was stale or ambiguous; deletion stopped.');
  }
}

function exactTargetOwner(ownership: K2ActorOwnership, config: K2HostedConfig): boolean {
  return ownership.repository === config.githubRepository &&
    ownership.environment === K2_HOSTED_ENVIRONMENT &&
    ownership.workflow === config.githubWorkflow &&
    ownership.workflowRef === config.githubWorkflowRef &&
    ownership.projectRef === config.supabaseProjectRef;
}

function validateExpiry(ownership: K2ActorOwnership): { created: number; expires: number } {
  const created = Date.parse(ownership.createdAt);
  const expires = Date.parse(ownership.expiresAt);
  if (
    !Number.isFinite(created) ||
    !Number.isFinite(expires) ||
    expires <= created ||
    expires - created > K2_HOSTED_ACTOR_TTL_MS
  ) {
    throw new Error('K2 hosted acceptance found an invalid actor expiry; cleanup stopped.');
  }
  return { created, expires };
}

async function listUsersBounded(admin: K2AdminClient): Promise<readonly User[]> {
  const users: User[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    let result;
    try {
      result = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE });
    } catch {
      throw new Error('K2 hosted acceptance Auth enumeration failed; no actors were deleted.');
    }
    const pageUsers = result.data?.users;
    const pagination = result.data;
    if (result.error || !pagination || !Array.isArray(pageUsers) ||
        (pagination?.nextPage !== null && typeof pagination?.nextPage !== 'number') ||
        typeof pagination.lastPage !== 'number' ||
        typeof pagination.total !== 'number' ||
        !Number.isInteger(pagination.lastPage) ||
        !Number.isInteger(pagination.total) ||
        pagination.lastPage < 0 ||
        pagination.total < users.length + pageUsers.length) {
      throw new Error('K2 hosted acceptance Auth enumeration was incomplete; no actors were deleted.');
    }
    if (pagination.total === 0) {
      if (page !== 1 || pageUsers.length !== 0 || pagination.nextPage !== null ||
          pagination.lastPage !== 0 && pagination.lastPage !== 1) {
        throw new Error('K2 hosted acceptance Auth pagination metadata was inconsistent; no actors were deleted.');
      }
      return users;
    }
    if (pagination.lastPage < 1 || pagination.lastPage < page) {
      throw new Error('K2 hosted acceptance Auth enumeration was incomplete; no actors were deleted.');
    }
    for (const user of pageUsers) {
      if (!user?.id || seen.has(user.id)) {
        throw new Error('K2 hosted acceptance Auth enumeration was ambiguous; no actors were deleted.');
      }
      seen.add(user.id);
      users.push(user);
    }
    const expectedNextPage = page < pagination.lastPage ? page + 1 : null;
    if (pagination.nextPage !== expectedNextPage) {
      throw new Error('K2 hosted acceptance Auth pagination metadata was inconsistent; no actors were deleted.');
    }
    if (page === pagination.lastPage) {
      if (users.length !== pagination.total) {
        throw new Error('K2 hosted acceptance Auth pagination was incomplete; no actors were deleted.');
      }
      return users;
    }
    if (pageUsers.length === 0) {
      throw new Error('K2 hosted acceptance Auth pagination stopped early; no actors were deleted.');
    }
  }
  throw new Error('K2 hosted acceptance Auth enumeration exceeded its page limit; no actors were deleted.');
}

async function deleteExactMarkedUser(
  admin: K2AdminClient,
  user: User,
  ownership: K2ActorOwnership,
): Promise<void> {
  validateExpiry(ownership);
  if (!user.email || !actorEmailMatches(user, ownership)) {
    throw new Error('K2 hosted acceptance cleanup refused an actor whose reserved address did not match.');
  }
  let fetched;
  try {
    fetched = await admin.auth.admin.getUserById(user.id);
  } catch {
    throw new Error('K2 hosted acceptance cleanup could not re-check Auth ownership.');
  }
  if (fetched.error || !fetched.data?.user || fetched.data.user.id !== user.id ||
      !ownershipMatches(fetched.data.user, ownership, user.email)) {
    throw new Error('K2 hosted acceptance cleanup refused an actor whose ownership mark changed.');
  }
  try {
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw new Error('delete rejected');
  } catch {
    throw new Error('K2 hosted acceptance Auth deletion failed; the guarded janitor may retry after TTL.');
  }
  try {
    const after = await admin.auth.admin.getUserById(user.id);
    if (!isAuthApiError(after.error) || after.error.status !== 404 || after.error.code !== 'user_not_found') {
      throw new Error('identity still present');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'identity still present') {
      throw new Error('K2 hosted acceptance Auth deletion could not be verified.');
    }
    if (!isCanonicalUserNotFound(error)) {
      throw new Error('K2 hosted acceptance Auth deletion verification failed.');
    }
  }
}

function isCanonicalUserNotFound(error: unknown): boolean {
  return isAuthApiError(error) && error.status === 404 && error.code === 'user_not_found';
}

async function candidateUsers(
  admin: K2AdminClient,
  config: K2HostedConfig,
): Promise<readonly { readonly user: User; readonly ownership: K2ActorOwnership }[]> {
  const users = await listUsersBounded(admin);
  const candidates: Array<{ user: User; ownership: K2ActorOwnership }> = [];
  for (const user of users) {
    const ownership = readMarker(user);
    if (!ownership || !exactTargetOwner(ownership, config)) continue;
    if (!actorEmailMatches(user, ownership)) {
      throw new Error('K2 hosted acceptance found a marked account outside its reserved address; cleanup stopped.');
    }
    validateExpiry(ownership);
    candidates.push({ user, ownership });
  }
  return candidates;
}

/** Deletes only expired marked actors from the exact protected staging project. */
export async function reapExpiredK2Actors(
  config: K2HostedConfig,
  admin: K2AdminClient = createK2AdminClient(config) as unknown as K2AdminClient,
  now = Date.now(),
  verifyDeletedActor?: (actorId: string) => Promise<void>,
  options: { readonly allowSameRunUnmarked?: Pick<K2HostedConfig, 'githubRunId' | 'githubRunAttempt'> } = {},
): Promise<number> {
  const candidates = await candidateUsers(admin, config);
  const expired = candidates.filter(candidate => validateExpiry(candidate.ownership).expires <= now);
  let verificationFailed = false;
  for (const candidate of expired) {
    await deleteExactMarkedUser(admin, candidate.user, candidate.ownership);
    if (verifyDeletedActor) {
      try { await verifyDeletedActor(candidate.user.id); }
      catch { verificationFailed = true; }
    }
  }
  await assertNoUnmarkedReservedK2Actor(admin, options.allowSameRunUnmarked, now);
  if (verificationFailed) throw new Error('K2 hosted acceptance deleted actor residue proof failed.');
  return expired.length;
}

/** Backwards-compatible entry point for same-run recovery across interrupted attempts. */
export async function cleanupCurrentK2RunActors(
  config: K2HostedConfig,
  admin: K2AdminClient = createK2AdminClient(config) as unknown as K2AdminClient,
  verifyDeletedActor?: (actorId: string) => Promise<void>,
): Promise<number> {
  return cleanupK2RunActors(config, admin, verifyDeletedActor);
}

async function assertNoUnmarkedReservedK2Actor(
  admin: K2AdminClient,
  allowSameRun?: Pick<K2HostedConfig, 'githubRunId' | 'githubRunAttempt'>,
  now = Date.now(),
): Promise<void> {
  const users = await listUsersBounded(admin);
  for (const user of users) {
    const address = parseReservedK2ActorAddress(user.email);
    if (!address || hasServerOwnedK2Marker(user)) continue;
    if (!allowSameRun || address.runId !== allowSameRun.githubRunId ||
        address.runAttempt > Number(allowSameRun.githubRunAttempt)) {
      throw new Error('K2 hosted acceptance found an unmarked reserved actor; baseline and cleanup status are blocked.');
    }
    validateUnmarkedRecoveryIdentity(user, now);
  }
}

async function recoverUnmarkedSameRunActors(
  config: K2HostedConfig,
  admin: K2AdminClient,
  verifyDeletedActor?: (actorId: string) => Promise<void>,
  now = Date.now(),
): Promise<{ readonly recovered: number; readonly verificationFailed: boolean }> {
  const users = await listUsersBounded(admin);
  const currentAttempt = Number(config.githubRunAttempt);
  const candidates: User[] = [];
  const perAttemptCounts = new Map<number, number>();
  for (const user of users) {
    const address = parseReservedK2ActorAddress(user.email);
    if (!address || address.runId !== config.githubRunId || address.runAttempt > currentAttempt) continue;
    if (hasServerOwnedK2Marker(user)) continue;
    validateUnmarkedRecoveryIdentity(user, now);
    const attemptCount = (perAttemptCounts.get(address.runAttempt) ?? 0) + 1;
    if (attemptCount > 2) {
      throw new Error('K2 hosted acceptance found ambiguous same-run recovery identities; deletion stopped.');
    }
    perAttemptCounts.set(address.runAttempt, attemptCount);
    candidates.push(user);
  }
  if (candidates.length > MAX_UNMARKED_RECOVERY_ACTORS_PER_RUN) {
    throw new Error('K2 hosted acceptance same-run recovery exceeded its bounded actor count.');
  }

  let verificationFailed = false;
  for (const listed of candidates) {
    let current;
    try { current = await admin.auth.admin.getUserById(listed.id); }
    catch { throw new Error('K2 hosted acceptance same-run recovery could not re-check Auth identity.'); }
    if (isCanonicalUserNotFound(current.error)) {
      if (verifyDeletedActor) {
        try { await verifyDeletedActor(listed.id); }
        catch { verificationFailed = true; }
      }
      continue;
    }
    const user = current.data?.user;
    if (
      current.error || !user || user.id !== listed.id || user.email !== listed.email ||
      user.created_at !== listed.created_at || user.email_confirmed_at !== listed.email_confirmed_at ||
      user.last_sign_in_at !== null || hasServerOwnedK2Marker(user)
    ) {
      throw new Error('K2 hosted acceptance same-run recovery identity changed; deletion stopped.');
    }
    validateUnmarkedRecoveryIdentity(user, now);
    try {
      const deleted = await admin.auth.admin.deleteUser(user.id);
      if (deleted.error) throw new Error('delete failed');
    } catch {
      throw new Error('K2 hosted acceptance same-run Auth cleanup failed.');
    }
    let after;
    try { after = await admin.auth.admin.getUserById(user.id); }
    catch { throw new Error('K2 hosted acceptance same-run Auth absence proof failed.'); }
    if (!isCanonicalUserNotFound(after.error)) {
      throw new Error('K2 hosted acceptance same-run Auth absence proof failed.');
    }
    if (verifyDeletedActor) {
      try { await verifyDeletedActor(user.id); }
      catch { verificationFailed = true; }
    }
  }
  return { recovered: candidates.length, verificationFailed };
}

/** Cleans actors from this workflow run across interrupted/retried attempts only. */
export async function cleanupK2RunActors(
  config: K2HostedConfig,
  admin: K2AdminClient = createK2AdminClient(config) as unknown as K2AdminClient,
  verifyDeletedActor?: (actorId: string) => Promise<void>,
  now = Date.now(),
): Promise<number> {
  const currentAttempt = Number(config.githubRunAttempt);
  const candidates = await candidateUsers(admin, config);
  const owned = candidates.filter(candidate =>
    candidate.ownership.runId === config.githubRunId &&
    Number(candidate.ownership.runAttempt) <= currentAttempt
  );
  let verificationFailed = false;
  for (const candidate of owned) {
    await deleteExactMarkedUser(admin, candidate.user, candidate.ownership);
    if (verifyDeletedActor) {
      try { await verifyDeletedActor(candidate.user.id); }
      catch { verificationFailed = true; }
    }
  }
  const recovery = await recoverUnmarkedSameRunActors(config, admin, verifyDeletedActor, now);
  verificationFailed ||= recovery.verificationFailed;
  if (verificationFailed) throw new Error('K2 hosted acceptance deleted actor residue proof failed.');
  return owned.length + recovery.recovered;
}

/** No marked staging actor may be absorbed into the retained baseline. */
export async function assertNoK2ActorsRemain(
  config: K2HostedConfig,
  admin: K2AdminClient = createK2AdminClient(config) as unknown as K2AdminClient,
): Promise<void> {
  const candidates = await candidateUsers(admin, config);
  if (candidates.length > 0) {
    throw new Error('K2 hosted acceptance found another marked staging actor; baseline and actor creation stopped.');
  }
  const users = await listUsersBounded(admin);
  if (users.some(user => parseReservedK2ActorAddress(user.email))) {
    throw new Error('K2 hosted acceptance found another reserved Auth actor; baseline and actor creation stopped.');
  }
}

/** Auth hard-delete is the only hosted mutation; it triggers the accepted erasure cascade. */
export async function cleanupK2Actor(
  config: K2HostedConfig,
  actor: K2HostedActor,
  admin: K2AdminClient = createK2AdminClient(config) as unknown as K2AdminClient,
  learner?: K2LearnerClient,
): Promise<void> {
  if (
    !exactTargetOwner(actor.ownership, config) ||
    actor.ownership.runId !== config.githubRunId ||
    actor.ownership.runAttempt !== config.githubRunAttempt ||
    !actorEmailMatches({ email: actor.email } as User, actor.ownership)
  ) {
    throw new Error('K2 hosted acceptance cleanup refused an actor outside the current staging mark.');
  }
  validateExpiry(actor.ownership);
  if (learner) {
    try {
      await learner.auth.signOut({ scope: 'global' });
    } catch { /* Auth hard-delete still runs; no provider detail is retained. */ }
  }
  let current;
  try {
    current = await admin.auth.admin.getUserById(actor.id);
  } catch {
    throw new Error('K2 hosted acceptance cleanup could not re-check Auth ownership.');
  }
  if (current.error || !current.data?.user || current.data.user.id !== actor.id ||
      !ownershipMatches(current.data.user, actor.ownership, actor.email)) {
    throw new Error('K2 hosted acceptance cleanup refused an actor whose ownership mark changed.');
  }
  await deleteExactMarkedUser(admin, current.data.user, actor.ownership);
}

/** Finalizer fallback for an Auth identity captured directly from this run's createUser response. */
export async function cleanupFreshK2HostedActorIdentity(
  config: K2HostedConfig,
  identity: K2FreshActorIdentity,
  admin: K2AdminClient,
  verifyDeletedActor?: (actorId: string) => Promise<void>,
): Promise<boolean> {
  if (
    !exactTargetOwner(identity.ownership, config) ||
    identity.ownership.runId !== config.githubRunId ||
    identity.ownership.runAttempt !== config.githubRunAttempt ||
    !actorEmailMatches({ email: identity.email } as User, identity.ownership) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.id)
  ) {
    throw new Error('K2 hosted acceptance refused fresh-identity cleanup outside the current run.');
  }
  validateExpiry(identity.ownership);
  let current;
  try { current = await admin.auth.admin.getUserById(identity.id); }
  catch { throw new Error('K2 hosted acceptance fresh-identity cleanup could not re-check Auth.'); }
  if (isCanonicalUserNotFound(current.error)) {
    if (verifyDeletedActor) {
      try { await verifyDeletedActor(identity.id); }
      catch { throw new Error('K2 hosted acceptance fresh-identity residue proof failed.'); }
    }
    return false;
  }
  const user = current.data?.user;
  if (current.error || !user || user.id !== identity.id || user.email !== identity.email ||
      !ownershipMatches(user, identity.ownership, identity.email)) {
    throw new Error('K2 hosted acceptance fresh-identity cleanup refused changed Auth ownership.');
  }
  try {
    const deleted = await admin.auth.admin.deleteUser(identity.id);
    if (deleted.error) throw new Error('delete failed');
  } catch {
    throw new Error('K2 hosted acceptance fresh-identity Auth cleanup failed.');
  }
  let after;
  try { after = await admin.auth.admin.getUserById(identity.id); }
  catch { throw new Error('K2 hosted acceptance fresh-identity Auth absence proof failed.'); }
  if (!isCanonicalUserNotFound(after.error)) {
    throw new Error('K2 hosted acceptance fresh-identity Auth absence proof failed.');
  }
  if (verifyDeletedActor) {
    try { await verifyDeletedActor(identity.id); }
    catch { throw new Error('K2 hosted acceptance fresh-identity residue proof failed.'); }
  }
  return true;
}

export function createGithubTrustedSourceToken(
  config: Pick<K2HostedConfig, 'oidcRequestUrl' | 'oidcRequestToken'>,
  request: typeof fetch = fetch,
): Promise<string> {
  return (async () => {
    let requestUrl: URL;
    try { requestUrl = new URL(config.oidcRequestUrl); }
    catch {
      throw new Error(
        'K2 hosted acceptance OIDC request endpoint is invalid ' +
        '(parseFailure=true; hostname=unavailable; httpsInvalid=unknown; portInvalid=unknown; ' +
        'userinfoInvalid=unknown; fragmentInvalid=unknown).',
      );
    }
    if (
      requestUrl.protocol !== 'https:' ||
      !isAllowedGithubActionsOidcHostname(requestUrl.hostname) ||
      requestUrl.port !== '' ||
      requestUrl.username !== '' ||
      requestUrl.password !== '' ||
      requestUrl.hash !== ''
    ) {
      const githubActionsHostname = requestUrl.hostname === 'actions.githubusercontent.com' ||
        requestUrl.hostname.endsWith('.actions.githubusercontent.com');
      const safeHostname = githubActionsHostname ? requestUrl.hostname : 'other';
      throw new Error(
        'K2 hosted acceptance OIDC request endpoint is invalid ' +
        `(parseFailure=false; hostname=${safeHostname}; ` +
        `hostnameAllowed=${isAllowedGithubActionsOidcHostname(requestUrl.hostname)}; ` +
        `httpsInvalid=${requestUrl.protocol !== 'https:'}; portInvalid=${requestUrl.port !== ''}; ` +
        `userinfoInvalid=${requestUrl.username !== '' || requestUrl.password !== ''}; ` +
        `fragmentInvalid=${requestUrl.hash !== ''}).`,
      );
    }
    requestUrl.searchParams.set('audience', 'https://vercel.com');
    let response: Response;
    try {
      response = await request(requestUrl, {
        headers: { Authorization: `Bearer ${config.oidcRequestToken}` },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
    } catch {
      throw new Error('K2 hosted acceptance could not obtain its protected Vercel OIDC token.');
    }
    if (!response.ok) {
      throw new Error('K2 hosted acceptance could not obtain its protected Vercel OIDC token.');
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error('K2 hosted acceptance received an invalid protected Vercel OIDC response.');
    }
    if (!value || typeof value !== 'object' || !('value' in value) ||
        typeof (value as { value?: unknown }).value !== 'string' ||
        !(value as { value: string }).value.trim()) {
      throw new Error('K2 hosted acceptance received an invalid protected Vercel OIDC response.');
    }
    return (value as { value: string }).value;
  })();
}

export async function verifyProtectedVercelOrigin(
  immutableOrigin: string,
  trustedSourceToken: string,
  expectedSourceSha: string,
  request: typeof fetch = fetch,
): Promise<string> {
  if (
    !/^[a-f0-9]{40}$/.test(expectedSourceSha) ||
    immutableVercelDeploymentOrigin(immutableOrigin) !== immutableOrigin ||
    !trustedSourceToken.trim()
  ) {
    throw new Error('K2 hosted acceptance protected Vercel attestation inputs were invalid; no actor was created.');
  }

  await requireVercelAuthenticationChallenge(
    immutableOrigin,
    '/auth',
    'immutable-anonymous-auth',
    request,
  );
  await requireVercelAuthenticationChallenge(
    immutableOrigin,
    K2_VERCEL_ATTESTATION_PATH,
    'immutable-anonymous-attestation',
    request,
  );
  const immutableAttestation = await requestProtectedVercelAttestation(
    immutableOrigin,
    trustedSourceToken,
    'immutable-attestation',
    request,
  );
  requireMatchingVercelAttestation(
    immutableAttestation,
    immutableOrigin,
    expectedSourceSha,
    null,
  );

  const immutableAuthResponse = await requestTrustedVercelPath(
    immutableOrigin,
    '/auth',
    trustedSourceToken,
    'manual',
    'immutable-auth-redirect',
    request,
  );
  if (
    immutableAuthResponse.status !== 308 ||
    !immutableAuthResponse.headers.has('x-vercel-id') ||
    !isCanonicalAuthRedirect(
      immutableAuthResponse.headers.get('location'),
      immutableOrigin,
      immutableAttestation.canonicalOrigin,
    )
  ) {
    throw protectedVercelResponseFailure(
      'immutable-auth-redirect',
      immutableAuthResponse,
      immutableOrigin,
    );
  }

  const canonicalOrigin = immutableAttestation.canonicalOrigin;
  await requireVercelAuthenticationChallenge(
    canonicalOrigin,
    K2_VERCEL_ATTESTATION_PATH,
    'canonical-anonymous-attestation',
    request,
  );
  await requireVercelAuthenticationChallenge(
    canonicalOrigin,
    '/auth',
    'canonical-anonymous-auth',
    request,
  );

  const canonicalAttestation = await requestProtectedVercelAttestation(
    canonicalOrigin,
    trustedSourceToken,
    'canonical-attestation',
    request,
  );
  requireMatchingVercelAttestation(
    canonicalAttestation,
    immutableOrigin,
    expectedSourceSha,
    immutableAttestation.deploymentId,
  );

  const canonicalAuthResponse = await requestTrustedVercelPath(
    canonicalOrigin,
    '/auth',
    trustedSourceToken,
    'manual',
    'canonical-auth',
    request,
  );
  const contentType = canonicalAuthResponse.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (
    canonicalAuthResponse.status !== 200 ||
    !canonicalAuthResponse.headers.has('x-vercel-id') ||
    contentType !== 'text/html'
  ) {
    throw protectedVercelResponseFailure('canonical-auth', canonicalAuthResponse, canonicalOrigin);
  }

  return canonicalOrigin;
}

interface K2VercelOperationalAttestation {
  readonly schemaVersion?: unknown;
  readonly sourceSha?: unknown;
  readonly deploymentOrigin?: unknown;
  readonly deploymentId?: unknown;
  readonly environment?: unknown;
  readonly repositoryOwner?: unknown;
  readonly repositorySlug?: unknown;
  readonly canonicalOrigin?: unknown;
}

interface VerifiedK2VercelOperationalAttestation {
  readonly sourceSha: string;
  readonly deploymentOrigin: string;
  readonly deploymentId: string;
  readonly canonicalOrigin: string;
}

type ProtectedVercelStage =
  | 'immutable-anonymous-auth'
  | 'immutable-anonymous-attestation'
  | 'immutable-attestation'
  | 'immutable-auth-redirect'
  | 'canonical-anonymous-attestation'
  | 'canonical-anonymous-auth'
  | 'canonical-attestation'
  | 'canonical-auth';

async function requireVercelAuthenticationChallenge(
  origin: string,
  path: string,
  stage: ProtectedVercelStage,
  request: typeof fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await request(new URL(path, origin), {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`K2 hosted acceptance ${stage} protected Vercel check failed; no actor was created.`);
  }
  if (!isVercelAuthenticationChallenge(response, origin)) {
    throw new Error(
      'K2 hosted acceptance target is not protected ' +
      `(phase=${stage}; status=${response.status}; ` +
      `x-vercel-id=${response.headers.has('x-vercel-id')}; ` +
      `redirect=${classifyProtectedVercelRedirect(response, origin)}); ` +
      'no actor was created.',
    );
  }
}

function isVercelAuthenticationChallenge(response: Response, origin: string): boolean {
  const location = response.headers.get('location');
  if (
    !location ||
    response.status < 300 || response.status >= 400 ||
    !response.headers.has('x-vercel-id')
  ) return false;

  try {
    const challenge = new URL(location, origin);
    return challenge.protocol === 'https:' && challenge.hostname === 'vercel.com' &&
      !challenge.username && !challenge.password && !challenge.port &&
      ['/sso-api', '/login', '/auth'].includes(challenge.pathname);
  } catch {
    return false;
  }
}

async function requestProtectedVercelAttestation(
  origin: string,
  trustedSourceToken: string,
  stage: ProtectedVercelStage,
  request: typeof fetch,
): Promise<VerifiedK2VercelOperationalAttestation> {
  let response: Response;
  try {
    response = await request(new URL(K2_VERCEL_ATTESTATION_PATH, origin), {
      headers: {
        accept: 'application/json',
        'x-vercel-trusted-oidc-idp-token': trustedSourceToken,
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`K2 hosted acceptance ${stage} request failed; no actor was created.`);
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (
    response.status !== 200 ||
    !response.headers.has('x-vercel-id') ||
    contentType !== 'application/json'
  ) throw protectedVercelResponseFailure(stage, response, origin);

  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error(`K2 hosted acceptance ${stage} response was invalid; no actor was created.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`K2 hosted acceptance ${stage} response was invalid; no actor was created.`);
  }

  const attestation = value as K2VercelOperationalAttestation;
  if (
    attestation.schemaVersion !== 1 ||
    typeof attestation.sourceSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(attestation.sourceSha) ||
    typeof attestation.deploymentOrigin !== 'string' ||
    typeof attestation.deploymentId !== 'string' ||
    !/^dpl_[A-Za-z0-9]{8,128}$/.test(attestation.deploymentId) ||
    attestation.environment !== 'production' ||
    attestation.repositoryOwner !== 'haizx71' ||
    attestation.repositorySlug !== 'lingua-os' ||
    attestation.canonicalOrigin !== DEFAULT_CANONICAL_WEB_ORIGIN
  ) throw new Error(`K2 hosted acceptance ${stage} response was invalid; no actor was created.`);

  return {
    sourceSha: attestation.sourceSha,
    deploymentOrigin: attestation.deploymentOrigin,
    deploymentId: attestation.deploymentId,
    canonicalOrigin: attestation.canonicalOrigin,
  };
}

function requireMatchingVercelAttestation(
  attestation: VerifiedK2VercelOperationalAttestation,
  immutableOrigin: string,
  expectedSourceSha: string,
  expectedDeploymentId: string | null,
): void {
  if (
    attestation.sourceSha !== expectedSourceSha ||
    attestation.deploymentOrigin !== immutableOrigin ||
    (expectedDeploymentId !== null && attestation.deploymentId !== expectedDeploymentId) ||
    attestation.canonicalOrigin !== DEFAULT_CANONICAL_WEB_ORIGIN
  ) {
    throw new Error('K2 hosted acceptance Vercel deployment attestation did not match; no actor was created.');
  }
}

function isCanonicalAuthRedirect(
  rawLocation: string | null,
  sourceOrigin: string,
  expectedCanonicalOrigin: string,
): boolean {
  if (!rawLocation || rawLocation !== `${expectedCanonicalOrigin}/auth`) return false;
  try {
    const target = new URL(rawLocation, sourceOrigin);
    return target.protocol === 'https:' &&
      !target.username && !target.password && !target.port &&
      target.origin === expectedCanonicalOrigin &&
      target.pathname === '/auth' &&
      !target.search && !target.hash;
  } catch {
    return false;
  }
}

async function requestTrustedVercelPath(
  origin: string,
  path: string,
  trustedSourceToken: string,
  redirect: 'manual' | 'error',
  stage: ProtectedVercelStage,
  request: typeof fetch,
): Promise<Response> {
  try {
    return await request(new URL(path, origin), {
      headers: { 'x-vercel-trusted-oidc-idp-token': trustedSourceToken },
      redirect,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`K2 hosted acceptance ${stage} request failed; no actor was created.`);
  }
}

function protectedVercelResponseFailure(
  stage: ProtectedVercelStage,
  response: Response,
  origin: string,
): Error {
  return new Error(
    'K2 hosted acceptance protected Vercel access is not authorized ' +
    `(phase=${stage}; status=${response.status}; ` +
    `x-vercel-id=${response.headers.has('x-vercel-id')}; ` +
    `redirect=${classifyProtectedVercelRedirect(response, origin)}); ` +
    'no actor was created.',
  );
}

type ProtectedVercelRedirectClass =
  | 'none'
  | 'invalid'
  | 'insecure'
  | 'same-origin'
  | 'vercel-auth'
  | 'vercel-app'
  | 'other-https';

function classifyProtectedVercelRedirect(
  response: Response,
  origin: string,
): ProtectedVercelRedirectClass {
  const location = response.headers.get('location');
  if (!location) return 'none';

  let target: URL;
  try { target = new URL(location, origin); }
  catch { return 'invalid'; }

  if (target.username || target.password) return 'invalid';
  if (target.protocol !== 'https:') return 'insecure';
  if (target.origin === origin) return 'same-origin';
  if (
    target.hostname === 'vercel.com' &&
    ['/sso-api', '/login', '/auth'].includes(target.pathname)
  ) return 'vercel-auth';
  if (target.hostname.endsWith('.vercel.app')) return 'vercel-app';
  return 'other-https';
}

interface GithubDeploymentRecord {
  readonly id?: unknown;
  readonly sha?: unknown;
  readonly ref?: unknown;
  readonly environment?: unknown;
}

interface GithubDeploymentStatus {
  readonly state?: unknown;
  readonly environment_url?: unknown;
  readonly target_url?: unknown;
  readonly log_url?: unknown;
  readonly creator?: { readonly login?: unknown };
}

async function githubApiPages<T>(
  url: URL,
  token: string,
  request: typeof fetch,
): Promise<readonly T[]> {
  const records: T[] = [];
  const visited = new Set<string>();
  let next: URL | null = url;
  for (let page = 0; next && page < 10; page += 1) {
    if (
      next.hostname !== 'api.github.com' ||
      next.protocol !== 'https:' ||
      !next.pathname.startsWith('/repos/haizx71/lingua-os/') ||
      visited.has(next.href)
    ) {
      throw new Error('K2 hosted acceptance GitHub deployment pagination was invalid.');
    }
    visited.add(next.href);
    let response: Response;
    try {
      response = await request(next, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
    } catch {
      throw new Error('K2 hosted acceptance GitHub deployment lookup failed.');
    }
    if (!response.ok) throw new Error('K2 hosted acceptance GitHub deployment lookup failed.');
    let value: unknown;
    try { value = await response.json(); }
    catch { throw new Error('K2 hosted acceptance GitHub deployment response was invalid.'); }
    if (!Array.isArray(value)) throw new Error('K2 hosted acceptance GitHub deployment response was invalid.');
    records.push(...value as T[]);
    const link = response.headers.get('link');
    const nextMatch = link?.split(',').map(part => part.trim()).find(part => /rel="next"$/.test(part));
    if (!nextMatch) {
      next = null;
      continue;
    }
    const match = nextMatch.match(/^<([^>]+)>;\s*rel="next"$/);
    if (!match) throw new Error('K2 hosted acceptance GitHub pagination metadata was invalid.');
    try { next = new URL(match[1]); }
    catch { throw new Error('K2 hosted acceptance GitHub pagination metadata was invalid.'); }
  }
  if (next) throw new Error('K2 hosted acceptance GitHub pagination exceeded its bound.');
  return records;
}

/** Fails closed unless this run's immutable source SHA is still the live master tip. */
export async function verifyK2HostedCurrentMasterSha(
  config: K2HostedConfig,
  request: typeof fetch = fetch,
): Promise<void> {
  const url = new URL(`https://api.github.com/repos/${K2_HOSTED_REPOSITORY}/git/ref/heads/master`);
  let response: Response;
  try {
    response = await request(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
  } catch {
    throw new Error('K2 hosted acceptance could not verify the current master source SHA.');
  }
  if (!response.ok) {
    throw new Error('K2 hosted acceptance could not verify the current master source SHA.');
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('K2 hosted acceptance current master response was invalid.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('K2 hosted acceptance current master response was invalid.');
  }
  const ref = payload as { readonly ref?: unknown; readonly object?: unknown };
  const object = ref.object && typeof ref.object === 'object' && !Array.isArray(ref.object)
    ? ref.object as { readonly type?: unknown; readonly sha?: unknown }
    : null;
  if (
    ref.ref !== 'refs/heads/master' ||
    object?.type !== 'commit' ||
    typeof object.sha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(object.sha) ||
    object.sha !== config.githubSha
  ) {
    throw new Error('K2 hosted acceptance source SHA is not the current master tip.');
  }
}

function immutableVercelDeploymentOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^lingua-os-[a-z0-9]{8,}-haizx71-\d+\.vercel\.app$/.test(url.hostname) ||
        url.username !== '' || url.password !== '' ||
        url.pathname !== '/' || url.search !== '' || url.hash !== '') return null;
    return url.origin;
  } catch { return null; }
}

async function successfulDeploymentUrl(
  config: K2HostedConfig,
  environment: 'Production',
  request: typeof fetch,
): Promise<string> {
  const deploymentsUrl = new URL(`https://api.github.com/repos/${K2_HOSTED_REPOSITORY}/deployments`);
  deploymentsUrl.searchParams.set('environment', environment);
  deploymentsUrl.searchParams.set('per_page', '100');
  const deployments = await githubApiPages<GithubDeploymentRecord>(deploymentsUrl, config.githubToken, request);
  const matching = deployments.filter(deployment =>
    deployment.sha === config.githubSha &&
    (deployment.ref === 'master' || deployment.ref === config.githubSha) &&
    deployment.environment === environment &&
    typeof deployment.id === 'number'
  );
  const origins = new Set<string>();
  for (const deployment of matching) {
    const statusesUrl = new URL(
      `https://api.github.com/repos/${K2_HOSTED_REPOSITORY}/deployments/${deployment.id}/statuses`,
    );
    statusesUrl.searchParams.set('per_page', '100');
    const statuses = await githubApiPages<GithubDeploymentStatus>(statusesUrl, config.githubToken, request);
    for (const status of statuses) {
      if (
        status.state !== 'success' ||
        typeof status.log_url !== 'string' ||
        status.creator?.login !== 'vercel[bot]'
      ) continue;
      const environmentOrigin = immutableVercelDeploymentOrigin(status.environment_url);
      const targetOrigin = immutableVercelDeploymentOrigin(status.target_url);
      const logOrigin = immutableVercelDeploymentOrigin(status.log_url);
      if (!environmentOrigin || environmentOrigin !== targetOrigin || environmentOrigin !== logOrigin) continue;
      origins.add(environmentOrigin);
    }
  }
  if (origins.size !== 1) {
    throw new Error('K2 hosted acceptance has no successful Vercel Production deployment attested for this source SHA.');
  }
  return [...origins][0];
}

/** Resolves the unique immutable Vercel Production URL attested for this exact source SHA. */
export async function verifyK2HostedDeploymentAttestations(
  config: K2HostedConfig,
  request: typeof fetch = fetch,
): Promise<string> {
  return successfulDeploymentUrl(config, 'Production', request);
}

export async function verifyK2StagingApiHealth(
  apiOrigin: string,
  expectedSourceSha: string,
  request: typeof fetch = fetch,
): Promise<void> {
  if (!/^[a-f0-9]{40}$/.test(expectedSourceSha)) {
    throw new Error('K2 hosted acceptance expected source SHA is invalid.');
  }
  let response: Response;
  try {
    response = await request(new URL('/health', apiOrigin), {
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Connection: 'close' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('K2 hosted acceptance staging API health check failed.');
  }
  if (!response.ok) throw new Error('K2 hosted acceptance staging API health check failed.');
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error('K2 hosted acceptance staging API health response was invalid.'); }
  if (!body || typeof body !== 'object' ||
      !('status' in body) || (body as { status?: unknown }).status !== 'ok' ||
      !('service' in body) || (body as { service?: unknown }).service !== 'lingua-api' ||
      !('sourceSha' in body) ||
      typeof (body as { sourceSha?: unknown }).sourceSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test((body as { sourceSha: string }).sourceSha) ||
      (body as { sourceSha: string }).sourceSha !== expectedSourceSha ||
      response.headers.get('x-lingua-source-sha') !== expectedSourceSha) {
    throw new Error('K2 hosted acceptance staging API health response was invalid.');
  }
}
