'use client';

import React from 'react';
import Image from 'next/image';
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

  const renderItem = (item: (typeof primaryNavItems)[number], primary: boolean) => {
    const Icon = iconMap[item.iconName] || Home;
    const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={`group flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
          isActive
            ? 'bg-[var(--surface-blue)] font-bold text-[var(--action-primary)]'
            : primary
              ? 'font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
              : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.labelVi}</span>
        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--action-primary)]" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Điều hướng màn hình lớn"
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-5 xl:flex"
    >
      <Link
        href="/today"
        aria-label="LINGUA OS — Hôm nay"
        className="mb-8 flex items-center gap-3 rounded-xl px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <Image src="/assets/lingua-mark.png" alt="" width={42} height={42} priority className="h-10 w-10 rounded-full" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-extrabold tracking-[-0.025em] text-[var(--text-primary)]">LINGUA OS</span>
          <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--text-muted)]">Học theo nhịp của bạn</span>
        </span>
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav aria-label="Menu chính" className="space-y-1">
          <div className="lingua-kicker mb-2 px-3">Học tập</div>
          {primaryNavItems.map((item) => renderItem(item, true))}
        </nav>

        <nav aria-label="Khám phá và cài đặt" className="mt-6 space-y-1 border-t border-[var(--border-subtle)] pt-5">
          <div className="lingua-kicker mb-2 px-3">Khám phá</div>
          {secondaryNavItems.map((item) => renderItem(item, false))}
        </nav>
      </div>

      <Link
        href="/profile"
        aria-label="Mở hồ sơ người học"
        className="mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lilac)] px-3 py-2.5 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--surface-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--action-primary)]">
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[var(--text-primary)]">Hồ sơ người học</span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">Mục tiêu và tài khoản</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </Link>
    </aside>
  );
}
