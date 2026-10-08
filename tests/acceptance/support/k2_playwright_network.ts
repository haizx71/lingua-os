import type { BrowserContext, Route } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import type { K2HostedConfig } from './k2_hosted_actors';
import { headersForK2ProtectedOrigin } from './k2_vercel_header';
import { validateContract } from './contract_validation';

export type K2FrllActorSession = Readonly<{ accessToken: string; userId: string; profileId: string }>;
export type K2FrllBrowserRequest = Readonly<{
  readonly actor: K2FrllActorSession;
  readonly method: string;
  readonly route: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Buffer;
}>;
export type K2FrllDirectRequest = (request: K2FrllBrowserRequest) => Promise<Response>;
export type K2FrllReplayProof = Readonly<{
  responseLossCommitted: boolean;
  exactRequestReplay: boolean;
  exactResultReplay: boolean;
  idempotencyKeySha256: string | null;
}>;
export type K2FrllConflictProof = Readonly<{ status: number; errorCode: string | null }>;

export interface K2FrllAuthBindingBarrier {
  begin(): Readonly<{ complete(): boolean; release(): void }>;
  waitForBinding(): Promise<boolean>;
}

/** Holds only unknown bearer requests while a runner-owned sign-in is verified and bound. */
export function createK2FrllAuthBindingBarrier(timeoutMs = 15_000): K2FrllAuthBindingBarrier {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000) {
    throw new Error('K2 hosted acceptance Auth binding wait was outside its safety bound.');
  }
  let active: Readonly<{ promise: Promise<boolean>; finish(value: boolean): boolean }> | undefined;
  return {
    begin() {
      if (active) throw new Error('K2 hosted acceptance Auth binding wait was already active.');
      let resolve: (bound: boolean) => void = () => undefined;
      const promise = new Promise<boolean>(done => { resolve = done; });
      let timer: ReturnType<typeof setTimeout>;
      const state = {
        promise,
        finish(value: boolean): boolean {
          if (active !== state) return false;
          clearTimeout(timer);
          active = undefined;
          resolve(value);
          return true;
        },
      };
      active = state;
      timer = setTimeout(() => state.finish(false), timeoutMs);
      return Object.freeze({
        complete: () => state.finish(true),
        release: () => { state.finish(false); },
      });
    },
    async waitForBinding() {
      const pending = active;
      if (!pending) return false;
      return pending.promise;
    },
  };
}

export interface K2FrllReplayController {
  dropNextAnswerResponse(): void;
  observe(actor: K2FrllActorSession, method: string, route: string, headers: Readonly<Record<string, string>>,
    body: Buffer | undefined, status: number, responseBody: Buffer): 'drop' | 'fulfill';
  proof(): K2FrllReplayProof;
  conflictingReplay(directRequest: K2FrllDirectRequest): Promise<K2FrllConflictProof>;
}

