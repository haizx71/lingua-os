import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import {
  createK2FrllTodayDiagnostic,
  createK2FrllAuthBindingBarrier,
  createK2FrllReplayController,
  forwardK2FrllBrowserRequest,
  handleK2BrowserRoute,
  type K2FrllDiagnosticEvent,
} from './k2_playwright_network';
import { K2_VERCEL_TRUSTED_SOURCE_HEADER } from './k2_vercel_header';

const config = {
  vercelOrigin: 'https://lingua-os-deployment.vercel.app',
  supabaseUrl: 'https://bdmtdvvnbicgkfririjo.supabase.co',
  githubSha: 'a'.repeat(40),
};
const token = 'oidc-token-placeholder';

function fakeRoute(
  url: string,
  headers: Record<string, string> = {},
  response = new Response('ok'),
  fetchImpl?: (options?: { headers?: Record<string, string>; maxRedirects?: number }) => Promise<unknown>,
  method = 'GET',
  body?: Buffer,
) {
  const fetchedResponse = {
    status: () => response.status,
    headers: () => Object.fromEntries(response.headers.entries()),
    dispose: vi.fn(async () => undefined),
  };
  const fetchRequest = vi.fn(async (options?: { headers?: Record<string, string>; maxRedirects?: number }) =>
    fetchImpl ? fetchImpl(options) : fetchedResponse);
  const fulfill = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  const route = {
    request: () => ({
      url: () => url,
      headers: () => headers,
      method: () => method,
      postDataBuffer: () => body,
    }),
    fetch: fetchRequest,
    fulfill,
    abort,
  } as unknown as import('@playwright/test').Route;
  return { route, fetchRequest, fulfill, abort, fetchedResponse };
}

