'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@lingua/ui';
import { CheckCircle2 } from 'lucide-react';
import type { ApiErrorCode, UiErrorState, UserProfileViewModel } from '@lingua/types';
import { defaultProfileData, type UserProfileData } from '../../fixtures/profileFixture';
import { useProfile, type ProfileLoadStatus } from './useProfile';

export interface ProfileViewProps {
  /** Story/test-only presentation override. Production callers should omit this. */
  initialProfile?: Partial<UserProfileData>;
  /** Story/test-only state override. Production callers should omit this. */
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

interface ProfileContentProps {
  readonly profile: UserProfileViewModel | null;
  readonly status: ProfileLoadStatus;
  readonly error: UiErrorState | null;
  retry(): void;
}

export function ProfileView(props: ProfileViewProps) {
  if (props.initialProfile !== undefined || props.forcedState !== undefined) {
    return <ControlledProfileView {...props} />;
  }
  return <LiveProfileView />;
}

function LiveProfileView() {
  const profile = useProfile();
  return <ProfileContent {...profile} />;
}

function ControlledProfileView({
  initialProfile,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProfileViewProps) {
  const [profile] = useState<UserProfileData>({
    ...defaultProfileData,
    ...initialProfile,
  });
  const error: UiErrorState | null =
    forcedState === 'error'
      ? {
          code: forcedErrorCode,
          message: 'Không thể tải hồ sơ người học.',
          retryable: true,
        }
      : null;
  return (
    <ProfileContent
      profile={forcedState === 'empty' ? null : profile}
      status={forcedState}
      error={error}
      retry={() => undefined}
    />
  );
}

function ProfileContent({ profile, status, error, retry }: ProfileContentProps) {
  if (status === 'loading') {
    return <LoadingState message="Đang nạp hồ sơ người học..." count={3} />;
  }

  if (status === 'error') {
    return <ErrorState code={error?.code ?? 'INTERNAL_ERROR'} onRetry={error?.retryable ? retry : undefined} />;
  }

  if (status === 'empty' || !profile) {
    return (
      <EmptyState
        title="Chưa có hồ sơ học tập"
        description="Hoàn tất thiết lập ban đầu để LINGUA có thể tạo hồ sơ và tổng hợp tiến độ của anh."
        actionLabel="Thiết lập hồ sơ"
        onAction={() => {
          window.location.href = '/onboarding';
        }}
      />
    );
  }

  const levelCode =
    profile.startingLevelEstimate === 'Chưa ước lượng'
      ? '—'
      : (profile.startingLevelEstimate.split(' ')[0] ?? '—');

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          User Account
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Hồ sơ người học
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Thông tin trình độ khởi điểm, mục tiêu và bằng chứng học tập từ dữ liệu tài khoản hiện tại.
        </p>
      </header>

      <Card variant="default" padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--status-info-bg)] flex items-center justify-center text-[var(--status-info)] text-xl font-bold border-2 border-[var(--status-info-border)]">
            {levelCode}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {profile.name ?? profile.email ?? 'Chưa cung cấp tên'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Ước lượng khởi điểm:{' '}
              <span className="font-semibold text-[var(--action-primary)]">
                {profile.startingLevelEstimate}
              </span>{' '}
              • Độ tin cậy: {profile.startingLevelConfidence}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="success" size="sm">
                Tiếng Anh
              </Badge>
              <Badge variant="neutral" size="sm">
                Mục tiêu: {profile.targetGoal}
              </Badge>
            </div>
          </div>
        </div>

        <Link href="/onboarding">
          <Button variant="outline" size="sm">
            Đánh giá lại trình độ
          </Button>
        </Link>
      </Card>

      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Tổng quan năng lực ngôn ngữ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)] font-medium">Khái niệm đã gặp</span>
            <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {profile.totalConceptsEncountered}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Theo trạng thái Brain hiện tại</p>
          </div>
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)] font-medium">Đã nắm vững</span>
            <div className="text-2xl font-bold text-[var(--status-success)] mt-1">
              {profile.totalConceptsMastered}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Theo projection Brain authoritative</p>
          </div>
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
            <span className="text-xs text-[var(--text-muted)] font-medium">Ngày đạt mục tiêu trong 30 ngày</span>
            <div className="text-2xl font-bold text-[var(--action-primary)] mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
              <span>{profile.streakDays} ngày</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Không đồng nghĩa với chuỗi ngày liên tục</p>
          </div>
        </div>
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        Thành viên từ {profile.memberSince}
        {profile.timeZone ? ` • Múi giờ ${profile.timeZone}` : ''}
      </p>
    </div>
  );
}
