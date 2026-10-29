'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [usedBeginnerBypass, setUsedBeginnerBypass] = useState(false);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const isCompleted = currentStep >= questions.length;
  const currentQuestion = questions[currentStep];
  const diagnosticPercent = questions.length > 0 ? Math.round(((currentStep + 1) / questions.length) * 100) : 0;
  const remainingQuestions = Math.max(1, questions.length - currentStep);
  const isBeginnerCalibration =
    usedBeginnerBypass ||
    selectedAnswers.filter((a) => a === -1).length >= Math.ceil(questions.length / 2);

  const handleSpeakPrompt = useCallback((text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      } catch {
        // ignore speech errors in unsupported environments
      }
    }
  }, []);

  const handleBeginnerBypass = useCallback(() => {
    setUsedBeginnerBypass(true);
    setSelectedAnswers([]);
    setCurrentSelectedOption(null);
    setCurrentStep(questions.length);
    if (onComplete) {
      onComplete({
        estimatedLevel: 'A1',
        confidence: 'high',
        evidenceCount: 1,
        assessedSkills: ['recognition'],
        methodVersion: 'beginner-zero-to-one-bypass-v1',
      });
    }
  }, [questions.length, onComplete]);

  const handleNextQuestion = useCallback(() => {
    if (currentSelectedOption === null) return;

    const updatedAnswers = [...selectedAnswers, currentSelectedOption];
    setSelectedAnswers(updatedAnswers);
    setCurrentSelectedOption(null);

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep >= questions.length && onComplete) {
      const isBeginner = updatedAnswers.filter((a) => a === -1).length >= Math.ceil(questions.length / 2);
      if (isBeginner) {
        onComplete({
          estimatedLevel: 'A1',
          confidence: 'high',
          evidenceCount: Math.max(updatedAnswers.length, 1),
          assessedSkills: ['recognition'],
          methodVersion: 'beginner-no-guessing-heuristic-v1',
        });
      } else {
        const estimate = mockLanguageProfile.startingLevelEstimate;
        const count = Math.max(updatedAnswers.length, estimate.evidenceCount);
        onComplete({
          estimatedLevel: estimate.level.code,
          confidence: estimate.confidenceBand,
          evidenceCount: count,
          assessedSkills: estimate.assessedSkills,
          methodVersion: estimate.methodVersion,
        });
      }
    }
  }, [currentSelectedOption, selectedAnswers, currentStep, questions.length, onComplete]);

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
      setCurrentStep(0);
      setSelectedAnswers([]);
      setCurrentSelectedOption(null);
      setUsedBeginnerBypass(false);
    }, 400);
  };

  useEffect(() => {
    if (currentState !== 'success' || isCompleted || !currentQuestion) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = event.key.toLowerCase();
      const optionMap: Record<string, number> = {
        '1': 0, 'a': 0,
        '2': 1, 'b': 1,
        '3': 2, 'c': 2,
        '4': 3, 'd': 3,
      };

      if (key in optionMap) {
        const optionIndex = optionMap[key];
        if (optionIndex < currentQuestion.options.length) {
          event.preventDefault();
          setCurrentSelectedOption(optionIndex);
        }
      } else if (key === '0') {
        event.preventDefault();
        setCurrentSelectedOption(-1);
      } else if (event.key === 'Enter') {
        if (currentSelectedOption !== null) {
          event.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentState, isCompleted, currentQuestion, currentSelectedOption, handleNextQuestion]);

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
          Khám phá trình độ • Khởi tạo lộ trình cá nhân
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
            value={diagnosticPercent}
            max={100}
            label={`Tiến trình chẩn đoán: ${currentStep + 1} / ${questions.length}`}
            showValueText
            size="sm"
          />
        </Card>
      )}

      {/* Beginner Callout */}
      {!isCompleted && (
        <div
          data-testid="onboarding-beginner-callout"
          className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lilac)]/55 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-0.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--action-primary)]">
              Dành cho người mới bắt đầu
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Chưa biết tiếng Anh hoặc mất gốc? Bạn không cần làm bài kiểm tra này.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            data-testid="onboarding-beginner-bypass"
            onClick={handleBeginnerBypass}
          >
            Bắt đầu từ Cơ bản (Mất gốc)
          </Button>
        </div>
      )}

      {/* Active Question Card */}
      {!isCompleted && currentQuestion && (
        <Card variant="elevated" padding="lg" className="space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>
                Câu {currentStep + 1}/{questions.length} • Dạng bài:{' '}
                {currentQuestion.type === 'vocab_recognition'
                  ? 'Nhận diện từ vựng'
                  : currentQuestion.type === 'sentence_comprehension'
                    ? 'Đọc hiểu câu'
                    : 'Cụm từ cố định'}
              </span>
              <span
                data-testid="diagnostic-percentage-indicator"
                aria-label="Tỷ lệ hoàn thành bài chẩn đoán"
                className="rounded-full bg-[var(--surface-lilac)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--action-primary)]"
              >
                {diagnosticPercent}%
              </span>
              <span
                data-testid="onboarding-time-estimate"
                aria-label="Thời gian ước tính hoàn thành bài chẩn đoán"
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--text-secondary)]"
              >
                ⏱️ Còn {remainingQuestions} câu (~1 phút)
              </span>
              <span
                data-testid="onboarding-question-category-tag"
                aria-label="Nhóm kỹ năng của câu hỏi chẩn đoán"
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--text-secondary)]"
              >
                🎯 Kỹ năng: Đọc hiểu & Ngữ cảnh
              </span>
            </div>
            <Badge variant="primary" size="sm">
              Bằng chứng: {
                (currentQuestion.skill as string) === 'recognition'
                  ? 'Nhận diện từ vựng'
                  : (currentQuestion.skill as string) === 'comprehension'
                    ? 'Đọc hiểu ngữ cảnh'
                    : (currentQuestion.skill as string) === 'listening'
                      ? 'Nghe hiểu'
                      : (currentQuestion.skill as string) === 'production'
                        ? 'Phản xạ ngôn ngữ'
                        : currentQuestion.skill
              }
            </Badge>
          </div>

          <div className="py-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {currentQuestion.prompt}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              data-testid="onboarding-speak-prompt"
              aria-label="Nghe phát âm câu hỏi"
              onClick={() => handleSpeakPrompt(currentQuestion.prompt)}
            >
              🔊 Nghe câu hỏi
            </Button>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSelectedOption(idx)}
                className={`group flex items-center justify-between p-4 rounded-xl border text-left font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] min-h-[52px] ${
                  currentSelectedOption === idx
                    ? 'bg-[var(--status-info-bg)] border-[var(--action-primary)] text-[var(--action-primary)] ring-2 ring-[var(--focus-ring)]'
                    : 'bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--action-primary)]/40 hover:bg-[var(--surface-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 text-[var(--text-muted)] font-mono">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span>{opt}</span>
                </div>
                <kbd
                  aria-hidden="true"
                  className={`ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-lg border px-1.5 font-mono text-[11px] font-bold ${
                    currentSelectedOption === idx
                      ? 'border-[var(--action-primary)]/30 bg-[var(--action-primary)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {idx + 1}
                </kbd>
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="onboarding-dont-know-option"
            onClick={() => setCurrentSelectedOption(-1)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
              currentSelectedOption === -1
                ? 'bg-[var(--status-info-bg)] border-[var(--action-primary)] text-[var(--action-primary)] ring-2 ring-[var(--focus-ring)]'
                : 'bg-[var(--surface-subtle)]/70 border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--action-primary)]/40'
            }`}
          >
            <span>Mình chưa biết từ/câu này (Chọn để không đoán mò — hệ thống sẽ xếp lộ trình cơ bản)</span>
            <kbd aria-hidden="true" className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--surface)] px-1 font-mono text-[10px]">0</kbd>
          </button>

          <p className="text-xs text-[var(--text-muted)]">
            Mẹo: Nhấn phím 1–4 (hoặc A–D) để chọn nhanh và Enter để tiếp tục
          </p>

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
              {isBeginnerCalibration ? 'A1' : 'A2'}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
                Ước lượng trình độ khởi điểm
              </span>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                {isBeginnerCalibration ? 'A1 Beginner (Lộ trình cho người mất gốc)' : 'A2 Elementary'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Độ tin cậy: <span className="font-semibold text-[var(--status-success)]">{isBeginnerCalibration ? 'Cao' : 'Vừa'}</span> • {usedBeginnerBypass ? 1 : Math.max(selectedAnswers.length, mockLanguageProfile.startingLevelEstimate.evidenceCount)} bằng chứng
              </p>
            </div>
          </div>

          {isBeginnerCalibration && (
            <div
              data-testid="onboarding-beginner-reassurance"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lilac)]/40 p-3.5 text-xs text-[var(--text-secondary)]"
            >
              Hệ thống đã bật chế độ hỗ trợ người mới: dịch tiếng Việt từng từ, đọc chậm 0.75x và gợi ý chữ cái khi ôn tập.
            </div>
          )}

          {/* Multi-Skill Diagnostic Competence Breakdown */}
          <div
            data-testid="onboarding-skill-breakdown"
            className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-xs)]"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Phân tích năng lực khởi điểm
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 p-2.5">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Nhận diện từ vựng</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-[var(--action-primary)]">
                  {isBeginnerCalibration ? 'Cơ bản (A1)' : 'Khá tốt (A2)'}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 p-2.5">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Đọc hiểu ngữ cảnh</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-[var(--action-primary)]">
                  {isBeginnerCalibration ? 'Có trợ giúp dịch' : 'Độc lập câu ngắn'}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 p-2.5">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Nhịp độ đề xuất</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-[var(--action-primary)]">
                  {isBeginnerCalibration ? '3–5 từ mới/ngày' : '5–8 từ mới/ngày'}
                </p>
              </div>
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
                <p className="font-bold text-sm text-[var(--action-primary)] mt-0.5">
                  {usedBeginnerBypass ? 'Lộ trình cơ bản cho người mất gốc' : 'Chuẩn đánh giá năng lực CEFR'}
                </p>
              </div>

              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Kế hoạch tiếp theo:</span>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                  Kế hoạch Hôm nay sẽ tự động cung cấp bài học phù hợp ngay khi bạn bắt đầu.
                </p>
              </div>
              <div className="p-3 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Ngân sách từ mới:</span>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                  {isBeginnerCalibration ? '3–5 từ mới/ngày (vừa sức cho người mới)' : '5–8 từ mới/ngày'}
                </p>
              </div>
            </div>

            <div
              data-testid="onboarding-clean-summary-meta"
              className="pt-2 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]"
            >
              <span className="rounded-lg bg-[var(--surface-subtle)] px-2.5 py-1">
                {usedBeginnerBypass ? 'Lộ trình cơ bản cho người mất gốc' : 'Chuẩn đánh giá năng lực CEFR'}
              </span>
              <span className="rounded-lg bg-[var(--surface-subtle)] px-2.5 py-1">
                {isBeginnerCalibration ? '3–5 từ mới/ngày (vừa sức cho người mới)' : '5–8 từ mới/ngày'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link href="/today" className="w-full sm:flex-1 block">
              <Button
                variant="primary"
                size="lg"
                className="w-full min-h-[48px]"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Bắt đầu học ngày đầu tiên
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-h-[48px]"
              onClick={handleRetry}
            >
              Làm lại bài đánh giá
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
