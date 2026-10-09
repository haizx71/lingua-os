'use client';

import React, { useEffect, useState } from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopBar } from './MobileTopBar';
import { TabletRail } from './TabletRail';
import { DesktopSidebar } from './DesktopSidebar';
import { MockApiClient } from '@lingua/types';
import { getApiClient, isHostedRuntime } from '../../lib/api/client';

function usesLocalSampleTransport(): boolean {
  if (isHostedRuntime()) return false;
  try {
    return getApiClient() instanceof MockApiClient;
  } catch {
    return false;
  }
}

export interface AppShellProps {
  children: React.ReactNode;
  focusMode?: boolean;
  currentPath?: string;
}

export function AppShell({ children, focusMode = false, currentPath }: AppShellProps) {
  const [showSampleNotice, setShowSampleNotice] = useState(false);
  useEffect(() => {
    setShowSampleNotice(usesLocalSampleTransport());
  }, []);
  if (focusMode) {
    return (
      <div className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--canvas)] text-[var(--text-primary)]">
        <a href="#main-content" className="sr-only z-[100] rounded-xl bg-[var(--surface)] px-4 py-3 font-semibold text-[var(--text-primary)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-[var(--focus-ring)]">
          Bỏ qua điều hướng
        </a>
        <main id="main-content" className="mx-auto min-h-[100dvh] w-full min-w-0 max-w-5xl overflow-x-clip px-4 py-5 sm:px-7 sm:py-8 lg:px-10">
          {showSampleNotice && <p role="note" className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">Bản xem trước · Dữ liệu minh họa không thuộc tài khoản của bạn.</p>}
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--canvas)] text-[var(--text-primary)] md:flex">
      <DesktopSidebar currentPath={currentPath} />
      <TabletRail currentPath={currentPath} />

      <div className="min-w-0 flex-1 md:pl-20 xl:pl-64">
        <MobileTopBar currentPath={currentPath} />
        <a href="#main-content" className="sr-only z-[100] rounded-xl bg-[var(--surface)] px-4 py-3 font-semibold text-[var(--text-primary)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-[var(--focus-ring)]">
          Bỏ qua điều hướng
        </a>
        <main id="main-content" className="min-h-[calc(100dvh-3.5rem)] min-w-0 overflow-x-clip pb-[calc(6rem+env(safe-area-inset-bottom))] md:min-h-[100dvh] md:pb-10">
          <div className="mx-auto w-full min-w-0 max-w-[1280px] px-4 py-5 sm:px-7 sm:py-7 lg:px-9 xl:px-12 xl:py-9">
            {showSampleNotice && <p role="note" className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">Bản xem trước · Dữ liệu minh họa không thuộc tài khoản của bạn.</p>}
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav currentPath={currentPath} />
    </div>
  );
}
