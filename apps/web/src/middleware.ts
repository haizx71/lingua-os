import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';
import { getCanonicalVercelRedirect } from './lib/routing/canonical-host';

export async function middleware(request: NextRequest) {
  const hostHeader =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host');

  const canonicalRedirect = getCanonicalVercelRedirect(
    request.nextUrl,
    hostHeader,
    process.env.CANONICAL_WEB_ORIGIN,
  );

  if (canonicalRedirect) {
    return NextResponse.redirect(canonicalRedirect, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
