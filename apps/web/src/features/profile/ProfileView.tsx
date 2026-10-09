'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@lingua/ui';
import { ArrowRight, BookOpen, Brain, CalendarDays, Clock3, UserRound } from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';
import type { UserProfileData } from '../../fixtures/profileFixture';

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
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang tải hồ sơ người học..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty' || !initialProfile) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="max-w-2xl">
          <p className="lingua-kicker text-[var(--action-primary)]">Tài khoản</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Hồ sơ người học</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Quản lý thông tin tài khoản và mục tiêu học tập.</p>
        </header>
        <EmptyState
          title="Chưa thể hiển thị hồ sơ"
          description="Chưa thể hiển thị thông tin hồ sơ lúc này. Bạn có thể tiếp tục bài học ở Hôm nay."
          actionLabel="Về Hôm nay"
          onAction={() => { window.location.href = '/today'; }}
        />
      </div>
    );
  }

  const profile = initialProfile;
  const level = profile.startingLevelEstimate?.trim();
  const encountered = profile.totalConceptsEncountered;
  const mastered = profile.totalConceptsMastered;
  const masteryPercent = encountered !== undefined && mastered !== undefined && encountered > 0
    ? Math.min(100, Math.round((mastered / encountered) * 100))
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="lingua-kicker text-[var(--action-primary)]">Tài khoản</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Hồ sơ người học</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Thông tin tài khoản và mục tiêu học tập.</p>
        </div>
        <Link href="/settings" className="shrink-0"><Button variant="outline" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>Cài đặt</Button></Link>
      </header>

      <Card padding="lg" className="overflow-hidden bg-[var(--surface)]">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-lilac)] text-[var(--action-primary)]"><UserRound className="h-6 w-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">{profile.name?.trim() || 'Người học'}</h2>
              {profile.email && <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{profile.email}</p>}
              {profile.memberSince && <p className="mt-1 text-xs text-[var(--text-muted)]">Thành viên từ {profile.memberSince}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {level && level !== 'Chưa ước lượng' && <Badge variant="primary" size="md">{level}</Badge>}
            {profile.targetGoal && profile.targetGoal !== 'Chưa chọn' && <Badge variant="neutral" size="md">Mục tiêu: {profile.targetGoal}</Badge>}
          </div>
        </div>
        {(profile.timeZone || profile.startingLevelConfidence) && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]">
            {profile.timeZone && <span>Múi giờ: {profile.timeZone}</span>}
            {profile.startingLevelConfidence && <span>Độ tin cậy ước lượng: {profile.startingLevelConfidence}</span>}
          </div>
        )}
      </Card>

      <section aria-label="Tóm tắt hồ sơ" className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><BookOpen className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Từ đã gặp</p><p className="mt-0.5 text-2xl font-bold text-[var(--text-primary)]">{encountered ?? '—'}</p></div></div>
        </Card>
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]"><Brain className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Đã củng cố vững</p><p className="mt-0.5 text-2xl font-bold text-[var(--text-primary)]">{mastered ?? '—'}</p></div></div>
        </Card>
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-warm)] text-[var(--status-warning)]"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Ngày học liên tục</p><p className="mt-0.5 text-2xl font-bold text-[var(--text-primary)]">{profile.streakDays === undefined ? '—' : `${profile.streakDays} ngày`}</p></div></div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="lingua-kicker">Năng lực</p><h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Khái niệm đã củng cố</h2></div>
            {masteryPercent !== null && <span className="rounded-full bg-[var(--status-success-bg)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]">{masteryPercent}%</span>}
          </div>
          {masteryPercent !== null ? (
            <>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]" role="progressbar" aria-label="Tỷ lệ khái niệm đã củng cố" aria-valuenow={masteryPercent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[var(--status-success)]" style={{ width: `${masteryPercent}%` }} /></div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{mastered} trên {encountered} khái niệm đã gặp được ghi nhận là đã củng cố.</p>
            </>
          ) : <p className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">Chưa đủ dữ liệu để tính tỷ lệ củng cố.</p>}
        </Card>
        <Card padding="lg" className="bg-[var(--surface-lilac)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--action-primary)]"><Clock3 className="h-5 w-5" aria-hidden="true" /></span>
          <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">Tiếp tục học</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Mở kế hoạch hôm nay để xem hoạt động tiếp theo.</p>
          <Link href="/today" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 py-2 text-sm font-bold text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Mở Hôm nay <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </Card>
      </section>
    </div>
  );
}
