'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain,
  BookOpen,
  Home,
  Library,
  Menu,
  RotateCcw,
  Search,
  Settings,
  TrendingUp,
  User,
  X,
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

export interface MobileTopBarProps {
  currentPath?: string;
}

export function MobileTopBar({ currentPath }: MobileTopBarProps = {}) {
  const pathnameFromRouter = usePathname();
  const pathname = pathnameFromRouter || currentPath || '/today';
  const [open, setOpen] = useState(false);

  const currentItem = useMemo(
    () => [...primaryNavItems, ...secondaryNavItems].find(
      (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
    ),
    [pathname]
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const renderItem = (item: (typeof primaryNavItems)[number]) => {
    const Icon = iconMap[item.iconName] || Home;
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setOpen(false)}
        className={`flex min-h-[52px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
          isActive
            ? 'bg-[var(--surface-blue)] text-[var(--action-primary)]'
            : 'text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white shadow-sm' : 'bg-[var(--surface-subtle)]'}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.labelVi}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--canvas)]/96 px-4 pt-[max(env(safe-area-inset-top),0.35rem)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-[58px] max-w-3xl items-center justify-between gap-3">
          <Link href="/today" className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <Image src="/assets/lingua-mark.png" alt="" width={38} height={38} priority className="h-[38px] w-[38px] shrink-0 rounded-full" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-extrabold tracking-[0.025em] text-[var(--text-primary)]">LINGUA OS</span>
              <span className="block truncate text-[11px] font-medium text-[var(--text-secondary)]">{currentItem?.labelVi ?? 'Học tập'}</span>
            </span>
          </Link>

          <button
            type="button"
            aria-label="Mở menu điều hướng"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="mobile-navigation-drawer"
            onClick={() => setOpen(true)}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-extrabold">Menu</span>
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-[#17213a]/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu LINGUA OS"
            className="absolute inset-y-0 right-0 flex w-[min(92vw,360px)] max-w-full flex-col overflow-hidden rounded-l-[26px] border-l border-[var(--border-subtle)] bg-[var(--surface)] shadow-[0_0_50px_rgba(32,28,83,0.2)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
              <div className="min-w-0">
                <div className="truncate text-sm font-black tracking-[-0.02em] text-[var(--text-primary)]">LINGUA OS</div>
                <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">Đi đến bất kỳ khu vực nào</div>
              </div>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Học tập</div>
              <nav aria-label="Điều hướng học tập" className="space-y-1">
                {primaryNavItems.map(renderItem)}
              </nav>

              <div className="my-4 h-px bg-[var(--border-subtle)]" />
              <div className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Khám phá & quản lý</div>
              <nav aria-label="Điều hướng quản lý" className="space-y-1">
                {secondaryNavItems.map(renderItem)}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
