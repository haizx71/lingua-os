'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  RotateCcw,
  Brain,
  TrendingUp,
  Library,
  Search,
  Settings,
  User,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { primaryNavItems, secondaryNavItems } from './NavTypes';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  BookOpen,
  RotateCcw,
  Brain,
  TrendingUp,
  Library,
  Search,
  Settings,
  User,
};

export interface DesktopSidebarProps {
  currentPath?: string;
}

export function DesktopSidebar({ currentPath }: DesktopSidebarProps = {}) {
  let pathname = usePathname();
  if (!pathname && currentPath) pathname = currentPath;

  return (
    <aside
      aria-label="Điều hướng màn hình lớn"
      className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-[var(--border-subtle)] bg-[color:var(--surface)]/95 px-5 py-6 backdrop-blur-xl xl:flex"
    >
      <Link
        href="/today"
        aria-label="LINGUA OS"
        className="group mb-8 flex items-center gap-3 rounded-2xl px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[var(--action-primary)] text-white shadow-[0_9px_22px_rgba(66,103,217,0.24)]">
          <span className="relative z-10 text-lg font-black tracking-tight">L</span>
          <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-[var(--accent-teal)]/80" />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold tracking-[-0.025em] text-[var(--text-primary)]">LINGUA OS</div>
          <div className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">Your language brain</div>
        </div>
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav aria-label="Menu chính" className="space-y-1">
          <div className="lingua-kicker mb-2 px-3">Học tập</div>
          {primaryNavItems.map((item) => {
            const Icon = iconMap[item.iconName] || Home;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isActive
                    ? 'bg-[var(--surface-blue)] text-[var(--action-primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--action-primary)_10%,transparent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{item.labelVi}</span>
                {isActive && <span className="h-2 w-2 rounded-full bg-[var(--accent-teal)]" aria-hidden />}
              </Link>
            );
          })}
        </nav>

        <nav aria-label="Khám phá và cài đặt" className="mt-7 space-y-1 border-t border-[var(--border-subtle)] pt-6">
          <div className="lingua-kicker mb-2 px-3">Khám phá</div>
          {secondaryNavItems.map((item) => {
            const Icon = iconMap[item.iconName] || User;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-xl px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isActive
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.labelVi}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/profile"
        aria-label="Xem hồ sơ người học"
        className="mt-5 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-warm)] p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xs font-extrabold text-[var(--action-primary)] shadow-sm">B1</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-[var(--text-primary)]">Hành trình của bạn</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
              <Sparkles className="h-3 w-3 text-[var(--status-warning)]" />
              <span>Tiếp tục xây Language Brain</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        </div>
      </Link>
    </aside>
  );
}
