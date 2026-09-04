'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, RotateCcw, Brain, TrendingUp } from 'lucide-react';
import { primaryNavItems } from './NavTypes';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  BookOpen,
  RotateCcw,
  Brain,
  TrendingUp,
};

export interface MobileBottomNavProps {
  currentPath?: string;
}

export function MobileBottomNav({ currentPath }: MobileBottomNavProps = {}) {
  let pathname = usePathname();
  if (!pathname && currentPath) {
    pathname = currentPath;
  }

  return (
    <nav
      aria-label="Điều hướng chính di động"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border-subtle)] pb-safe"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {primaryNavItems.map((item) => {
          const Icon = iconMap[item.iconName] || Home;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isActive
                  ? 'text-[var(--action-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-1 rounded-b-full bg-[var(--action-primary)]" />
              )}
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5px] text-[var(--action-primary)]' : 'stroke-[1.75px]'}`} />
              <span className="text-[11px] truncate">{item.labelVi}</span>
            </Link>
          );

        })}
      </div>
    </nav>
  );
}
