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
});
