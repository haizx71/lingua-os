'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@lingua/ui';
import { Award, BookOpen, Brain, Flame, Sparkles } from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';
import { defaultProfileData, type UserProfileData } from '../../fixtures/profileFixture';

export interface ProfileViewProps {
  initialProfile?: Partial<UserProfileData>;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function ProfileView({
  initialProfile,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProfileViewProps) {
  const [profile] = useState<UserProfileData>({ ...defaultProfileData, ...initialProfile });
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang nạp hồ sơ người học..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty') return <EmptyState title="Hồ sơ chưa sẵn sàng" description="Hoàn tất thiết lập ban đầu để LINGUA OS cá nhân hóa hành trình học của bạn." actionLabel="Thiết lập hồ sơ" onAction={() => { window.location.href = '/onboarding'; }} />;

  const level = profile.startingLevelEstimate || 'A2';
  const shortLevel = level.trim().split(/\s+/)[0] || 'A2';
  const masteryPercent = profile.totalConceptsEncountered > 0
    ? Math.min(100, Math.round((profile.totalConceptsMastered / profile.totalConceptsEncountered) * 100))
    : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <h1 className="text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Hồ sơ người học</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Trình độ hiện tại, mục tiêu và những dấu mốc học tập của bạn.</p>
      </header>

      <section className="relative min-w-0 overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--surface-blue)] p-4 shadow-[var(--shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[var(--accent-teal-soft)]/70 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-[22px] bg-[var(--action-primary)] text-xl font-black text-white shadow-[0_12px_28px_rgba(66,103,217,0.24)] sm:h-20 sm:w-20 sm:self-auto sm:text-2xl">{shortLevel}</div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-xl font-black tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">{profile.name ?? 'Chưa cung cấp'}</h2>
              <span className="sr-only">User Account</span>
              <p className="mt-1 break-words text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">Ước lượng khởi điểm: <span className="font-extrabold text-[var(--action-primary)]">{level}</span> • Độ tin cậy: {profile.startingLevelConfidence}</p>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                <Badge variant="success" size="sm">Tiếng Anh</Badge>
                <Badge variant="neutral" size="sm">Mục tiêu: Giao tiếp công việc</Badge>
              </div>
            </div>
          </div>
          <Link href="/onboarding" className="w-full lg:w-auto"><Button className="w-full lg:w-auto" variant="outline" size="md">Đánh giá lại trình độ</Button></Link>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="md" className="min-w-0 rounded-[22px] bg-[var(--surface-blue)]">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--action-primary)] shadow-sm"><BookOpen className="h-5 w-5" /></span><div className="min-w-0"><div className="text-xs font-semibold text-[var(--text-muted)]">Tổng từ đã gặp</div><div className="mt-0.5 break-words text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{profile.totalConceptsEncountered}</div></div></div>
        </Card>
        <Card padding="md" className="min-w-0 rounded-[22px] bg-[var(--accent-teal-soft)]">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent-teal-strong)] shadow-sm"><Brain className="h-5 w-5" /></span><div className="min-w-0"><div className="text-xs font-semibold text-[var(--text-muted)]">Đã nắm vững</div><div className="mt-0.5 break-words text-2xl font-black tracking-[-0.04em] text-[var(--accent-teal-strong)]">{profile.totalConceptsMastered}</div></div></div>
        </Card>
        <Card padding="md" className="min-w-0 rounded-[22px] bg-[var(--surface-warm)]">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--status-warning)] shadow-sm"><Flame className="h-5 w-5 fill-current" /></span><div className="min-w-0"><div className="text-xs font-semibold text-[var(--text-muted)]">Số ngày học liên tục</div><div className="mt-0.5 break-words text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{profile.streakDays} ngày</div></div></div>
        </Card>
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <Card padding="lg" className="min-w-0 rounded-[26px]">
          <div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><h3 className="text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Tiến độ khái niệm</h3></div><span className="shrink-0 rounded-full bg-[var(--accent-teal-soft)] px-3 py-1 text-xs font-extrabold text-[var(--accent-teal-strong)]">{masteryPercent}%</span></div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--accent-teal)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${masteryPercent}%` }} /></div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="min-w-0 rounded-2xl bg-[var(--surface-subtle)] p-4"><div className="text-xs text-[var(--text-muted)]">Đã gặp</div><div className="mt-1 break-words text-lg font-black text-[var(--text-primary)]">{profile.totalConceptsEncountered} từ</div></div><div className="min-w-0 rounded-2xl bg-[var(--accent-teal-soft)] p-4"><div className="text-xs text-[var(--text-muted)]">Vững</div><div className="mt-1 break-words text-lg font-black text-[var(--accent-teal-strong)]">{profile.totalConceptsMastered} từ</div></div></div>
        </Card>

        <Card padding="lg" className="min-w-0 rounded-[26px] bg-[var(--surface-warm)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--status-warning)] shadow-sm"><Award className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black tracking-[-0.02em] text-[var(--text-primary)]">Giữ nhịp mỗi ngày</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Chuỗi hiện tại của bạn là {profile.streakDays} ngày liên tiếp. Tiến bộ bền vững đến từ việc quay lại đều đặn.</p>
          <Link href="/today" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 py-3 text-sm font-extrabold text-[var(--action-primary)]"><Sparkles className="h-4 w-4 shrink-0" />Tiếp tục kế hoạch hôm nay</Link>
        </Card>
      </section>
    </div>
  );
}