/** Stores only process-local replay evidence; the proof exposes booleans, never IDs or receipt data. */
export function createK2FrllReplayController(): K2FrllReplayController {
  let armed = false;
  let committed: Readonly<{ actor: K2FrllActorSession; method: string; route: string;
    authorization: string; idempotencyKey: string; requestBody: Buffer; status: number; result: unknown }> | undefined;
  let replay: Readonly<{ sameRequest: boolean; sameResult: boolean }> | undefined;
  return {
    dropNextAnswerResponse() {
      if (armed || committed) throw new Error('K2 hosted acceptance response-loss proof was already used.');
      armed = true;
    },
    observe(actor, method, route, headers, body, status, responseBody) {
      if (method !== 'POST' || !REVIEW_ITEM_PATH.test(route)) return 'fulfill';
      let result: unknown;
      try {
        if (!body) return 'fulfill';
        JSON.parse(body.toString('utf8'));
        const envelope = JSON.parse(responseBody.toString('utf8')) as unknown;
        result = validateContract('ReviewAnswerResponse', envelope).data;
      } catch {
        return 'fulfill';
      }
      const idempotencyKey = headers['idempotency-key'] ?? '';
      if (!committed && armed && status === 200 && UUID_HEADER.test(idempotencyKey) &&
          headers.Authorization === `Bearer ${actor.accessToken}`) {
        armed = false;
        committed = {
          actor, method, route, authorization: headers.Authorization ?? '', idempotencyKey,
          requestBody: Buffer.from(body), status, result,
        };
        return 'drop';
      }
      if (committed && !replay) {
        replay = {
          sameRequest: committed.method === method && committed.route === route &&
            committed.authorization === (headers.Authorization ?? '') &&
            committed.idempotencyKey === idempotencyKey && committed.requestBody.equals(body ?? Buffer.alloc(0)) &&
            actor.accessToken === committed.actor.accessToken && actor.profileId === committed.actor.profileId,
          sameResult: committed.status === status && isDeepStrictEqual(committed.result, result),
        };
      }
      return 'fulfill';
    },
    proof() {
      return {
        responseLossCommitted: committed !== undefined,
        exactRequestReplay: replay?.sameRequest === true,
        exactResultReplay: replay?.sameResult === true,
        idempotencyKeySha256: committed
          ? createHash('sha256').update(committed.idempotencyKey, 'utf8').digest('hex')
          : null,
      };
    },
    async conflictingReplay(directRequest) {
      if (!committed || !replay?.sameRequest || !replay.sameResult) {
        throw new Error('K2 hosted acceptance changed-payload replay was not ready.');
      }
      let original: unknown;
      try { original = JSON.parse(committed.requestBody.toString('utf8')); }
      catch { throw new Error('K2 hosted acceptance changed-payload replay was invalid.'); }
      if (!original || typeof original !== 'object' || Array.isArray(original)) {
        throw new Error('K2 hosted acceptance changed-payload replay was invalid.');
      }
      const changed = { ...(original as Record<string, unknown>), rating:
        (original as Record<string, unknown>).rating === 'easy' ? 'good' : 'easy' };
      const response = await directRequest({
        actor: committed.actor,
        method: committed.method,
        route: committed.route,
        headers: {
          Authorization: `Bearer ${committed.actor.accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'idempotency-key': committed.idempotencyKey,
        },
        body: Buffer.from(JSON.stringify(changed)),
      });
      let errorCode: string | null = null;
      if (response.status === 409) {
        try {
          const envelope = JSON.parse(Buffer.from(await response.arrayBuffer()).toString('utf8')) as unknown;
          const parsed = validateContract('ErrorEnvelope', envelope);
          errorCode = parsed.error.code;
        } catch {
          throw new Error('K2 hosted acceptance changed-payload conflict response was invalid.');
        }
      }
      return { status: response.status, errorCode };
    },
  };
}

const K2_FRLL_ANCHOR_ID = '7f110000-0000-4000-8000-000000000004';
const REVIEW_ITEM_PATH = /^\/v1\/review\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/answer$/i;
const UUID_HEADER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function onlyQueryKeys(url: URL, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = [...url.searchParams.keys()];
  return required.every(key => url.searchParams.getAll(key).length === 1) &&
    keys.every(key => required.includes(key) || optional.includes(key)) &&
    [...required, ...optional].every(key => url.searchParams.getAll(key).length <= 1);
}

function validPageValue(url: URL, key: string): boolean {
  const value = url.searchParams.get(key);
  return value === null || (value.length > 0 && value.length <= 512);
}

function resolveFrllApiRoute(url: URL, method: string, profileId: string): string | null {
  if (!url.pathname.startsWith('/api/v1/')) return null;
  const route = url.pathname.slice('/api'.length);
  if (route === '/v1/me' && method === 'GET' && url.search === '') return route;
  if (route === '/v1/me/languages' && method === 'GET' && url.search === '') return route;
  if (route === '/v1/dictionary/search' && method === 'GET' &&
      onlyQueryKeys(url, ['query'], ['languageCode', 'limit', 'cursor', 'includeLemmaGroups']) &&
      url.searchParams.get('query') === 'frll-anchor' &&
      (url.searchParams.get('languageCode') === null || url.searchParams.get('languageCode') === 'en') &&
      (url.searchParams.get('limit') === null || /^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit')!)) &&
      validPageValue(url, 'cursor') &&
      (url.searchParams.get('includeLemmaGroups') === null ||
       url.searchParams.get('includeLemmaGroups') === 'true')) return route + url.search;
  if (route === `/v1/concepts/${K2_FRLL_ANCHOR_ID}` && method === 'GET' && url.search === '') return route;
  if (route === `/v1/library/concepts/${K2_FRLL_ANCHOR_ID}` && method === 'PUT' && url.search === '') return route;
  if (route === '/v1/library/items' && method === 'GET' &&
      onlyQueryKeys(url, ['itemType'], ['cursor']) &&
      url.searchParams.get('itemType') === 'concept' && validPageValue(url, 'cursor')) return route + url.search;
  if (route === '/v1/today' && method === 'GET' &&
      onlyQueryKeys(url, [], ['languageProfileId', 'date']) &&
      (url.searchParams.get('languageProfileId') === null || url.searchParams.get('languageProfileId') === profileId) &&
      validPageValue(url, 'date')) return route + url.search;
  if (route === '/v1/review/queue' && method === 'GET' &&
      onlyQueryKeys(url, [], ['languageProfileId', 'limit', 'cursor']) &&
      (url.searchParams.get('languageProfileId') === null || url.searchParams.get('languageProfileId') === profileId) &&
      validPageValue(url, 'cursor') &&
      (url.searchParams.get('limit') === null || /^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit')!))) {
    return route + url.search;
  }
  if (route === '/v1/brain/summary' && method === 'GET' &&
      onlyQueryKeys(url, [], ['languageProfileId']) &&
      (url.searchParams.get('languageProfileId') === null || url.searchParams.get('languageProfileId') === profileId)) {
    return route + url.search;
  }
  if (route === '/v1/brain/concepts' && method === 'GET' &&
      onlyQueryKeys(url, [], ['languageProfileId', 'cursor']) &&
      (url.searchParams.get('languageProfileId') === null || url.searchParams.get('languageProfileId') === profileId) &&
      validPageValue(url, 'cursor')) return route + url.search;
  if (route === `/v1/brain/concepts/${K2_FRLL_ANCHOR_ID}` && method === 'GET' && url.search === '') return route;
  if (REVIEW_ITEM_PATH.test(route) && method === 'POST' && url.search === '') return route;
  return null;
}

function validAnswerBody(body: Buffer | undefined, headers: Readonly<Record<string, string>>): boolean {
  if (!body || body.length === 0 || body.length > 4096 || !UUID_HEADER.test(headers['idempotency-key'] ?? '')) {
    return false;
  }
  try {
    const value: unknown = JSON.parse(body.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const request = value as Record<string, unknown>;
    const keys = Object.keys(request).sort();
    const required = ['correct', 'exerciseMode', 'rating', 'responseTimeMs'];
    if (keys.length !== required.length || keys.some((key, index) => key !== required[index]) ||
        request.correct !== true || request.exerciseMode !== 'self_recall' ||
        !['again', 'hard', 'good', 'easy'].includes(String(request.rating)) ||
        typeof request.responseTimeMs !== 'number' || !Number.isSafeInteger(request.responseTimeMs) ||
        request.responseTimeMs < 0 || request.responseTimeMs > 3_600_000) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Forward only exact FRLL UI requests to the runner's direct, normal-JWT Render client.
 * The originating bearer is matched to a factory-created session; the page's current actor
 * is never substituted, so an in-flight A request remains A after a switch to B.
 */
export async function forwardK2FrllBrowserRequest(
  route: Route,
  config: Pick<K2HostedConfig, 'githubSha'> & { readonly vercelOrigin: string },
  sessions: ReadonlyMap<string, K2FrllActorSession>,
  directRequest: K2FrllDirectRequest,
  replayController?: K2FrllReplayController,
  authBindingBarrier?: K2FrllAuthBindingBarrier,
): Promise<void> {
  try {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== config.vercelOrigin) { await route.abort(); return; }
    const incoming = request.headers();
    const authorization = incoming.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.slice(7).length === 0) {
      await route.abort();
      return;
    }
    const accessToken = authorization.slice(7);
    let actor = sessions.get(accessToken);
    if (!actor && authBindingBarrier && await authBindingBarrier.waitForBinding()) {
      actor = sessions.get(accessToken);
    }
    if (!actor || authorization !== `Bearer ${actor.accessToken}`) { await route.abort(); return; }

    const method = request.method().toUpperCase();
    const upstreamRoute = resolveFrllApiRoute(url, method, actor.profileId);
    if (!upstreamRoute) { await route.abort(); return; }
    const body = request.postDataBuffer() ?? undefined;
    if ((method === 'POST' && !validAnswerBody(body, incoming)) ||
        (method === 'PUT' && body && body.length > 0) ||
        ((method === 'GET' || method === 'HEAD') && body && body.length > 0) ||
        (method !== 'POST' && incoming['idempotency-key'] !== undefined)) {
      await route.abort();
      return;
    }

    // Only forward headers needed by the fixed product operations. Cookie, OIDC,
    // Vercel bypass, service-role, host, and hop-by-hop headers are never copied.
    const headers: Record<string, string> = { Authorization: `Bearer ${actor.accessToken}`, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    for (const name of ['if-match', 'x-lingua-if-match', 'idempotency-key']) {
      if (incoming[name] !== undefined) headers[name] = incoming[name];
    }
    if (method === 'POST' && !UUID_HEADER.test(headers['idempotency-key'] ?? '')) {
      await route.abort();
      return;
    }
    const response = await directRequest({ actor, method, route: upstreamRoute, headers, ...(body ? { body } : {}) });
    if (response.status >= 300 && response.status < 400 ||
        response.headers.get('x-lingua-source-sha') !== config.githubSha) {
      await route.abort();
      return;
    }
    const safeHeaders: Record<string, string> = {};
    for (const name of ['content-type', 'cache-control', 'etag', 'retry-after', 'x-lingua-source-sha', 'x-lingua-upstream-etag']) {
      const value = response.headers.get(name);
      if (value !== null) safeHeaders[name] = value;
    }
    const responseBody = Buffer.from(await response.arrayBuffer());
    if (response.status >= 200 && response.status < 300) {
      const path = upstreamRoute.split('?', 1)[0];
      if (path === '/v1/me') {
        const data = validateContract('MeResponse', JSON.parse(responseBody.toString('utf8'))).data;
        if (data.id !== actor.userId) { await route.abort(); return; }
      } else if (path === '/v1/me/languages') {
        const data = validateContract('LanguageProfilesResponse', JSON.parse(responseBody.toString('utf8'))).data;
        if (data.length !== 1 || data[0]?.id !== actor.profileId) { await route.abort(); return; }
      } else if (path === '/v1/today') {
        const data = validateContract('TodayPlanResponse', JSON.parse(responseBody.toString('utf8'))).data;
        if (data.languageProfileId !== actor.profileId) { await route.abort(); return; }
      } else if (path === '/v1/brain/summary') {
        const data = validateContract('BrainSummaryResponse', JSON.parse(responseBody.toString('utf8'))).data;
        if (data.languageProfileId !== actor.profileId) { await route.abort(); return; }
      }
    }
    const decision = replayController?.observe(actor, method, upstreamRoute, headers, body, response.status, responseBody);
    if (decision === 'drop') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: response.status, headers: safeHeaders, body: responseBody });
  } catch {
    // No provider exception, headers, URL, body, or actor identity is attached to the test.
    try { await route.abort(); } catch { /* the route may already be resolved */ }
  }
}

/**
 * Browser traffic is restricted to the SHA-attested canonical Vercel origin
 * and this staging project's Auth API. The bearer used by the acceptance flow
 * is sent directly to the exact Render origin from Node, never through browser routes.
 */
export async function handleK2BrowserRoute(
  route: Route,
  config: Pick<K2HostedConfig, 'supabaseUrl'> & { readonly vercelOrigin: string },
  trustedSourceToken: string,
  frllApiRequest?: (route: Route) => Promise<void>,
): Promise<void> {
  let requestUrl: URL;
  try { requestUrl = new URL(route.request().url()); }
  catch { await route.abort(); return; }

  if (requestUrl.origin === config.vercelOrigin) {
    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      if (frllApiRequest && requestUrl.pathname.startsWith('/api/v1/')) {
        await frllApiRequest(route);
        return;
      }
      await route.abort();
      return;
    }
    const headers = headersForK2ProtectedOrigin(
      requestUrl.href,
      route.request().headers(),
      config.vercelOrigin,
      trustedSourceToken,
    );
    await fulfillWithoutRedirect(route, headers);
    return;
  }

  if (requestUrl.origin === config.supabaseUrl && requestUrl.pathname.startsWith('/auth/v1/')) {
    const headers = headersForK2ProtectedOrigin(
      requestUrl.href,
      route.request().headers(),
      config.vercelOrigin,
      trustedSourceToken,
    );
    await fulfillWithoutRedirect(route, headers);
    return;
  }

  // This also stops cross-origin redirects from forwarding Vercel's OIDC header.
  await route.abort();
}

async function fulfillWithoutRedirect(route: Route, headers: Record<string, string>): Promise<void> {
  try {
    const response = await route.fetch({ headers, maxRedirects: 0 });
    if (response.status() >= 300 && response.status() < 400) {
      await response.dispose();
      await route.abort();
      return;
    }
    await route.fulfill({ response });
  } catch {
    // Never expose provider transport details or follow a redirect carrying
    // the in-memory Trusted Sources token or Auth request credentials.
    await route.abort();
  }
}

export function installK2BrowserRequestGuard(
  context: BrowserContext,
  config: Pick<K2HostedConfig, 'supabaseUrl'> & { readonly vercelOrigin: string },
  trustedSourceToken: string,
  frllApiRequest?: (route: Route) => Promise<void>,
): Promise<void> {
  return context.route('**/*', route => handleK2BrowserRoute(route, config, trustedSourceToken, frllApiRequest)).then(() => undefined);
}
