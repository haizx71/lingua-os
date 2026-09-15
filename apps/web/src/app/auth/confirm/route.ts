import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

const ALLOWED_NEXT_PATHS = new Set(['/onboarding', '/today', '/auth/reset-password']);

function safeNext(value: string | null): string {
  return value && ALLOWED_NEXT_PATHS.has(value) ? value : '/today';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const redirectTo = new URL(next, request.url);

  try {
    const supabase = await createServerSupabaseClient();

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(redirectTo);
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(redirectTo);
    }
  } catch {
    // Fail closed below with a clean public error route.
  }

  const errorUrl = new URL('/auth', request.url);
  errorUrl.searchParams.set('error', 'confirmation_failed');
  return NextResponse.redirect(errorUrl);
}
