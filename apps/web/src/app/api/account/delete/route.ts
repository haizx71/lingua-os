import { NextRequest, NextResponse } from 'next/server';
import { getSupabasePublicConfig } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REQUEST_BYTES = 4096;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

function requestOriginIsSameOrigin(request: NextRequest): boolean {
  // Defense-in-depth: Validate Fetch Metadata to reject cross-site requests
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false;
  }

  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');

  if (!origin || !forwardedHost || !forwardedProto) return false;

  const host = forwardedHost.split(',')[0]?.trim();
  const proto = forwardedProto.split(',')[0]?.trim().toLowerCase();
  if (!host || (proto !== 'http' && proto !== 'https')) return false;

  try {
    const originUrl = new URL(origin);
    const expectedOrigin = `${proto}://${host}`;
    return originUrl.origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // This route deliberately uses the authenticated same-origin SSR session.
  // Cross-site browser requests are rejected before any credentials/body are forwarded.
  if (!requestOriginIsSameOrigin(request)) {
    return response({ error: 'forbidden_origin' }, 403);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return response({ error: 'unsupported_media_type' }, 415);
  }

  let confirmationEmail = '';
  let currentPassword = '';
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return response({ error: 'request_too_large' }, 413);
    }

    const body = JSON.parse(rawBody) as {
      confirmationEmail?: unknown;
      currentPassword?: unknown;
    };
    confirmationEmail = typeof body.confirmationEmail === 'string'
      ? body.confirmationEmail.trim()
      : '';
    currentPassword = typeof body.currentPassword === 'string'
      ? body.currentPassword
      : '';
  } catch {
    return response({ error: 'invalid_request' }, 400);
  }

  if (
    !confirmationEmail ||
    confirmationEmail.length > MAX_EMAIL_LENGTH ||
    !currentPassword ||
    currentPassword.length > MAX_PASSWORD_LENGTH
  ) {
    return response({ error: 'invalid_request' }, 400);
  }

  const config = getSupabasePublicConfig();
  if (!config.isConfigured) {
    return response({ error: 'server_configuration_error' }, 500);
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return response({ error: 'unauthorized' }, 401);
  }

  // getUser() above performs the authoritative server-side identity check.
  // getSession() is used only afterwards to retrieve the verified caller's JWT
  // for the server-to-server Edge Function request.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return response({ error: 'unauthorized' }, 401);
  }

  const functionUrl = `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-account`;
  let upstream: Response;
  try {
    upstream = await fetch(functionUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmationEmail, currentPassword }),
    });
  } catch {
    return response({ error: 'account_service_unavailable' }, 503);
  }

  if (upstream.ok) {
    return response({ deleted: true }, 200);
  }
  if (upstream.status === 400) {
    return response({ error: 'confirmation_mismatch' }, 400);
  }
  if (upstream.status === 401) {
    return response({ error: 'unauthorized' }, 401);
  }
  if (upstream.status === 403) {
    return response({ error: 'recent_authentication_required' }, 403);
  }

  return response({ error: 'delete_failed' }, 502);
}
