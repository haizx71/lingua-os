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
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col md:flex-row">
      {/* Navigation for Desktop (>=1200px) */}
      <DesktopSidebar currentPath={currentPath} />

      {/* Navigation for Tablet (768px - 1199px) */}
      <TabletRail currentPath={currentPath} />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-20 xl:pl-64 pb-20 md:pb-8 transition-all min-h-screen">
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {/* Navigation for Mobile (<768px) */}
      <MobileBottomNav currentPath={currentPath} />
    </div>
  );
}
