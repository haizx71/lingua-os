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

export interface TabletRailProps {
  currentPath?: string;
}

export function TabletRail({ currentPath }: TabletRailProps = {}) {
  let pathname = usePathname();
  if (!pathname && currentPath) {
    pathname = currentPath;
  }

  return (
    <aside
      aria-label="Điều hướng thanh bên thu gọn"
      className="hidden md:flex xl:hidden flex-col w-20 fixed left-0 top-0 bottom-0 z-30 bg-[var(--surface)] border-r border-[var(--border-subtle)] py-4 items-center justify-between"
    >
      <div className="flex flex-col items-center gap-6 w-full">
        {/* Brand Icon */}
        <Link
          href="/today"
          className="w-10 h-10 rounded-xl bg-[var(--action-primary)] flex items-center justify-center text-[var(--action-primary-text)] font-bold text-lg shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label="Trang chủ LINGUA OS"
        >
          L
        </Link>

        {/* Primary Navigation Rail */}
        <nav aria-label="Menu chính" className="flex flex-col items-center gap-2 w-full px-2">
          {primaryNavItems.map((item) => {
            const Icon = iconMap[item.iconName] || Home;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                title={item.labelVi}
                className={`relative flex flex-col items-center justify-center w-full h-14 rounded-xl text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  isActive
                    ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[var(--action-primary)]" />
                )}
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] text-[var(--action-primary)]' : 'stroke-[1.75px]'}`} />
                <span className="text-[10px] mt-1 truncate">{item.labelVi}</span>
              </Link>
            );

          })}
        </nav>
      </div>

      {/* Secondary Nav Bottom */}
      <nav aria-label="Menu phụ" className="flex flex-col items-center gap-2 w-full px-2">
        {secondaryNavItems.map((item) => {
          const Icon = iconMap[item.iconName] || User;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              title={item.labelVi}
              className={`flex items-center justify-center w-10 h-10 rounded-lg text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isActive
                  ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
