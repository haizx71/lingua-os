'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Mail,
  RotateCcw,
  Bookmark,
} from 'lucide-react';
import { useAuth } from './AuthContext';

export interface AuthEntryProps {
  readonly onAuthenticated?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image src="/assets/lingua-mark.png" alt="" width={42} height={42} priority className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0">
        <div className="truncate text-[16px] font-extrabold tracking-[-0.025em] text-[var(--text-primary)]">LINGUA OS</div>
        <div className="mt-0.5 hidden text-[11px] font-medium text-[var(--text-muted)] sm:block">Học theo nhịp của bạn</div>
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <section
      className="relative hidden min-w-0 flex-col justify-between overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] p-7 lg:flex lg:min-h-[640px] xl:p-9"
      aria-label="Cách học với LINGUA OS"
    >
      <div className="relative z-10">
        <p className="lingua-kicker text-[var(--action-primary)]">Cùng bạn học mỗi ngày</p>
        <h2 className="mt-3 max-w-md text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)]">Một câu chuyện. Một bước tiến nhỏ.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Đọc nội dung phù hợp, mở từ cần tìm hiểu và tự chọn điều muốn lưu để ôn lại.</p>
      </div>
      <Image
        src="/assets/reader-tea-book.png"
        alt="Tách trà và quyển sách minh họa cho trải nghiệm đọc"
        width={1492}
        height={1054}
        priority
        className="relative z-10 mx-auto my-3 w-full max-w-[520px] object-contain"
      />
      <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-5">
        <div className="min-w-0 rounded-2xl bg-[var(--surface)] p-3"><BookOpen className="h-4 w-4 text-[var(--action-primary)]" /><p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">Đọc ngữ cảnh</p></div>
        <div className="min-w-0 rounded-2xl bg-[var(--surface)] p-3"><RotateCcw className="h-4 w-4 text-[var(--accent-purple)]" /><p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">Ôn tập chủ động</p></div>
        <div className="min-w-0 rounded-2xl bg-[var(--surface)] p-3"><Bookmark className="h-4 w-4 text-[var(--status-success)]" /><p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">Kho cá nhân</p></div>
      </div>
    </section>
  );
}

