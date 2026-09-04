'use client';

import React from 'react';
import { LoadingState, EmptyState } from '@lingua/ui';
import { useAuth } from './AuthContext';
import { Lock } from 'lucide-react';

export interface ProtectedRouteProps {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
  readonly loadingFallback?: React.ReactNode;
}

/**
 * Protected route boundary component for authenticated product surfaces.
 * Prevents redirect loops during session bootstrap by rendering a loading state
 * until auth state is definitively known.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
  loadingFallback,
}) => {
  const { authState } = useAuth();

  if (authState === 'loading') {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className="py-12 max-w-xl mx-auto">
        <LoadingState message="Đang kiểm tra phiên đăng nhập..." count={2} />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="py-12 max-w-xl mx-auto">
        <EmptyState
          title="Yêu cầu xác thực"
          description="Bạn cần đăng nhập để truy cập tính năng học tập này."
          icon={<Lock className="w-10 h-10 text-[var(--text-muted)]" />}
        />
      </div>
    );
  }

  return <>{children}</>;
};

