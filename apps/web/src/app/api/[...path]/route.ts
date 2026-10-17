import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

const ALLOWED_TOP_LEVEL_PREFIXES = new Set(['v1', 'health']);

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
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  );
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

  // Preserve rate-limit and request correlation headers from upstream
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) headers.set('Retry-After', retryAfter);
  const requestId = response.headers.get('x-request-id');
  if (requestId) headers.set('X-Request-Id', requestId);

  // Security: Guarantee defensive security headers on all proxy responses
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return headers;
}

function isSafeSegment(segment: string): boolean {
  if (!segment) return false;
  // Reject URL-encoded directory traversal, slashes, or null bytes
  try {
    const decoded = decodeURIComponent(segment);
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('\0') ||
      decoded.includes('..')
    ) {
      return false;
    }
  } catch {
    return false;
  }
  // Disallow non-printable or control characters
  if (/[\x00-\x1f\x7f]/.test(segment)) return false;
  return true;
}

async function proxy(request: Request, { params }: RouteContext): Promise<Response> {
  const apiOrigin = configuredApiOrigin();
  if (!apiOrigin) return unavailableResponse();

  const route = await params;
  const segments = route.path ?? [];
  if (segments.length === 0 || !segments.every(isSafeSegment)) {
    return unavailableResponse();
  }

  // Security: Enforce allowed top-level API prefix to block SSRF / internal service probing
  const topSegment = segments[0]?.toLowerCase();
  if (!ALLOWED_TOP_LEVEL_PREFIXES.has(topSegment)) {
    return unavailableResponse();
  }

  const target = new URL(apiOrigin.origin);
  target.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

  const requestUrl = new URL(request.url);
  // Disallow CRLF or null bytes in search parameters to prevent header splitting / smuggling
  if (/[\r\n\0]/.test(requestUrl.search)) {
    return unavailableResponse();
  }
  target.search = requestUrl.search;

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

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