export function AuthEntry({ onAuthenticated }: AuthEntryProps) {
  const {
    authState,
    isConfigured,
    error: authError,
    signIn,
    signUp,
    requestPasswordReset,
    resendSignupConfirmation,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    clearError();
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setMessage(null);
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setMessage(null);
    clearError();

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Mật khẩu cần ít nhất 8 ký tự.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setError('Hai mật khẩu chưa khớp nhau.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(normalizedEmail);
        setMessage('Nếu email này có tài khoản, liên kết đặt lại mật khẩu đã được gửi.');
        return;
      }

      const result = mode === 'signin'
        ? await signIn(normalizedEmail, password)
        : await signUp(normalizedEmail, password);

      if (mode === 'signup' && !result.session) {
        setPendingVerificationEmail(normalizedEmail);
        setMessage('Tài khoản đã được tạo. Hãy xác minh email trước khi đăng nhập.');
        return;
      }

      setMessage('Đăng nhập thành công.');
      onAuthenticated?.();
    } catch {
      if (mode === 'signin') {
        setError('Không thể đăng nhập. Hãy kiểm tra email, mật khẩu hoặc trạng thái xác minh email.');
      } else if (mode === 'signup') {
        setError('Không thể tạo tài khoản với thông tin này. Hãy kiểm tra email và thử lại.');
      } else {
        setError('Không thể gửi email khôi phục lúc này. Vui lòng thử lại sau.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setResending(true);
    setError(null);
    clearError();
    try {
      await resendSignupConfirmation(pendingVerificationEmail);
      setMessage('Email xác minh mới đã được gửi.');
    } catch {
      setError('Chưa thể gửi lại email xác minh. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  };

  if (!isConfigured) {
    return (
      <Card variant="elevated" padding="lg" className="mx-auto max-w-md space-y-3">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">Chào mừng đến LINGUA OS</h1>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">Môi trường đăng nhập chưa sẵn sàng.</p>
      </Card>
    );
  }

  const heading = mode === 'signin'
    ? 'Chào mừng trở lại'
    : mode === 'signup'
      ? 'Tạo tài khoản'
      : 'Đặt lại mật khẩu';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận liên kết đặt lại mật khẩu.'
    : mode === 'signup'
      ? 'Tạo tài khoản để bắt đầu xây dựng nhịp học phù hợp với bạn.'
      : 'Đăng nhập để tiếp tục hành trình học của bạn.';

  return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-[var(--canvas)] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-6">
          <BrandMark />
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="min-h-11 shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          )}
        </div>

        <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-7">
          <section className="min-w-0 rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-8 lg:flex lg:min-h-[620px] lg:items-center lg:p-10">
            <div className="mx-auto w-full min-w-0 max-w-[430px]">
              <div className="mb-7">
                <div className="mb-3 text-xs font-semibold text-[var(--action-primary)]">Tài khoản học tập</div>
                <h1 className="text-[32px] font-bold leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-[38px]">{heading}</h1>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">{description}</p>

                {mode === 'signin' && (
                  <p className="mt-4 text-sm text-[var(--text-secondary)]">
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      aria-label="Chưa có tài khoản? Đăng ký"
                      className="font-bold text-[var(--action-primary)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      onClick={() => switchMode('signup')}
                    >
                      Đăng ký
                    </button>
                  </p>
                )}
              </div>

              {(error || authError) && (
                <div className="mb-4">
                  <InlineAlert variant="danger" title="Không thể tiếp tục">{error ?? 'Yêu cầu xác thực chưa thành công. Vui lòng thử lại.'}</InlineAlert>
                </div>
              )}
              {message && (
                <div className="mb-4">
                  <InlineAlert variant="success" title="Đã cập nhật">{message}</InlineAlert>
                </div>
              )}

              <form className="min-w-0 space-y-4" onSubmit={submit}>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  label="Email"
                  aria-label="Email"
                  autoComplete="email"
                  placeholder="ten@email.com"
                  required
                  fullWidth
                  inputSize="lg"
                  leftIcon={<Mail className="h-5 w-5" />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-[54px] !rounded-xl !border-[var(--border-default)] !bg-[var(--surface-subtle)] !pl-12 text-base shadow-none focus:!bg-[var(--surface)]"
                />

                {mode !== 'forgot' && (
                  <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    label="Mật khẩu"
                    aria-label="Mật khẩu"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    minLength={mode === 'signup' ? 8 : 1}
                    placeholder="Mật khẩu"
                    required
                    fullWidth
                    inputSize="lg"
                    leftIcon={<LockKeyhole className="h-5 w-5" />}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-[54px] !rounded-xl !border-[var(--border-default)] !bg-[var(--surface-subtle)] !pl-12 text-base shadow-none focus:!bg-[var(--surface)]"
                  />
                )}

                {mode === 'signup' && (
                  <Input
                    id="auth-confirm-password"
                    name="confirm-password"
                    type="password"
                    label="Xác nhận mật khẩu"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Nhập lại mật khẩu"
                    fullWidth
                    inputSize="lg"
                    leftIcon={<LockKeyhole className="h-5 w-5" />}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-[54px] !rounded-xl !border-[var(--border-default)] !bg-[var(--surface-subtle)] !pl-12 text-base shadow-none focus:!bg-[var(--surface)]"
                  />
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="min-h-[54px] w-full rounded-xl text-base font-bold shadow-none"
                  rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined}
                  disabled={submitting || authState === 'loading'}
                >
                  {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Đăng ký' : 'Gửi liên kết đặt lại mật khẩu'}
                </Button>
              </form>

              {mode === 'signin' && (
                <button
                  type="button"
                  className="mx-auto mt-4 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => switchMode('forgot')}
                >
                  Quên mật khẩu?
                </button>
              )}

              {pendingVerificationEmail && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="mt-4 min-h-11 w-full rounded-2xl"
                  disabled={resending}
                  leftIcon={!resending ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                  onClick={() => void resendVerification()}
                >
                  {resending ? 'Đang gửi lại...' : 'Gửi lại email xác minh'}
                </Button>
              )}

              {mode === 'signup' && (
                <button
                  type="button"
                  className="mx-auto mt-5 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => switchMode('signin')}
                >
                  Đã có tài khoản? Đăng nhập
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  className="mx-auto mt-5 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => switchMode('signin')}
                >
                  Quay lại đăng nhập
                </button>
              )}

            </div>
          </section>

          <ProductPreview />
        </div>

        <footer className="mt-5 flex min-w-0 flex-col gap-2 px-1 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">Dữ liệu tài khoản được xử lý theo thiết lập bảo mật của bạn.</span>
          <span className="shrink-0 font-semibold text-[var(--text-secondary)]">LINGUA OS</span>
        </footer>
      </div>
    </main>
  );
}
