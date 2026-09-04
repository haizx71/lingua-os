'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Button,
  Badge,
  Progress,
  InlineAlert,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@lingua/ui';
import {
  Sparkles,
  Award,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Clock,
  BookOpen,
  Volume2,
} from 'lucide-react';
import {
  PERSISTENCE_GAPS,
  mockLanguageProfile,
  type ApiErrorCode,
  type CompetenceDimension,
  type ConfidenceBand,
} from '@lingua/types';

export interface DiagnosticQuestion {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  skill: CompetenceDimension;
}

export interface DiagnosticResult {
  estimatedLevel: string;
  confidence: ConfidenceBand;
  evidenceCount: number;
  assessedSkills: readonly CompetenceDimension[];
  methodVersion: string;
}

const defaultQuestions: DiagnosticQuestion[] = [
  {
    id: 'diag-01',
    type: 'vocab_recognition',
    prompt: 'Từ nào có nghĩa là "cuộc hẹn chính thức"?',
    options: ['appointment', 'disappointment', 'apartment', 'approach'],
    skill: 'recognition',
  },
  {
    id: 'diag-02',
    type: 'sentence_comprehension',
    prompt: 'Chọn từ phù hợp vào chỗ trống: "The doctor is not _______ today; please come back tomorrow."',
    options: ['convenient', 'available', 'reluctant', 'obscure'],
    skill: 'recognition',
  },
  {
    id: 'diag-03',
    type: 'grammar_in_context',
    prompt: 'Cụm từ nào mang nghĩa "giữ đúng lịch trình"?',
    options: ['on schedule', 'at schedule', 'in schedule', 'by schedule'],
    skill: 'recognition',
  },

];

export interface OnboardingDiagnosticProps {
  questions?: DiagnosticQuestion[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onComplete?: (result: DiagnosticResult) => void;
}

export function OnboardingDiagnostic({
  questions = defaultQuestions,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onComplete,
}: OnboardingDiagnosticProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentSelectedOption, setCurrentSelectedOption] = useState<number | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const isCompleted = currentStep >= questions.length;
  const currentQuestion = questions[currentStep];

  const handleNextQuestion = () => {
    if (currentSelectedOption === null) return;

    setCurrentSelectedOption(null);

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep >= questions.length && onComplete) {
      const estimate = mockLanguageProfile.startingLevelEstimate;
      onComplete({
        estimatedLevel: estimate.level.code,
        confidence: estimate.confidenceBand,
        evidenceCount: estimate.evidenceCount,
        assessedSkills: estimate.assessedSkills,
        methodVersion: estimate.methodVersion,
      });
    }
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
      setCurrentStep(0);
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang chuẩn bị câu hỏi kiểm tra năng lực khởi điểm..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  if (currentState === 'empty' || questions.length === 0) {
    return (
      <EmptyState
        title="Chưa có câu hỏi chẩn đoán"
        description="Hệ thống chưa tải được bộ đề kiểm tra năng lực khởi điểm."
        actionLabel="Thử lại"
        onAction={handleRetry}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Header */}
      <header className="text-center space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          Diagnostic Placement • Khởi tạo lộ trình
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {isCompleted ? 'Kết quả ước lượng khởi điểm' : 'Kiểm tra năng lực thích nghi'}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          {isCompleted
            ? 'Dựa trên câu trả lời của bạn, LINGUA OS đã hiệu chỉnh kế hoạch Day 1.'
            : `Câu hỏi ${currentStep + 1} / ${questions.length} • Đo lường phản xạ từ vựng và ngữ cảnh`}
        </p>
      </header>

      {/* Progress Bar during questionnaire */}
      {!isCompleted && (
        <Card variant="subtle" padding="sm">
          <Progress
            value={Math.round(((currentStep + 1) / questions.length) * 100)}
            max={100}
            label={`Tiến trình chẩn đoán: ${currentStep + 1} / ${questions.length}`}
            showValueText
            size="sm"
          />
        </Card>
      )}

      {/* Active Question Card */}
      {!isCompleted && currentQuestion && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 text-xs text-[var(--text-muted)]">
            <span>Dạng bài: {currentQuestion.type === 'vocab_recognition' ? 'Nhận diện từ vựng' : currentQuestion.type === 'sentence_comprehension' ? 'Đọc hiểu câu' : 'Cụm từ cố định'}</span>
            <Badge variant="primary" size="sm">
              Bằng chứng {currentQuestion.skill}
            </Badge>
          </div>

          <div className="py-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {currentQuestion.prompt}
            </h2>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSelectedOption(idx)}
                className={`p-4 rounded-xl border text-left font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] min-h-[52px] ${
                  currentSelectedOption === idx
                    ? 'bg-[var(--status-info-bg)] border-[var(--action-primary)] text-[var(--action-primary)] ring-2 ring-[var(--focus-ring)]'
                    : 'bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                <span className="inline-block w-6 text-[var(--text-muted)] font-mono">
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-end">
            <Button
              variant="primary"
              size="md"
              disabled={currentSelectedOption === null}
              onClick={handleNextQuestion}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {currentStep + 1 === questions.length ? 'Hoàn thành chẩn đoán' : 'Câu tiếp theo'}
            </Button>
          </div>
        </Card>
      )}

      {/* Completion & Calibration Result Card */}
      {isCompleted && (
        <Card variant="elevated" padding="lg" className="space-y-6 animate-fadeIn">
          <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--status-info-bg)] flex items-center justify-center text-[var(--status-info)] text-2xl font-bold border-2 border-[var(--status-info-border)]">
              A2
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
                Ước lượng khởi điểm (ADR-009)
              </span>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                A2 Elementary
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Độ tin cậy: <span className="font-semibold text-[var(--status-success)]">Vừa</span> • 12 bằng chứng
              </p>
            </div>
          </div>

          {/* Calibration Summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">
              Dữ liệu ước lượng đã được ghi nhận:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Kỹ năng được đánh giá:</span>
                <p className="font-bold text-sm text-[var(--action-primary)] mt-0.5">Nhận diện • Nghe</p>
              </div>
              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Phiên bản phương pháp:</span>
                <p className="font-bold text-sm text-[var(--action-primary)] mt-0.5">starting-level-heuristic-v1</p>
              </div>

              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Kế hoạch tiếp theo:</span>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                  Today API sẽ cung cấp hoạt động phù hợp
                </p>
              </div>
              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Ngân sách từ mới:</span>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                  {PERSISTENCE_GAPS.newConceptBudget}
                </p>
              </div>
            </div>
          </div>

          {/* Start Learning CTA Button */}
          <div className="pt-2">
            <Link href="/today" className="w-full block">
              <Button
                variant="primary"
                size="lg"
                className="w-full min-h-[48px]"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Bắt đầu học ngày đầu tiên
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
