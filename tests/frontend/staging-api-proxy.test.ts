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

function lookupRequest(
  body: BodyInit,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Request {
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: 'Bearer actor-token',
    'Content-Type': 'application/json',
  });
  new Headers(options.headers).forEach((value, name) => headers.set(name, value));
  return new Request('https://staging.example.test/api/v1/dictionary/lookup', {
    method: 'POST',
    headers,
    body,
    signal: options.signal,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

function controlledSignal(initiallyAborted = false): { signal: AbortSignal; abort: () => void } {
  let aborted = initiallyAborted;
  const listeners = new Set<() => void>();
  const signal = {
    get aborted() { return aborted; },
    get reason() { return aborted ? new Error('synthetic abort') : undefined; },
    addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
      listeners.add(typeof listener === 'function'
        ? () => listener(new Event('abort'))
        : () => listener.handleEvent(new Event('abort')));
    },
    removeEventListener() { listeners.clear(); },
  } as unknown as AbortSignal;
  return {
    signal,
    abort() {
      if (aborted) return;
      aborted = true;
      listeners.forEach((listener) => listener());
    },
  };
}

function overrideRequestSignal(request: Request, signal: AbortSignal): Request {
  return new Proxy(request, {
    get(target, property) {
      if (property === 'signal') return signal;
      return Reflect.get(target, property, target) as unknown;
    },
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

  it('streams at most 1,024 lookup bytes and forwards the accepted body exactly', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const prefix = '{"surface":"tea"}';
    const body = prefix + ' '.repeat(1024 - new TextEncoder().encode(prefix).byteLength);

    const response = await POST(lookupRequest(body), context('v1', 'dictionary', 'lookup'));

    expect(response.status).toBe(200);
    const [target, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(target)).toBe('https://api.internal.example.test/v1/dictionary/lookup');
    expect(new TextEncoder().encode(await new Response(init?.body).text()).byteLength).toBe(1024);
  });

  it('rejects oversized streamed lookup bodies before forwarding or echoing them', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const sentinel = 'lookup-body-secret-sentinel';
    const chunks = [
      new TextEncoder().encode('{"surface":"tea","padding":"'),
      new TextEncoder().encode('x'.repeat(1024)),
      new TextEncoder().encode(`${sentinel}"}`),
    ];
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift();
        if (next) controller.enqueue(next);
        else controller.close();
      },
      cancel,
    });

    const response = await POST(lookupRequest(stream), context('v1', 'dictionary', 'lookup'));

    expect(response.status).toBe(422);
    const responseText = await response.text();
    expect(JSON.parse(responseText) as { error: { code: string; message: string } }).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
    });
    expect(responseText).not.toContain(sentinel);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it('rejects false, duplicate, and oversized declared lengths without forwarding', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cases = [
      { headers: { 'content-length': '1' }, bytes: '{"surface":"tea"}' },
      { headers: { 'content-length': 'not-a-number' }, bytes: '{}' },
      { headers: { 'content-length': '1025' }, bytes: '{}' },
      { headers: [['content-length', '1'], ['content-length', '2']] as HeadersInit, bytes: '{}' },
    ];

    for (const item of cases) {
      const response = await POST(
        lookupRequest(item.bytes, { headers: item.headers }),
        context('v1', 'dictionary', 'lookup'),
      );
      expect(response.status).toBe(422);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cancels pre-aborted and mid-read lookup streams without forwarding', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'https://api.internal.example.test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const preAborted = controlledSignal(true);
    const preAbortedCancel = vi.fn();
    const preAbortedStream = new ReadableStream<Uint8Array>({ cancel: preAbortedCancel });
    const preAbortedResponse = await POST(
      overrideRequestSignal(lookupRequest(preAbortedStream), preAborted.signal),
      context('v1', 'dictionary', 'lookup'),
    );
    expect(preAbortedResponse.status).toBe(422);
    expect(preAbortedCancel).toHaveBeenCalled();

    let pulledResolve!: () => void;
    const pulled = new Promise<void>((resolve) => { pulledResolve = resolve; });
    let pullCount = 0;
    const midReadCancel = vi.fn();
    const midReadStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"surface":"'));
      },
      pull() {
        pullCount += 1;
        pulledResolve();
        return new Promise<void>(() => undefined);
      },
      cancel: midReadCancel,
    });
    const midRead = controlledSignal();
    const midReadResponsePromise = POST(
      overrideRequestSignal(lookupRequest(midReadStream), midRead.signal),
      context('v1', 'dictionary', 'lookup'),
    );
    await pulled;
    midRead.abort();
    const midReadResponse = await midReadResponsePromise;

    expect(pullCount).toBeGreaterThan(0);
    expect(midReadResponse.status).toBe(422);
    expect(midReadCancel).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
