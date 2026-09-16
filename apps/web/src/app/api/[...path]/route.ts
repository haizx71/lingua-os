import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const MAX_REQUEST_BODY_BYTES = 1_048_576;

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

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: crypto.randomUUID(),
      },
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function unavailableResponse(): NextResponse {
  return errorResponse(503, 'SERVICE_UNAVAILABLE', 'The API service is temporarily unavailable.');
}

function payloadTooLargeResponse(): NextResponse {
  return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
}

function invalidRequestBodyResponse(): NextResponse {
  return errorResponse(400, 'VALIDATION_ERROR', 'The request body could not be read.');
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

async function boundedRequestBody(request: Request): Promise<Uint8Array | undefined | NextResponse> {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || request.body === null) return undefined;

  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > MAX_REQUEST_BODY_BYTES) {
      return payloadTooLargeResponse();
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel('request body exceeds proxy limit');
        return payloadTooLargeResponse();
      }
      chunks.push(value);
    }
  } catch {
    return invalidRequestBodyResponse();
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) return undefined;

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
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

  const body = await boundedRequestBody(request);
  if (body instanceof NextResponse) return body;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method.toUpperCase(),
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
