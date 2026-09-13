import { describe, expect, it, vi } from 'vitest';
import {
  AuthTokenProviderError,
  HttpApiClient,
  LinguaActorAbortedError,
  LinguaApiError,
  mapApiErrorToUi,
  mockApiResponses,
} from '@lingua/types';

const tokenProvider = { getAccessToken: vi.fn(async () => 'access-token') };

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

describe('HttpApiClient', () => {
  it('sends the configured base URL, Bearer token, JSON body and query', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.example.test/v1/today?languageProfileId=profile-1&date=2026-09-02');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
      return response(mockApiResponses.languageProfiles);
    });
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test/', authTokenProvider: tokenProvider, fetchFn });

    await client.getTodayPlan({ languageProfileId: 'profile-1', date: '2026-09-02' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('TEST-011-R2-05: serializes Today request without timeZone parameter across empty and populated queries', async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return response(mockApiResponses.today);
    });
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn });

    // 1. Empty query -> /v1/today (no timeZone parameter)
    await client.getTodayPlan();
    expect(urls[0]).toBe('https://api.example.test/v1/today');
    expect(urls[0]).not.toContain('timeZone');

    // 2. Query with contract-valid fields -> /v1/today?date=2026-09-05&languageProfileId=... (no timeZone parameter)
    await client.getTodayPlan({ date: '2026-09-05', languageProfileId: '00000000-0000-4000-8000-000000000001' });
    expect(urls[1]).toBe('https://api.example.test/v1/today?date=2026-09-05&languageProfileId=00000000-0000-4000-8000-000000000001');
    expect(urls[1]).not.toContain('timeZone');
  });

  it('distinguishes missing session from token-provider infrastructure failure', async () => {
    const fetchFn = vi.fn();
    const unauthenticated = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: { getAccessToken: vi.fn(async () => null) },
      fetchFn,
    });
    const missingSession = await unauthenticated.getMe().catch((error: unknown) => error);
    expect(missingSession).toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(mapApiErrorToUi(missingSession)).toMatchObject({ code: 'UNAUTHENTICATED', retryable: false });
    expect(fetchFn).not.toHaveBeenCalled();

    const infrastructure = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: {
        getAccessToken: vi.fn(async () => {
          throw new AuthTokenProviderError('provider unavailable', 'INFRASTRUCTURE_ERROR');
        }),
      },
      fetchFn,
    });
    await expect(infrastructure.getMe()).rejects.toBeInstanceOf(AuthTokenProviderError);
  });

  it('maps the standard error envelope without exposing server text', async () => {
    const client = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn: vi.fn(async () => response({
        error: {
          code: 'PRECONDITION_FAILED',
          message: 'internal database details',
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }, { status: 412 })),
    });

    const error = await client.updateMe({ body: { displayName: 'An' }, headers: { 'If-Match': 'etag-1' } } as never)
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(LinguaApiError);
    expect(error).toMatchObject({ code: 'PRECONDITION_FAILED', httpStatus: 412, requestId: '00000000-0000-4000-8000-000000000099' });
    expect((error as Error).message).not.toContain('database');
  });

  it('captures ETag and forwards If-Match and Idempotency-Key exactly', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
      if (fetchFn.mock.calls.length === 1) {
        expect(init?.headers).toMatchObject({ 'Idempotency-Key': '00000000-0000-4000-8000-000000000010' });
      } else {
        expect(init?.headers).toMatchObject({ 'If-Match': '"revision-1"' });
      }
      return response(mockApiResponses.languageProfile, { headers: { ETag: '"revision-2"' } });
    });
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn });

    await client.createMyLanguageProfile({
      body: { nativeLanguageCode: 'vi', targetLanguageCode: 'en', goal: 'communication', dailyMinutes: 25 },
      headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000010' },
    });
    await client.updateMyLanguageProfile({
      languageProfileId: 'profile-1',
      body: { dailyMinutes: 25 },
      headers: { 'If-Match': '"revision-1"' },
    });

    expect(client.getLastEtag('language-profile')).toBe('"revision-2"');
  });

  it('prefers the strong upstream ETag preserved by the same-origin proxy', async () => {
    const fetchFn = vi.fn(async () => response(mockApiResponses.me, {
      headers: {
        ETag: 'W/"profile-v1"',
        'X-Lingua-Upstream-ETag': '"profile-v1"',
      },
    }));
    const client = new HttpApiClient({
      baseUrl: '/api',
      authTokenProvider: tokenProvider,
      fetchFn,
    });

    await client.getMe();

    expect(client.getLastEtag('me')).toBe('"profile-v1"');
  });

  it('does not change an idempotency key when the caller repeats an ambiguous mutation', async () => {
    const fetchFn = vi.fn(async () => response(mockApiResponses.languageProfile));
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn });
    const headers = { 'Idempotency-Key': '00000000-0000-4000-8000-000000000011' };
    const input = {
      body: { nativeLanguageCode: 'vi', targetLanguageCode: 'en', goal: 'communication' as const, dailyMinutes: 25 },
      headers,
    };

    await client.createMyLanguageProfile(input);
    await client.createMyLanguageProfile(input);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[0]?.[1]?.headers as Record<string, string>)['Idempotency-Key'])
      .toBe((fetchFn.mock.calls[1]?.[1]?.headers as Record<string, string>)['Idempotency-Key']);
  });

  it('normalizes network and malformed responses to typed retryable errors', async () => {
    const network = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn: vi.fn(async () => { throw new TypeError('socket details'); }),
    });
    await expect(network.getMe()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    const malformed = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn: vi.fn(async () => new Response('not-json', { status: 500 })),
    });
    await expect(malformed.getMe()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', httpStatus: 500 });

    const malformedSuccess = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    });
    await expect(malformedSuccess.getMe()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', httpStatus: 200 });
  });

  it('TEST-AUTH-05: isolates cached ETags across actor transitions (User A -> Sign-Out -> User B)', async () => {
    const fetchFn = vi.fn(async () => response(mockApiResponses.me, { headers: { ETag: '"etag-user-a"' } }));
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn, actorId: 'user-a' });

    await client.getMe();
    expect(client.getLastEtag('me')).toBe('"etag-user-a"');

    // Sign out
    client.setActor(null);
    expect(client.getLastEtag('me')).toBeUndefined();

    // User B signs in
    fetchFn.mockResolvedValueOnce(response(mockApiResponses.me, { headers: { ETag: '"etag-user-b"' } }));
    client.setActor('user-b');
    expect(client.getLastEtag('me')).toBeUndefined();

    await client.getMe();
    expect(client.getLastEtag('me')).toBe('"etag-user-b"');
  });

  it('TEST-AUTH-06: clears ETags and advances generation on direct actor switch (A -> B)', async () => {
    const fetchFn = vi.fn(async () => response(mockApiResponses.me, { headers: { ETag: '"etag-a"' } }));
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn, actorId: 'user-a' });

    await client.getMe();
    expect(client.getLastEtag('me')).toBe('"etag-a"');
    const genA = client.getActorGeneration();

    client.setActor('user-b');
    expect(client.getLastEtag('me')).toBeUndefined();
    expect(client.getActorGeneration()).toBeGreaterThan(genA);
    expect(client.getCurrentActorId()).toBe('user-b');
  });

  it('TEST-AUTH-07: discards late in-flight response when actor changes before response arrives', async () => {
    let resolveLateFetch: (resp: Response) => void;
    const latePromise = new Promise<Response>((resolve) => {
      resolveLateFetch = resolve;
    });

    const fetchFn = vi.fn(async () => latePromise);
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn, actorId: 'user-a' });

    // Initiate request during user-a lifecycle
    const inFlightRequest = client.getMe();

    // Actor switches to user-b while request is in flight
    client.setActor('user-b');

    // User A's slow request finally resolves
    resolveLateFetch!(response(mockApiResponses.me, { headers: { ETag: '"etag-late-a"' } }));

    // Promise must reject with LinguaActorAbortedError
    await expect(inFlightRequest).rejects.toThrow();
    const rejectedError = await inFlightRequest.catch((err: unknown) => err);
    expect(rejectedError).toBeInstanceOf(LinguaActorAbortedError);
    expect((rejectedError as LinguaActorAbortedError).code).toBe('ABORTED');

    // ETags cache must NOT have been contaminated with User A's late ETag
    expect(client.getLastEtag('me')).toBeUndefined();
  });

  it('TEST-AUTH-08: same actor token refresh or setActor with identical ID preserves ETag state and generation', async () => {
    const fetchFn = vi.fn(async () => response(mockApiResponses.me, { headers: { ETag: '"etag-same-actor"' } }));
    const client = new HttpApiClient({ baseUrl: 'https://api.example.test', authTokenProvider: tokenProvider, fetchFn, actorId: 'user-same' });

    await client.getMe();
    expect(client.getLastEtag('me')).toBe('"etag-same-actor"');
    const initialGen = client.getActorGeneration();

    // Re-asserting the same actor ID (e.g. on session/token refresh) must be a no-op
    client.setActor('user-same');
    expect(client.getActorGeneration()).toBe(initialGen);
    expect(client.getLastEtag('me')).toBe('"etag-same-actor"');
  });

  it('TEST-007-TRANSPORT-01: listReviewQueue calls GET /v1/review/queue with auth and query params without leaking userId', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return response(mockApiResponses.reviewQueue);
    });
    const client = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn,
      actorId: 'user-review-1',
    });

    const result = await client.listReviewQueue({
      limit: 10,
      languageProfileId: '00000000-0000-4000-8000-000000000001',
    });

    expect(capturedUrl).toBe(
      'https://api.example.test/v1/review/queue?limit=10&languageProfileId=00000000-0000-4000-8000-000000000001'
    );
    expect(capturedInit?.method).toBe('GET');
    expect(capturedInit?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
    });
    expect(capturedUrl).not.toContain('user-review-1');
    expect(capturedUrl).not.toContain('userId');
    expect(result.data).toHaveLength(mockApiResponses.reviewQueue.data.length);
  });

  it('TEST-007-TRANSPORT-02: answerReviewItem calls POST /v1/review/{reviewItemId}/answer with Idempotency-Key and body', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return response(mockApiResponses.reviewAnswer);
    });
    const client = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: tokenProvider,
      fetchFn,
      actorId: 'user-review-1',
    });

    const idempotencyKey = '11111111-2222-4333-8444-555555555555';
    const result = await client.answerReviewItem({
      reviewItemId: '00000000-0000-4000-8000-000000000010',
      body: {
        rating: 'good',
        responseTimeMs: 1850,
      },
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });

    expect(capturedUrl).toBe(
      'https://api.example.test/v1/review/00000000-0000-4000-8000-000000000010/answer'
    );
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      rating: 'good',
      responseTimeMs: 1850,
    });
    expect(capturedUrl).not.toContain('userId');
    expect(result.data.reviewItemId).toBe(mockApiResponses.reviewAnswer.data.reviewItemId);
  });
});
