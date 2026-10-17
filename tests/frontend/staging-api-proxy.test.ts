import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT,
} from '../../apps/web/src/app/api/[...path]/route';

type RouteContext = { params: Promise<{ path: string[] }> };

function context(...path: string[]): RouteContext {
  return { params: Promise.resolve({ path }) };
}

function request(method: string, url = 'https://staging.example.test/api/v1/me?cursor=next', body?: string): Request {
  return new Request(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer actor-token',
      'Content-Type': 'application/json',
      'X-Lingua-If-Match': '"profile-v1"',
      'Idempotency-Key': '00000000-0000-4000-8000-000000000001',
    },
    body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('production same-origin API proxy', () => {
  it('strips /api and forwards the method, query, body and contract headers', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":{},"meta":{}}', {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await POST(
      request('POST', 'https://staging.example.test/api/v1/me/languages?cursor=next', '{"goal":"communication"}'),
      context('v1', 'me', 'languages'),
    );

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(target)).toBe('https://api.internal.example.test/v1/me/languages?cursor=next');
    expect(init?.method).toBe('POST');
    const forwardedHeaders = new Headers(init?.headers);
    expect(forwardedHeaders.get('authorization')).toBe('Bearer actor-token');
    expect(forwardedHeaders.get('if-match')).toBe('"profile-v1"');
    expect(forwardedHeaders.get('x-lingua-if-match')).toBeNull();
    expect(forwardedHeaders.get('idempotency-key')).toBe('00000000-0000-4000-8000-000000000001');
    expect(forwardedHeaders.get('content-type')).toBe('application/json');
    expect(await new Response(init?.body).text()).toBe('{"goal":"communication"}');
  });

  it('supports every state-changing/read method required by the frozen API', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    const handlers: Readonly<Record<string, (input: Request, routeContext: RouteContext) => Promise<Response>>> = {
      GET,
      POST,
      PUT,
      PATCH,
      DELETE,
    };

    for (const [method, handler] of Object.entries(handlers)) {
      const response = await handler(request(method, 'https://staging.example.test/api/v1/resource', method === 'GET' ? undefined : '{}'), context('v1', 'resource'));
      expect(response.status).toBe(200);
    }

    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(fetchSpy.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });

  it('preserves upstream status, body and relevant response headers', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const body = '{"error":{"code":"PRECONDITION_FAILED","message":"retry","requestId":"00000000-0000-4000-8000-000000000002"}}';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 412,
        headers: {
          'Cache-Control': 'no-store',
          ETag: '"profile-v2"',
          'content-type': 'application/json',
        },
      }),
    );

    const response = await PATCH(request('PATCH', 'https://staging.example.test/api/v1/me', '{}'), context('v1', 'me'));

    expect(response.status).toBe(412);
    expect(await response.text()).toBe(body);
    expect(response.headers.get('etag')).toBe('"profile-v2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('drops stale representation headers after the server runtime decodes the upstream body', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const body = '{"data":{"id":"actor-1"},"meta":{}}';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Encoding': 'gzip',
          'Content-Length': '999',
          'content-type': 'application/json',
          ETag: '"profile-v1"',
        },
      }),
    );

    const response = await GET(request('GET'), context('v1', 'me'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('etag')).toBe('"profile-v1"');
    expect(response.headers.get('x-lingua-upstream-etag')).toBe('"profile-v1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('fails closed with a generic 503 when the server-only upstream is missing or invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const missing = await GET(request('GET'), context('v1', 'me'));
    expect(missing.status).toBe(503);
    expect((await missing.json()) as { error: { code: string } }).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.stubEnv('API_INTERNAL_URL', 'https://user:password@api.internal.example.test');
    const invalid = await GET(request('GET'), context('v1', 'me'));
    expect(invalid.status).toBe(503);
    expect(await invalid.text()).not.toContain('api.internal.example.test');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards rate-limit Retry-After and X-Request-Id headers from upstream 429 response while maintaining security headers', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const rateLimitBody = JSON.stringify({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please retry later.',
        requestId: 'req-rate-limit-429',
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(rateLimitBody, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '42',
          'X-Request-Id': 'req-rate-limit-429',
        },
      }),
    );

    const response = await GET(request('GET'), context('v1', 'me'));

    expect(response.status).toBe(429);
    expect(await response.text()).toBe(rateLimitBody);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(response.headers.get('x-request-id')).toBe('req-rate-limit-429');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