describe('K2 Playwright deployment request guard', () => {
  it('reports only fixed Today diagnostic fields for a contract-valid matched actor response', async () => {
    const actor = {
      accessToken: 'diagnostic-private-token-marker',
      userId: '00000000-0000-4000-8000-000000000101',
      profileId: '00000000-0000-4000-8000-000000000001',
    };
    const sessions = new Map([[actor.accessToken, actor]]);
    const event = vi.fn();
    const me = {
      data: {
        id: actor.userId,
        email: 'diagnostic-private-email-marker@example.invalid',
        displayName: null,
        interfaceLanguageCode: 'vi',
        timeZone: null,
        languageProfiles: [],
        createdAt: '2026-10-08T00:00:00Z',
        updatedAt: '2026-10-08T00:00:00Z',
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000020', apiVersion: '1.0' },
    };
    const request = fakeRoute(`${config.vercelOrigin}/api/v1/me`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(request.route, config, sessions, async () => new Response(JSON.stringify(me), {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }), undefined, undefined, event);

    expect(request.fulfill).toHaveBeenCalledOnce();
    expect(event).toHaveBeenCalledTimes(2);
    expect(event.mock.calls[0]?.[0]).toEqual({
      route: 'me', decision: 'started', status: 'none', contract: 'unchecked',
      binding: 'unchecked', reviewTarget: 'unchecked',
    });
    expect(event.mock.calls[1]?.[0]).toEqual({
      route: 'me', decision: 'fulfilled', status: '2xx', contract: 'valid',
      binding: 'matched', reviewTarget: 'unchecked',
    });
    const serialized = JSON.stringify(event.mock.calls);
    expect(serialized).not.toContain(actor.accessToken);
    expect(serialized).not.toContain(actor.userId);
    expect(serialized).not.toContain('diagnostic-private-email-marker');
  });

  it('reports the fixed Today review-target presence without changing response fulfillment', async () => {
    const actor = {
      accessToken: 'diagnostic-today-token-marker',
      userId: '00000000-0000-4000-8000-000000000101',
      profileId: '00000000-0000-4000-8000-000000000001',
    };
    const sessions = new Map([[actor.accessToken, actor]]);
    const diagnostic = createK2FrllTodayDiagnostic();
    const diagnosticPage = {};
    diagnostic.begin(diagnosticPage);
    const makeToday = (activities: unknown[]) => ({
      data: {
        id: '00000000-0000-4000-8000-000000000030',
        languageProfileId: actor.profileId,
        planDate: '2026-10-08',
        timeZone: 'Asia/Ho_Chi_Minh',
        targetMinutes: 15,
        completedMinutes: 0,
        status: 'active',
        engineVersion: 'today-v1',
        activities,
        createdAt: '2026-10-08T00:00:00Z',
        updatedAt: '2026-10-08T00:00:00Z',
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000031', apiVersion: '1.0' },
    });
    const review = {
      id: '00000000-0000-4000-8000-000000000032',
      position: 0,
      activityType: 'review',
      title: 'Ôn tập đến hạn',
      description: 'Review the due item.',
      estimatedMinutes: 5,
      reasonCodes: ['FSRS_DUE'],
      reasonText: 'A saved review is due.',
      status: 'pending',
      completedCount: 0,
      createdAt: '2026-10-08T00:00:00Z',
      targetCount: 1,
      reviewItemId: '00000000-0000-4000-8000-000000000033',
    };
    const observer = (event: K2FrllDiagnosticEvent) => diagnostic.recordApi(diagnosticPage, event);

    const withTarget = fakeRoute(`${config.vercelOrigin}/api/v1/today`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(withTarget.route, config, sessions, async () => new Response(
      JSON.stringify(makeToday([review])), { headers: { 'x-lingua-source-sha': config.githubSha } },
    ), undefined, undefined, observer);
    expect(withTarget.fulfill).toHaveBeenCalledOnce();
    expect(withTarget.abort).not.toHaveBeenCalled();

    const withoutTarget = fakeRoute(`${config.vercelOrigin}/api/v1/today`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(withoutTarget.route, config, sessions, async () => new Response(
      JSON.stringify(makeToday([])), { headers: { 'x-lingua-source-sha': config.githubSha } },
    ), undefined, undefined, observer);
    expect(withoutTarget.fulfill).toHaveBeenCalledOnce();
    expect(withoutTarget.abort).not.toHaveBeenCalled();

    const summary = diagnostic.summary(diagnosticPage);
    expect(summary).toContain('today_started=2 today_outcomes=2 today_pending=0 today_status=2xx today_decision=fulfilled');
    expect(summary).toContain('today_contract=valid today_bound=matched today_target=missing');
    expect(summary).toContain('first_failure=today.fulfilled.2xx.valid.matched.missing');
    expect(summary).not.toContain(actor.accessToken);
    expect(summary).not.toContain(actor.profileId);
    diagnostic.end(diagnosticPage);
  });

  it('reports a pending Today request before upstream completion without changing forwarding', async () => {
    const actor = {
      accessToken: 'diagnostic-pending-token-marker',
      userId: '00000000-0000-4000-8000-000000000101',
      profileId: '00000000-0000-4000-8000-000000000001',
    };
    const sessions = new Map([[actor.accessToken, actor]]);
    const diagnostic = createK2FrllTodayDiagnostic();
    const diagnosticPage = {};
    diagnostic.begin(diagnosticPage);
    let markUpstreamEntered: () => void = () => undefined;
    let resolveUpstream: (response: Response) => void = () => undefined;
    const upstreamEntered = new Promise<void>(resolve => { markUpstreamEntered = resolve; });
    const upstreamResponse = new Promise<Response>(resolve => { resolveUpstream = resolve; });
    const route = fakeRoute(`${config.vercelOrigin}/api/v1/today`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    const pending = forwardK2FrllBrowserRequest(route.route, config, sessions, async () => {
      markUpstreamEntered();
      return upstreamResponse;
    }, undefined, undefined, event => diagnostic.recordApi(diagnosticPage, event));

    await upstreamEntered;
    const pendingSummary = diagnostic.summary(diagnosticPage);
    expect(pendingSummary).toContain('today_started=1 today_outcomes=0 today_pending=1 today_status=none today_decision=started');
    expect(pendingSummary).toContain('first_failure=none');

    resolveUpstream(new Response('upstream-body-private-marker', {
      status: 503,
      headers: { 'x-lingua-source-sha': config.githubSha },
    }));
    await pending;
    expect(route.fulfill).toHaveBeenCalledOnce();
    expect(route.abort).not.toHaveBeenCalled();

    diagnostic.end(diagnosticPage);
    const completedSummary = diagnostic.summary(diagnosticPage);
    expect(completedSummary).toContain('today_started=1 today_outcomes=1 today_pending=0 today_status=5xx today_decision=upstream_status');
    expect(completedSummary).toContain('first_failure=today.upstream_status.5xx.unchecked.unchecked.unchecked');
    expect(completedSummary).not.toContain(actor.accessToken);
    expect(completedSummary).not.toContain('upstream-body-private-marker');
  });

  it('keeps the first failure when later traffic succeeds and isolates a throwing observer', async () => {
    const actor = {
      accessToken: 'diagnostic-private-token-marker',
      userId: '00000000-0000-4000-8000-000000000101',
      profileId: '00000000-0000-4000-8000-000000000001',
    };
    const sessions = new Map([[actor.accessToken, actor]]);
    const diagnostic = createK2FrllTodayDiagnostic();
    const diagnosticPage = {};
    const backgroundPage = {};
    diagnostic.begin(diagnosticPage);
    diagnostic.recordNavigation(diagnosticPage, 'auth', '2xx', true);
    diagnostic.recordHeading(diagnosticPage, 'wait_failed');
    const observer = (event: K2FrllDiagnosticEvent) => {
      diagnostic.recordApi(diagnosticPage, event);
      throw new Error('diagnostic-private-error-marker');
    };
    const denied = fakeRoute(`${config.vercelOrigin}/api/v1/me`, {
      authorization: 'Bearer diagnostic-unbound-token-marker',
    });
    await forwardK2FrllBrowserRequest(denied.route, config, sessions, async () => {
      throw new Error('unbound request must not reach the upstream');
    }, undefined, undefined, observer);
    expect(denied.abort).toHaveBeenCalledOnce();
    expect(denied.fulfill).not.toHaveBeenCalled();

    const me = {
      data: {
        id: actor.userId,
        email: null,
        displayName: null,
        interfaceLanguageCode: 'vi',
        timeZone: null,
        languageProfiles: [],
        createdAt: '2026-10-08T00:00:00Z',
        updatedAt: '2026-10-08T00:00:00Z',
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000021', apiVersion: '1.0' },
    };
    const allowed = fakeRoute(`${config.vercelOrigin}/api/v1/me`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(allowed.route, config, sessions, async () => new Response(JSON.stringify(me), {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }), undefined, undefined, observer);
    expect(allowed.fulfill).toHaveBeenCalledOnce();
    diagnostic.recordApi(backgroundPage, {
      route: 'today', decision: 'profile_mismatch', status: '2xx', contract: 'valid',
      binding: 'mismatched', reviewTarget: 'missing',
    });
    diagnostic.recordApi({
      route: 'diagnostic-private-route-marker',
      decision: 'diagnostic-private-decision-marker',
      status: 'diagnostic-private-status-marker',
      contract: 'diagnostic-private-contract-marker',
      binding: 'diagnostic-private-binding-marker',
      reviewTarget: 'diagnostic-private-target-marker',
    } as unknown as K2FrllDiagnosticEvent);

    diagnostic.end(diagnosticPage);
    const summary = diagnostic.summary(diagnosticPage);
    expect(summary).toContain('nav_route=auth nav_status=2xx nav_origin_bound=true heading=wait_failed');
    expect(summary).toContain('me_started=2 me_outcomes=2 me_pending=0 me_status=2xx me_decision=fulfilled');
    expect(summary).toContain('today_started=0 today_outcomes=0 today_pending=0');
    expect(summary).toContain('first_failure=me.actor_unbound.none.unchecked.unchecked.unchecked');
    expect(summary).not.toContain('diagnostic-private-token-marker');
    expect(summary).not.toContain('diagnostic-unbound-token-marker');
    expect(summary).not.toContain('diagnostic-private-error-marker');
    expect(summary).not.toContain('diagnostic-private-route-marker');
    expect(summary).not.toContain('diagnostic-private-decision-marker');
    expect(summary).not.toContain('diagnostic-private-status-marker');
    expect(summary).not.toContain('diagnostic-private-contract-marker');
    expect(summary).not.toContain('diagnostic-private-binding-marker');
    expect(summary).not.toContain('diagnostic-private-target-marker');
    expect(summary).not.toContain(actor.userId);
  });

  it('adds the token only to the exact attested deployment origin', async () => {
    const app = fakeRoute(`${config.vercelOrigin}/auth`);
    await handleK2BrowserRoute(app.route, config, token);
    expect(app.fetchRequest.mock.calls[0][0]?.headers?.[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBe(token);
    expect(app.fetchRequest.mock.calls[0][0]?.maxRedirects).toBe(0);
    expect(app.fulfill).toHaveBeenCalledOnce();

    const auth = fakeRoute(`${config.supabaseUrl}/auth/v1/token`, {
      [K2_VERCEL_TRUSTED_SOURCE_HEADER]: token,
      'content-type': 'application/json',
    });
    await handleK2BrowserRoute(auth.route, config, token);
    expect(auth.fetchRequest.mock.calls[0][0]?.headers?.[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBeUndefined();
    expect(auth.abort).not.toHaveBeenCalled();
    expect(auth.fulfill).toHaveBeenCalledOnce();
  });

  it('does not follow a real cross-origin redirect or send the OIDC token to its target', async () => {
    const receivedAtSource: string[] = [];
    const receivedAtTarget: string[] = [];
    const target = createServer((request, response) => {
      receivedAtTarget.push(request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
      response.writeHead(200).end('target');
    });
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
    const targetAddress = target.address();
    if (!targetAddress || typeof targetAddress === 'string') throw new Error('test server unavailable');

    const source = createServer((_request, response) => {
      receivedAtSource.push(_request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
      response.writeHead(302, { location: `http://127.0.0.1:${targetAddress.port}/capture` }).end();
    });
    await new Promise<void>(resolve => source.listen(0, '127.0.0.1', resolve));
    const sourceAddress = source.address();
    if (!sourceAddress || typeof sourceAddress === 'string') throw new Error('test server unavailable');
    const sourceOrigin = `http://127.0.0.1:${sourceAddress.port}`;
    try {
      const route = fakeRoute(`${sourceOrigin}/auth`, {}, new Response(null, { status: 302 }), async options => {
        const response = await fetch(`${sourceOrigin}/auth`, {
          headers: options?.headers,
          redirect: 'manual',
        });
        return {
          status: () => response.status,
          headers: () => Object.fromEntries(response.headers.entries()),
          dispose: async () => undefined,
        };
      });
      await handleK2BrowserRoute(route.route, {
        vercelOrigin: sourceOrigin,
        supabaseUrl: 'https://bdmtdvvnbicgkfririjo.supabase.co',
      }, token);
      expect(receivedAtSource).toEqual([token]);
      expect(receivedAtTarget).toEqual([]);
      expect(route.abort).toHaveBeenCalledOnce();
      expect(route.fulfill).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>(resolve => source.close(() => resolve()));
      await new Promise<void>(resolve => target.close(() => resolve()));
    }
  });

  it('blocks frontend proxy requests whose upstream target is not independently attested', async () => {
    const proxy = fakeRoute(`${config.vercelOrigin}/api/v1/me`);
    await handleK2BrowserRoute(proxy.route, config, token);
    expect(proxy.abort).toHaveBeenCalledOnce();
    expect(proxy.fetchRequest).not.toHaveBeenCalled();
  });

  it('forwards only a factory-matched originating JWT and strips protected deployment headers', async () => {
    const actorA = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const actorB = { accessToken: 'actor-b-jwt', userId: '00000000-0000-4000-8000-000000000102', profileId: '00000000-0000-4000-8000-000000000002' };
    const sessions = new Map([[actorA.accessToken, actorA], [actorB.accessToken, actorB]]);
    const response = new Response('{"data":{"ok":true}}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-lingua-source-sha': config.githubSha,
        'set-cookie': 'private-cookie=marker',
        'x-vercel-id': 'private-deployment-marker',
      },
    });
    const requestBody = Buffer.from(JSON.stringify({
      correct: true, rating: 'good', exerciseMode: 'self_recall', responseTimeMs: 1200,
    }));
    const idempotencyKey = '00000000-0000-4000-8000-000000000099';
    const sourceHeaders = {
      authorization: `Bearer ${actorA.accessToken}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      cookie: 'learner-cookie-marker',
      'x-vercel-oidc-token': 'oidc-marker',
      'x-vercel-protection-bypass': 'bypass-marker',
      'x-vercel-set-bypass-cookie': 'bypass-cookie-marker',
      'x-lingua-github-read-token': 'admin-marker',
    };
    const captured: unknown[] = [];
    const request = fakeRoute(
      `${config.vercelOrigin}/api/v1/review/00000000-0000-4000-8000-000000000010/answer`,
      sourceHeaders,
      response,
      undefined,
      'POST',
      requestBody,
    );
    await forwardK2FrllBrowserRequest(request.route, config, sessions, async forwarded => {
      captured.push(forwarded);
      return response;
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      actor: actorA,
      method: 'POST',
      route: '/v1/review/00000000-0000-4000-8000-000000000010/answer',
      headers: {
        Authorization: `Bearer ${actorA.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
    });
    expect(Object.keys((captured[0] as { headers: Record<string, string> }).headers).sort()).toEqual([
      'Accept', 'Authorization', 'Content-Type', 'idempotency-key',
    ]);
    expect(request.fulfill).toHaveBeenCalledOnce();
    const fulfilled = request.fulfill.mock.calls[0][0] as { headers: Record<string, string> };
    expect(fulfilled.headers['set-cookie']).toBeUndefined();
    expect(fulfilled.headers['x-vercel-id']).toBeUndefined();
  });

  it('accepts only the fixed self-recall answer body and contract-bounded response time', async () => {
    const actor = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const sessions = new Map([[actor.accessToken, actor]]);
    const routePath = `${config.vercelOrigin}/api/v1/review/00000000-0000-4000-8000-000000000010/answer`;
    const idempotencyKey = '00000000-0000-4000-8000-000000000099';
    const direct = vi.fn(async () => new Response('{"data":{}}', {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }));
    const base = { correct: true, exerciseMode: 'self_recall', rating: 'good', responseTimeMs: 1200 };
    const invalidBodies = [
      { ...base, exerciseMode: 'typing' },
      { ...base, responseText: 'must not pass through' },
      { ...base, correct: false },
      { ...base, correct: 'true' },
      { ...base, responseTimeMs: 3_600_001 },
      { ...base, responseTimeMs: Number.MAX_SAFE_INTEGER + 1 },
      { rating: 'good', exerciseMode: 'self_recall', responseTimeMs: 1200 },
    ];

    for (const body of invalidBodies) {
      const route = fakeRoute(routePath, {
        authorization: `Bearer ${actor.accessToken}`,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      }, undefined, undefined, 'POST', Buffer.from(JSON.stringify(body)));
      await forwardK2FrllBrowserRequest(route.route, config, sessions, direct);
      expect(route.abort).toHaveBeenCalledOnce();
      expect(route.fulfill).not.toHaveBeenCalled();
    }

    const contractMaximum = fakeRoute(routePath, {
      authorization: `Bearer ${actor.accessToken}`,
      'idempotency-key': idempotencyKey,
      'content-type': 'application/json',
    }, undefined, undefined, 'POST', Buffer.from(JSON.stringify({ ...base, responseTimeMs: 3_600_000 })));
    await forwardK2FrllBrowserRequest(contractMaximum.route, config, sessions, direct);
    expect(contractMaximum.fulfill).toHaveBeenCalledOnce();
    expect(direct).toHaveBeenCalledOnce();
  });

  it('keeps an in-flight Actor A bearer bound to A after the page has switched to B', async () => {
    const actorA = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const actorB = { accessToken: 'actor-b-jwt', userId: '00000000-0000-4000-8000-000000000102', profileId: '00000000-0000-4000-8000-000000000002' };
    const sessions = new Map([[actorA.accessToken, actorA], [actorB.accessToken, actorB]]);
    const request = fakeRoute(`${config.vercelOrigin}/api/v1/brain/concepts/7f110000-0000-4000-8000-000000000004`, {
      authorization: `Bearer ${actorA.accessToken}`,
    });
    let observed: string | undefined;
    await forwardK2FrllBrowserRequest(request.route, config, sessions, async forwarded => {
      observed = forwarded.actor.accessToken;
      return new Response('{"data":{}}', { headers: { 'x-lingua-source-sha': config.githubSha } });
    });
    expect(observed).toBe(actorA.accessToken);
    expect(observed).not.toBe(actorB.accessToken);
    expect(request.fulfill).toHaveBeenCalledOnce();
  });

  it('waits for verified B binding, rechecks the original bearer, and keeps known A traffic bound to A', async () => {
    const actorA = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const actorB = { accessToken: 'actor-b-jwt', userId: '00000000-0000-4000-8000-000000000102', profileId: '00000000-0000-4000-8000-000000000002' };
    const sessions = new Map([[actorA.accessToken, actorA]]);
    const barrier = createK2FrllAuthBindingBarrier(1_000);
    const binding = barrier.begin();
    const routePath = `${config.vercelOrigin}/api/v1/brain/concepts/7f110000-0000-4000-8000-000000000004`;
    const requestB = fakeRoute(routePath, { authorization: `Bearer ${actorB.accessToken}` });
    const requestUnmatched = fakeRoute(routePath, { authorization: 'Bearer unbound-candidate-jwt' });
    const requestA = fakeRoute(routePath, { authorization: `Bearer ${actorA.accessToken}` });
    const seen: string[] = [];
    const direct = vi.fn(async (request: { actor: { accessToken: string } }) => {
      seen.push(request.actor.accessToken);
      return new Response('{"data":{}}', { headers: { 'x-lingua-source-sha': config.githubSha } });
    });
    const pendingB = forwardK2FrllBrowserRequest(requestB.route, config, sessions, direct, undefined, barrier);
    const pendingUnmatched = forwardK2FrllBrowserRequest(requestUnmatched.route, config, sessions, direct, undefined, barrier);
    await Promise.resolve();
    await Promise.resolve();
    expect(direct).not.toHaveBeenCalled();
    expect(requestB.abort).not.toHaveBeenCalled();
    expect(requestUnmatched.abort).not.toHaveBeenCalled();

    await forwardK2FrllBrowserRequest(requestA.route, config, sessions, direct, undefined, barrier);
    expect(seen).toEqual([actorA.accessToken]);
    sessions.set(actorB.accessToken, actorB);
    expect(binding.complete()).toBe(true);
    await Promise.all([pendingB, pendingUnmatched]);

    expect(seen).toEqual([actorA.accessToken, actorB.accessToken]);
    expect(requestB.fulfill).toHaveBeenCalledOnce();
    expect(requestUnmatched.abort).toHaveBeenCalledOnce();
    expect(requestUnmatched.fulfill).not.toHaveBeenCalled();
  });

  it('releases unknown bearer requests fail-closed when runner Auth binding is rejected', async () => {
    const sessions = new Map<string, { accessToken: string; userId: string; profileId: string }>();
    const barrier = createK2FrllAuthBindingBarrier(1_000);
    const binding = barrier.begin();
    const request = fakeRoute(`${config.vercelOrigin}/api/v1/me`, {
      authorization: 'Bearer actor-that-failed-verification',
    });
    const direct = vi.fn(async () => new Response('{}', {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }));
    const pending = forwardK2FrllBrowserRequest(request.route, config, sessions, direct, undefined, barrier);
    await Promise.resolve();
    binding.release();
    await pending;
    expect(request.abort).toHaveBeenCalledOnce();
    expect(request.fulfill).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
    expect(binding.complete()).toBe(false);
  });

  it('allows only the actual fixed-anchor Dictionary query shape used by the deployed client', async () => {
    const actor = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const sessions = new Map([[actor.accessToken, actor]]);
    const direct = vi.fn(async () => new Response('{"data":[],"meta":{"requestId":"00000000-0000-4000-8000-000000000020","apiVersion":"1.0","hasMore":false,"nextCursor":null}}', {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }));
    const supported = fakeRoute(`${config.vercelOrigin}/api/v1/dictionary/search?query=frll-anchor&includeLemmaGroups=true`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(supported.route, config, sessions, direct);
    expect(supported.fulfill).toHaveBeenCalledOnce();
    expect(direct).toHaveBeenCalledOnce();

    const unsupported = fakeRoute(`${config.vercelOrigin}/api/v1/dictionary/search?query=other-word&includeLemmaGroups=true`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(unsupported.route, config, sessions, direct);
    expect(unsupported.abort).toHaveBeenCalledOnce();
    expect(direct).toHaveBeenCalledOnce();
  });

  it('drops a committed answer once and proves the later exact request/result replay in process', async () => {
    const actor = { accessToken: 'actor-a-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const sessions = new Map([[actor.accessToken, actor]]);
    const controller = createK2FrllReplayController();
    controller.dropNextAnswerResponse();
    const routePath = `${config.vercelOrigin}/api/v1/review/00000000-0000-4000-8000-000000000010/answer`;
    const requestBody = Buffer.from(JSON.stringify({
      rating: 'good', exerciseMode: 'self_recall', correct: true, responseTimeMs: 1200,
    }));
    const requestHeaders = {
      authorization: `Bearer ${actor.accessToken}`,
      'idempotency-key': '00000000-0000-4000-8000-000000000099',
      'content-type': 'application/json',
    };
    const result = {
      data: {
        reviewItemId: '00000000-0000-4000-8000-000000000010',
        memory: { state: 'review', dueAt: '2026-10-08T00:00:00Z', lastReviewedAt: '2026-10-07T00:00:00Z', isDue: false },
        competence: {
          recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
          listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
          production: { score: 0.7, confidence: 0.2, evidenceCount: 1 },
        },
        remainingDueCount: 0,
      },
      meta: { requestId: '00000000-0000-4000-8000-000000000020', apiVersion: '1.0' },
    };
    let requestCount = 0;
    const direct = async () => {
      requestCount += 1;
      return new Response(JSON.stringify({
        ...result,
        meta: { ...result.meta, requestId: `00000000-0000-4000-8000-00000000002${requestCount}` },
      }), { status: 200, headers: { 'x-lingua-source-sha': config.githubSha } });
    };
    const first = fakeRoute(routePath, requestHeaders, new Response(null, { status: 200 }), undefined, 'POST', requestBody);
    await forwardK2FrllBrowserRequest(first.route, config, sessions, direct, controller);
    expect(first.abort).toHaveBeenCalledOnce();
    expect(first.fulfill).not.toHaveBeenCalled();
    expect(controller.proof()).toEqual({
      responseLossCommitted: true,
      exactRequestReplay: false,
      exactResultReplay: false,
      idempotencyKeySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const replay = fakeRoute(routePath, requestHeaders, new Response(null, { status: 200 }), undefined, 'POST', requestBody);
    await forwardK2FrllBrowserRequest(replay.route, config, sessions, direct, controller);
    expect(replay.fulfill).toHaveBeenCalledOnce();
    expect(controller.proof()).toEqual({
      responseLossCommitted: true,
      exactRequestReplay: true,
      exactResultReplay: true,
      idempotencyKeySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const conflict = await controller.conflictingReplay(async request => {
      requestCount += 1;
      expect(request.method).toBe('POST');
      expect(request.headers.Authorization).toBe(`Bearer ${actor.accessToken}`);
      expect(request.headers['idempotency-key']).toBe(requestHeaders['idempotency-key']);
      expect(JSON.parse(request.body!.toString('utf8')).rating).toBe('easy');
      expect(request.body!.toString('utf8')).not.toBe(requestBody.toString('utf8'));
      return new Response(JSON.stringify({
        error: {
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'The key is already bound to a different request.',
          requestId: '00000000-0000-4000-8000-000000000021',
        },
      }), { status: 409, headers: { 'x-lingua-source-sha': config.githubSha } });
    });
    expect(conflict).toEqual({ status: 409, errorCode: 'IDEMPOTENCY_KEY_REUSED' });
    expect(requestCount).toBe(3);
  });

  it('fails closed for unknown JWTs, foreign profile queries, disallowed mutations, and bad source SHA', async () => {
    const actor = { accessToken: 'actor-jwt', userId: '00000000-0000-4000-8000-000000000101', profileId: '00000000-0000-4000-8000-000000000001' };
    const sessions = new Map([[actor.accessToken, actor]]);
    const direct = vi.fn(async () => new Response('{}', {
      headers: { 'x-lingua-source-sha': config.githubSha },
    }));
    const cases = [
      fakeRoute(`${config.vercelOrigin}/api/v1/me`, { authorization: 'Bearer other-user-token' }),
      fakeRoute(`${config.vercelOrigin}/api/v1/brain/summary?languageProfileId=00000000-0000-4000-8000-000000000002`, {
        authorization: `Bearer ${actor.accessToken}`,
      }),
      fakeRoute(`${config.vercelOrigin}/api/v1/library/concepts/7f110000-0000-4000-8000-000000000004`, {
        authorization: `Bearer ${actor.accessToken}`,
      }, new Response('{}'), undefined, 'DELETE'),
    ];
    for (const item of cases) {
      await forwardK2FrllBrowserRequest(item.route, config, sessions, direct);
      expect(item.abort).toHaveBeenCalledOnce();
      expect(item.fulfill).not.toHaveBeenCalled();
    }
    expect(direct).not.toHaveBeenCalled();

    const wrongSha = fakeRoute(`${config.vercelOrigin}/api/v1/me`, {
      authorization: `Bearer ${actor.accessToken}`,
    });
    await forwardK2FrllBrowserRequest(wrongSha.route, config, sessions, async () =>
      new Response('{}', { headers: { 'x-lingua-source-sha': 'b'.repeat(40) } }));
    expect(wrongSha.abort).toHaveBeenCalledOnce();
    expect(wrongSha.fulfill).not.toHaveBeenCalled();
  });
});
