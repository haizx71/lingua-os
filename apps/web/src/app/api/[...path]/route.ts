import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DICTIONARY_LOOKUP_PATH = 'v1/dictionary/lookup';
const MAX_DICTIONARY_LOOKUP_REQUEST_BYTES = 1024;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function configuredApiOrigin(): URL | null {
  const raw = process.env.API_INTERNAL_URL?.trim();
  if (!raw) return null;

  try {
    const value = new URL(raw);
    if (!['http:', 'https:'].includes(value.protocol)) return null;
    if (value.username || value.password || value.search || value.hash) return null;
    if (value.pathname !== '' && value.pathname !== '/') return null;
    return value;
  } catch {
    return null;
  }
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The API service is temporarily unavailable.',
        requestId: crypto.randomUUID(),
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
        requestId: crypto.randomUUID(),
      },
    },
    {
      status: 422,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}

type BoundedLookupBody =
  | { readonly kind: 'accepted'; readonly body: ArrayBuffer }
  | { readonly kind: 'invalid' | 'cancelled' };

async function cancelRequestBody(request: Request): Promise<void> {
  try {
    await request.body?.cancel();
  } catch {
    // The client may already have closed the stream.
  }
}

async function readBoundedLookupBody(request: Request): Promise<BoundedLookupBody> {
  if (request.signal.aborted) {
    await cancelRequestBody(request);
    return { kind: 'cancelled' };
  }

  const declaredLength = request.headers.get('content-length');
  const transferEncoding = request.headers.get('transfer-encoding');
  if (transferEncoding && declaredLength !== null) {
    await cancelRequestBody(request);
    return { kind: 'invalid' };
  }

  let expectedLength: number | null = null;
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim();
    if (!/^\d+$/.test(normalizedLength)) {
      await cancelRequestBody(request);
      return { kind: 'invalid' };
    }
    const significantDigits = normalizedLength.replace(/^0+/, '') || '0';
    if (significantDigits.length > 4) {
      await cancelRequestBody(request);
      return { kind: 'invalid' };
    }
    expectedLength = Number(significantDigits);
    if (expectedLength > MAX_DICTIONARY_LOOKUP_REQUEST_BYTES) {
      await cancelRequestBody(request);
      return { kind: 'invalid' };
    }
  }

  const bodyStream = request.body;
  if (!bodyStream) {
    return expectedLength === null || expectedLength === 0
      ? { kind: 'accepted', body: new ArrayBuffer(0) }
      : { kind: 'invalid' };
  }

  const reader = bodyStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const onAbort = () => {
    void reader.cancel(request.signal.reason).catch(() => undefined);
  };
  request.signal.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (request.signal.aborted) return { kind: 'cancelled' };
      if (done) break;
      const nextBytes = value?.byteLength ?? 0;
      if (totalBytes + nextBytes > MAX_DICTIONARY_LOOKUP_REQUEST_BYTES) {
        await reader.cancel();
        return { kind: 'invalid' };
      }
      totalBytes += nextBytes;
      chunks.push(value);
    }
  } catch {
    return request.signal.aborted ? { kind: 'cancelled' } : { kind: 'invalid' };
  } finally {
    request.signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }

  if (expectedLength !== null && totalBytes !== expectedLength) {
    return { kind: 'invalid' };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: 'accepted', body: body.buffer };
}

function forwardRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  const tunneledIfMatch = request.headers.get('x-lingua-if-match');
  request.headers.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'host' || normalizedName === 'content-length' || normalizedName === 'cookie') return;
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) return;
    if (normalizedName === 'x-lingua-if-match') return;
    if (normalizedName === 'if-match' && tunneledIfMatch) return;
    headers.set(name, value);
  });
  if (tunneledIfMatch) headers.set('If-Match', tunneledIfMatch);
  return headers;
}

function forwardResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  const upstreamEtag = response.headers.get('etag');
  response.headers.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) return;
    // Node's fetch decodes compressed upstream bodies before this stream is
    // returned. Forwarding the original representation metadata makes the
    // browser attempt a second decode (ERR_CONTENT_DECODING_FAILED).
    if (normalizedName === 'content-encoding' || normalizedName === 'content-length') return;
    if (normalizedName === 'x-lingua-upstream-etag') return;
    headers.set(name, value);
  });
  // Vercel may weaken the public ETag while applying representation encoding.
  // Preserve the FastAPI strong validator separately for the client to send
  // back as the contract-required If-Match value.
  if (upstreamEtag) headers.set('X-Lingua-Upstream-ETag', upstreamEtag);
  return headers;
}

async function proxy(request: Request, { params }: RouteContext): Promise<Response> {
  const apiOrigin = configuredApiOrigin();
  if (!apiOrigin) return unavailableResponse();

  const route = await params;
  const segments = route.path ?? [];
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return unavailableResponse();
  }

  const target = new URL(apiOrigin.origin);
  target.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
  target.search = new URL(request.url).search;

  const method = request.method.toUpperCase();
  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    if (method === 'POST' && segments.join('/') === DICTIONARY_LOOKUP_PATH) {
      const boundedBody = await readBoundedLookupBody(request);
      if (boundedBody.kind !== 'accepted') return validationErrorResponse();
      body = boundedBody.body;
    } else {
      body = await request.arrayBuffer();
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: forwardRequestHeaders(request),
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return unavailableResponse();
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream),
  });
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}
