'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Badge,
  Button,
  ConceptChip,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@lingua/ui';
import {
  User,
  Sparkles,
  BookOpen,
  Clock,
  Award,
  Calendar,
  Flame,
  CheckCircle2,
  Edit,
} from 'lucide-react';
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
  const [profile] = useState<UserProfileData>({
    ...defaultProfileData,
    ...initialProfile,
  });
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang nạp hồ sơ người học..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          User Account
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Hồ sơ người học
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Thông tin trình độ khởi điểm, mục tiêu và nhật ký hoạt động.
        </p>
      </header>

      {/* User Info Header Card */}
      <Card variant="default" padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--status-info-bg)] flex items-center justify-center text-[var(--status-info)] text-xl font-bold border-2 border-[var(--status-info-border)]">
            A2
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {profile.name ?? 'Chưa cung cấp'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Ước lượng khởi điểm: <span className="font-semibold text-[var(--action-primary)]">{profile.startingLevelEstimate}</span> • Độ tin cậy: {profile.startingLevelConfidence}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="success" size="sm">
                Tiếng Anh
              </Badge>
              <Badge variant="neutral" size="sm">
                Mục tiêu: Giao tiếp công việc
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

      {/* Overall Stats Card */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Tổng quan năng lực ngôn ngữ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)] font-medium">Tổng từ đã gặp</span>
            <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {profile.totalConceptsEncountered} từ
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Được lưu trong Brain</p>
          </div>
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)] font-medium">Đã nắm vững</span>
            <div className="text-2xl font-bold text-[var(--status-success)] mt-1">
              {profile.totalConceptsMastered} từ
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Chu kỳ FSRS bền vững</p>
          </div>
          <div className="p-4 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
            <span className="text-xs text-[var(--text-muted)] font-medium">Số ngày học liên tục</span>
            <div className="text-2xl font-bold text-[var(--action-primary)] mt-1 flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-[var(--status-warning)] fill-[var(--status-warning)]" />
              <span>{profile.streakDays} ngày</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Giữ nhịp học đều đặn</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
