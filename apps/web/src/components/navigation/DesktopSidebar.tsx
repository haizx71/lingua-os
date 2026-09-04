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
  if (!pathname && currentPath) {
    pathname = currentPath;
  }

  return (
    <aside
      aria-label="Điều hướng màn hình lớn"
      className="hidden xl:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-30 bg-[var(--surface)] border-r border-[var(--border-subtle)] p-5 justify-between"
    >
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <Link
          href="/today"
          className="flex items-center gap-3 px-2 py-1 rounded-xl transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--action-primary)] flex items-center justify-center text-[var(--action-primary-text)] font-bold text-lg shadow-sm">
            L
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none text-[var(--text-primary)]">
              LINGUA OS
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Adaptive Learning</p>
          </div>
        </Link>

        {/* Primary Navigation */}
        <nav aria-label="Menu chính" className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-3 mb-1">
            Học tập
          </span>
          {primaryNavItems.map((item) => {
            const Icon = iconMap[item.iconName] || Home;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isActive
                    ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--action-primary)]" />
                )}
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] text-[var(--action-primary)]' : 'stroke-[1.75px]'}`} />
                <span>{item.labelVi}</span>
              </Link>
            );
          })}
        </nav>

        {/* Secondary Navigation */}
        <nav aria-label="Khám phá và cài đặt" className="flex flex-col gap-1 pt-4 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-3 mb-1">
            Khám phá & Quản lý
          </span>
          {secondaryNavItems.map((item) => {
            const Icon = iconMap[item.iconName] || User;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isActive
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.labelVi}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile / Brain Summary Card */}
      <Link
        href="/profile"
        aria-label="Xem hồ sơ người học"
        className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between hover:border-[var(--border-strong)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--status-info-bg)] text-[var(--action-primary)] flex items-center justify-center font-semibold text-xs border border-[var(--status-info-border)]">
            A2
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
              Learner Profile
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--status-warning)]" />
              <span>483 từ đã vững</span>
            </div>
          </div>
        </div>
        <div className="p-1.5 rounded-lg text-[var(--text-secondary)] group-hover:bg-[var(--surface)] group-hover:text-[var(--text-primary)] transition-colors">
          <User className="w-4 h-4" />
        </div>
      </Link>

    </aside>
  );
}
