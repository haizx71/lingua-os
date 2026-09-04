'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { InlineAlert, LoadingState } from '@lingua/ui';
import { AppShell } from '../navigation/AppShell';
import { useAuth } from '../../features/auth/AuthContext';

const publicRoutes = new Set(['/','/auth']);

/**
 * Keeps the public auth entry separate from authenticated product surfaces.
 * The boundary deliberately redirects only after AuthProvider has resolved the
 * session, preventing auth/onboarding redirect loops during SSR hydration.
 */
export function AppRouteBoundary({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { authState, isConfigured } = useAuth();
  const isPublicRoute = publicRoutes.has(pathname);

  useEffect(() => {
    if (!isConfigured || authState === 'loading') return;
    if (authState === 'unauthenticated' && !isPublicRoute) {
      router.replace('/auth');
      return;
    }
    if (authState === 'authenticated' && pathname === '/auth') {
      router.replace('/onboarding');
    }
  }, [authState, isConfigured, isPublicRoute, pathname, router]);

  if (!isPublicRoute && !isConfigured) {
    return <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6"><InlineAlert variant="danger" title="Chưa cấu hình xác thực">Môi trường này chưa có cấu hình Supabase Auth để mở khu vực học tập.</InlineAlert></main>;
  }

  if (!isPublicRoute && authState !== 'authenticated') {
    return <LoadingState message="Đang kiểm tra phiên đăng nhập..." count={2} />;
  }

  if (isPublicRoute) return <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6">{children}</main>;
  return <AppShell>{children}</AppShell>;
}
