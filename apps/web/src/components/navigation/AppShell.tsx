'use client';

import React from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopBar } from './MobileTopBar';
import { TabletRail } from './TabletRail';
import { DesktopSidebar } from './DesktopSidebar';

export interface AppShellProps {
  children: React.ReactNode;
  focusMode?: boolean;
  currentPath?: string;
}

export function AppShell({ children, focusMode = false, currentPath }: AppShellProps) {
  if (focusMode) {
    return (
      <div className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--canvas)] text-[var(--text-primary)]">
        <main className="mx-auto min-h-[100dvh] w-full min-w-0 max-w-5xl overflow-x-clip px-3 py-4 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-transparent text-[var(--text-primary)] md:flex">
      <DesktopSidebar currentPath={currentPath} />
      <TabletRail currentPath={currentPath} />

      <div className="min-w-0 flex-1 md:pl-20 xl:pl-[17.5rem]">
        <MobileTopBar currentPath={currentPath} />
        <main className="min-h-[calc(100dvh-3.5rem)] min-w-0 overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:min-h-[100dvh] md:pb-10">
          <div className="mx-auto w-full min-w-0 max-w-[1540px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8 xl:px-10 xl:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav currentPath={currentPath} />
    </div>
  );
}
