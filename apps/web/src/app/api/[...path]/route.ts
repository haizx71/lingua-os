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

function forwardRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'host' || normalizedName === 'content-length' || normalizedName === 'cookie') return;
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) return;
    headers.set(name, value);
  });
  return headers;
}

function forwardResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  response.headers.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) return;
    // Node's fetch decodes compressed upstream bodies before this stream is
    // returned. Forwarding the original representation metadata makes the
    // browser attempt a second decode (ERR_CONTENT_DECODING_FAILED).
    if (normalizedName === 'content-encoding' || normalizedName === 'content-length') return;
    headers.set(name, value);
  });
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
