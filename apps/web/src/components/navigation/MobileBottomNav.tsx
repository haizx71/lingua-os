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
  if (!pathname && currentPath) pathname = currentPath;

  return (
    <nav
      aria-label="Điều hướng chính di động"
      className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
    >
      <div className="mx-auto flex h-[68px] max-w-md items-center gap-1 rounded-[24px] border border-[var(--border-subtle)] bg-white/95 px-1.5 shadow-[0_14px_40px_rgba(33,45,78,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/88">
        {primaryNavItems.map((item) => {
          const Icon = iconMap[item.iconName] || Home;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] px-1 text-[10px] font-semibold transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isActive
                  ? 'bg-[var(--surface-blue)] text-[var(--action-primary)]'
                  : 'text-[var(--text-secondary)] active:scale-[0.97]'
              }`}
            >
              <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-white text-[var(--action-primary)] shadow-sm' : ''}`}>
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </span>
              <span className="max-w-full truncate leading-none">{item.labelVi}</span>
              {isActive && <span className="absolute -bottom-0.5 h-1 w-5 rounded-full bg-[var(--accent-teal)]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
