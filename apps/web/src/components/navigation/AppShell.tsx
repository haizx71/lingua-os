'use client';

import React from 'react';
import { MobileBottomNav } from './MobileBottomNav';
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
      <div className="min-h-screen bg-[var(--canvas)] text-[var(--text-primary)]">
        <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)] md:flex">
      <DesktopSidebar currentPath={currentPath} />
      <TabletRail currentPath={currentPath} />

      <main className="min-h-screen flex-1 pb-24 md:pl-20 md:pb-10 xl:pl-[17.5rem]">
        <div className="mx-auto w-full max-w-[1540px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10 xl:py-8">
          {children}
        </div>
      </main>

      <MobileBottomNav currentPath={currentPath} />
    </div>
  );
}
