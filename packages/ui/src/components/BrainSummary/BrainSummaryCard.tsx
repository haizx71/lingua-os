import React from 'react';
import { Brain, Award, BookOpen, AlertTriangle, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils';
import { Card } from '../Card/Card';
import { Badge } from '../Badge/Badge';
import { Progress } from '../Progress/Progress';
import { Button } from '../Button/Button';

export interface BrainSummaryCardProps {
  masteredCount: number;
  learningCount: number;
  weakCount: number;
  retentionRate?: number;
  memoryHealthScore?: number;
  levelEstimate?: string;
  confidence?: 'low' | 'medium' | 'high';
  cefrBreakdown?: Record<string, number>;
  onExploreClick?: () => void;
  className?: string;
}

export const BrainSummaryCard: React.FC<BrainSummaryCardProps> = ({
  masteredCount,
  learningCount,
  weakCount,
  retentionRate = 87,
  memoryHealthScore = 87,
  levelEstimate = 'A2 - B1',
  confidence = 'high',
  cefrBreakdown,
  onExploreClick,
  className,
}) => {
  const confidenceLabels = {
    low: 'Độ tin cậy: Thấp (Cần thêm bài đọc)',
    medium: 'Độ tin cậy: Trung bình',
    high: 'Độ tin cậy cao (Dựa trên 500+ tương tác)',
  };

  return (
    <Card
      variant="elevated"
      padding="lg"
      className={cn('space-y-6 font-sans', className)}
    >
      {/* Header with Title and Level Estimate Badge */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle,#E2E8F0)] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Brain className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Learner State Model
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary,#0F172A)] tracking-tight">
              Language Brain của bạn
            </h2>
          </div>
        </div>

        {levelEstimate && (
          <div className="text-right">
            <span className="text-xs text-[var(--text-muted,#94A3B8)] block">Ước lượng trình độ</span>
            <Badge variant="primary" size="md">
              CEFR {levelEstimate}
            </Badge>
          </div>
        )}
      </div>

      {/* 3 Metric Summary Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Mastered */}
        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>Đã vững (Mastered)</span>
            <Award className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
            {masteredCount}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
            Trí nhớ dài hạn FSRS
          </p>
        </div>

        {/* Learning */}
        <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-800 dark:text-sky-300">
            <span>Đang học (Learning)</span>
            <BookOpen className="w-4 h-4 text-sky-600" aria-hidden="true" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-sky-900 dark:text-sky-100">
            {learningCount}
          </p>
          <p className="text-[11px] text-sky-700/80 dark:text-sky-400">
            Đang tích lũy chu kỳ ôn
          </p>
        </div>

        {/* Weak / Due */}
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>Cần ôn (Weak / Due)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-900 dark:text-amber-100">
            {weakCount}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
            Ưu tiên trong phiên hôm nay
          </p>
        </div>
      </div>

      {/* Memory Health Retention Score */}
      <div className="p-4 rounded-xl bg-[var(--surface-subtle,#F1F5F9)] border border-[var(--border-subtle,#E2E8F0)] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary,#0F172A)]">
              Sức khỏe trí nhớ
            </span>
          </div>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {memoryHealthScore}%
          </span>
        </div>
        <Progress value={memoryHealthScore} max={100} variant="primary" size="sm" />
        <p className="text-[11px] text-[var(--text-secondary,#475569)]">
          {confidenceLabels[confidence]}
        </p>
      </div>

      {/* CEFR Distribution Breakdown */}
      {cefrBreakdown && Object.keys(cefrBreakdown).length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-[var(--text-secondary,#475569)] block">
            Phân bố vốn từ theo khung tham chiếu CEFR:
          </span>
          <div className="grid grid-cols-4 gap-2 text-center">
            {Object.entries(cefrBreakdown).map(([cefr, count]) => (
              <div
                key={cefr}
                className="p-2 rounded-lg bg-[var(--surface-subtle,#F1F5F9)] border border-[var(--border-subtle,#E2E8F0)]"
              >
                <span className="text-xs font-bold text-indigo-600 block">{cefr}</span>
                <span className="text-sm font-bold text-[var(--text-primary,#0F172A)]">{count} từ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explore Action Button */}
      {onExploreClick && (
        <div className="pt-2 flex justify-end">
          <Button
            variant="primary"
            onClick={onExploreClick}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Khám phá chi tiết Language Brain
          </Button>
        </div>
      )}
    </Card>
  );
};
