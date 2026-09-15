'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, InlineAlert, LoadingState } from '@lingua/ui';
import { AppShell } from '../navigation/AppShell';
import { useAuth } from '../../features/auth/AuthContext';
import { useProductReadiness } from '../../hooks/useProductReadiness';

const publicRoutes = new Set(['/', '/auth', '/auth/reset-password']);

/**
 * Keeps public auth/recovery surfaces separate from authenticated product routes.
 * Product routes still require authoritative backend readiness; recovery is exempt
 * so an authenticated password-recovery session cannot be redirected into onboarding.
 */
export interface AppRouteBoundaryProps {
  readonly children: React.ReactNode;
  readonly router?: { replace: (url: string) => void; push?: (url: string) => void };
  readonly pathname?: string;
}

export function AppRouteBoundary({
  children,
  router: customRouter,
  pathname: customPathname,
}: AppRouteBoundaryProps) {
  let router = customRouter;
  if (!router) {
    try {
      router = useRouter();
    } catch {
      // Invariant error outside Next.js App Router (e.g. isolated test environments)
    }
  }

  let pathname = customPathname;
  if (!pathname) {
    try {
      pathname = usePathname() ?? '/';
    } catch {
      pathname = '/';
    }
  }

  const effectiveRouter = router ?? { replace: () => {}, push: () => {} };
  const effectivePathname = pathname ?? '/';
  const { authState, isConfigured } = useAuth();
  const isAdminRoute = effectivePathname === '/admin' || effectivePathname.startsWith('/admin/');
  const isRecoveryRoute = effectivePathname === '/auth/reset-password';
  const readiness = useProductReadiness(undefined, !isAdminRoute && !isRecoveryRoute);
  const isPublicRoute = publicRoutes.has(effectivePathname);
  const isOnboardingRoute = effectivePathname === '/onboarding';

  useEffect(() => {
    if (!isConfigured || authState === 'loading') return;

    if (authState === 'unauthenticated' && !isPublicRoute) {
      effectiveRouter.replace('/auth');
      return;
    }

    if (authState === 'authenticated') {
      if (isAdminRoute || isRecoveryRoute) return;
      if (readiness.status === 'loading' || readiness.status === 'error') return;

      if (readiness.status === 'not_ready') {
        if (!isOnboardingRoute) effectiveRouter.replace('/onboarding');
        return;
      }

      if (readiness.status === 'ready') {
        if (effectivePathname === '/auth') {
          effectiveRouter.replace('/today');
          return;
        }
        if (isOnboardingRoute) {
          const hasAssessmentIntent =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('mode') === 'assessment';
          if (!hasAssessmentIntent) effectiveRouter.replace('/today');
        }
      }
    }
  }, [
    authState,
    effectivePathname,
    effectiveRouter,
    isAdminRoute,
    isConfigured,
    isOnboardingRoute,
    isPublicRoute,
    isRecoveryRoute,
    readiness.status,
  ]);

  if (!isPublicRoute && !isConfigured) {
    return (
      <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6">
        <InlineAlert variant="danger" title="Chưa cấu hình xác thực">
          Môi trường này chưa có cấu hình Supabase Auth để mở khu vực học tập.
        </InlineAlert>
      </main>
    );
  }

  if (!isPublicRoute && authState !== 'authenticated') {
    return <LoadingState message="Đang kiểm tra phiên đăng nhập..." count={2} />;
  }

  if (authState === 'authenticated') {
    if (effectivePathname === '/auth') {
      return (
        <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6">
          <LoadingState message="Đang chuyển hướng..." count={2} />
        </main>
      );
    }

    if (!isPublicRoute) {
      if (isAdminRoute) return <AppShell>{children}</AppShell>;
      if (readiness.status === 'loading') {
        return <LoadingState message="Đang kiểm tra hồ sơ học tập..." count={2} />;
      }

      if (readiness.status === 'not_ready' && !isOnboardingRoute) {
        return <LoadingState message="Đang chuyển hướng tới thiết lập lộ trình..." count={2} />;
      }

      if (readiness.status === 'error') {
        return (
          <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6">
            <div className="max-w-xl mx-auto space-y-4 pt-12">
              <InlineAlert variant="danger" title="Không thể kết nối hồ sơ">
                {readiness.error?.message || 'Không thể tải thông tin hồ sơ học tập. Vui lòng thử lại.'}
              </InlineAlert>
              <Button variant="outline" onClick={() => void readiness.refetch()}>
                Thử lại
              </Button>
            </div>
          </main>
        );
      }
    }
  }

  if (isPublicRoute) {
    return <main className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6">{children}</main>;
  }
  return <AppShell>{children}</AppShell>;
}
