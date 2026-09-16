'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  MessageSquareText,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from './AuthContext';

export interface AuthEntryProps {
  readonly onAuthenticated?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173fba] text-base font-black text-white shadow-[0_10px_26px_rgba(23,63,186,0.24)]">
        L
        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#49c6b5]" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[17px] font-black tracking-[-0.03em] text-[#17213a]">LINGUA OS</div>
        <div className="mt-0.5 text-[11px] font-semibold tracking-[0.04em] text-[#8b91a0]">LEARN · SMARTER · EVERY DAY</div>
      </div>
    </div>
  );
}

function LearningArtwork() {
  return (
    <div className="relative min-h-[620px] overflow-hidden bg-[#173fba] text-white">
      <div className="absolute -left-20 -top-12 h-64 w-64 rounded-full border-[34px] border-[#0b2f8e] opacity-90" />
      <div className="absolute left-9 top-2 h-64 w-64 rounded-full border-[20px] border-[#0b2f8e] opacity-80" />
      <div className="absolute right-12 top-0 h-32 w-16 bg-[#44c3b1]" />
      <Send className="absolute right-20 top-12 h-8 w-8 -rotate-12 text-[#081f67]" fill="currentColor" />
      <Sparkles className="absolute right-8 top-28 h-9 w-9 text-[#ff725f]" fill="currentColor" />

      <div className="absolute right-8 top-40 flex h-16 w-24 items-center justify-center rounded-[18px] bg-[#ffe3a8] text-[#153c9f] shadow-lg">
        <MessageSquareText className="h-10 w-10" strokeWidth={1.8} />
      </div>

      <div className="absolute left-12 top-[41%] max-w-[320px]">
        <h2 className="text-[48px] font-black leading-[0.98] tracking-[-0.055em] text-white xl:text-[56px]">
          Better<br />People<br />Through<br />Languages.
        </h2>
      </div>

      <div className="absolute left-14 top-[70%] flex items-end gap-1.5 text-[#ffe29c]">
        <BarChart3 className="h-12 w-12" />
        <TrendingUp className="mb-4 h-9 w-9 text-[#4bc6b4]" />
      </div>

      <div className="absolute bottom-0 right-[-8%] h-[250px] w-[74%] opacity-50">
        <svg viewBox="0 0 420 260" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M46 219c12-67 34-108 69-124 26-12 57-4 77 14 20-20 43-31 73-27 57 7 100 56 115 137" stroke="#081f67" strokeWidth="4" strokeLinecap="round" />
          <path d="M111 185c-4-25 2-47 20-62 17-14 39-15 57-3 13 9 20 23 21 40" stroke="#081f67" strokeWidth="4" strokeLinecap="round" />
          <path d="M235 176c-7-28-2-52 15-70 18-19 45-26 69-17 21 8 36 26 42 50" stroke="#081f67" strokeWidth="4" strokeLinecap="round" />
          <circle cx="158" cy="151" r="4" fill="#081f67" />
          <circle cx="296" cy="137" r="4" fill="#081f67" />
          <path d="M147 171c9 7 19 7 28 0M286 157c9 7 19 7 28 0" stroke="#081f67" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 h-36 w-32 bg-[#0d286f]">
        <div className="absolute bottom-0 right-[-34px] h-16 w-16 rounded-tl-[50px] bg-[#45c3b1]" />
        <div className="absolute left-5 top-4 text-5xl font-black leading-none text-[#ff705d]">“</div>
        <Sparkles className="absolute right-5 top-14 h-9 w-9 text-[#ffe4a8]" fill="currentColor" />
      </div>
      <div className="absolute -bottom-12 -right-12 h-36 w-36 rounded-full border-[34px] border-[#ff725f]" />
    </div>
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
      if (password !== confirmPassword) {
        setError('Hai mật khẩu chưa khớp nhau.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(normalizedEmail);
        setMessage('Nếu email này có tài khoản, hướng dẫn đặt lại mật khẩu đã được gửi.');
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

  const heading = mode === 'signin' ? 'Welcome back 👋' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận liên kết đặt lại mật khẩu.'
    : mode === 'signup'
      ? 'Bắt đầu hành trình học được cá nhân hóa cho riêng bạn.'
      : 'Continue your learning journey.';

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-1 py-2 sm:px-4 sm:py-5 lg:py-8">
      <div className="mb-5 flex min-w-0 items-center justify-between gap-3 px-1 sm:mb-7">
        <BrandMark />
        {mode !== 'forgot' && (
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="min-h-11 shrink-0 rounded-full border border-[#173fba] bg-white px-5 text-sm font-extrabold text-[#173fba] transition-colors hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173fba] focus-visible:ring-offset-2"
          >
            {mode === 'signin' ? 'Sign up' : 'Log in'}
          </button>
        )}
      </div>

      <div className="grid min-w-0 overflow-hidden rounded-[26px] border border-[#e7e0d4] bg-white shadow-[0_24px_70px_rgba(27,39,74,0.12)] lg:grid-cols-[1.12fr_0.88fr] lg:rounded-[30px]">
        <section className="min-w-0 bg-[#fff7e6] px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14 xl:px-20">
          <div className="mx-auto flex w-full min-w-0 max-w-md flex-col justify-center lg:min-h-[620px]">
            <header className="mb-7 min-w-0">
              <h1 className="text-[34px] font-black leading-[1.02] tracking-[-0.055em] text-[#17213a] sm:text-[40px]">{heading}</h1>
              <p className="mt-3 text-sm leading-6 text-[#596277] sm:text-base">{description}</p>
            </header>

            {(error || authError) && (
              <div className="mb-4"><InlineAlert variant="danger" title="Không thể tiếp tục">{error ?? 'Yêu cầu xác thực chưa thành công. Vui lòng thử lại.'}</InlineAlert></div>
            )}
            {message && (
              <div className="mb-4"><InlineAlert variant="success" title="Đã cập nhật">{message}</InlineAlert></div>
            )}

            <form className="min-w-0 space-y-4" onSubmit={submit}>
              <Input
                id="auth-email"
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                fullWidth
                inputSize="lg"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-14 rounded-xl border-[#d8d1c4] bg-white text-[15px] shadow-none"
              />

              {mode !== 'forgot' && (
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  label="Password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : 1}
                  placeholder="Password"
                  required
                  fullWidth
                  inputSize="lg"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  helperText={mode === 'signup' ? 'Tối thiểu 8 ký tự.' : undefined}
                  className="h-14 rounded-xl border-[#d8d1c4] bg-white text-[15px] shadow-none"
                />
              )}

              {mode === 'signup' && (
                <Input
                  id="auth-confirm-password"
                  name="confirm-password"
                  type="password"
                  label="Confirm password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Confirm password"
                  required
                  fullWidth
                  inputSize="lg"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-14 rounded-xl border-[#d8d1c4] bg-white text-[15px] shadow-none"
                />
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="min-h-14 w-full rounded-full bg-[#102448] text-base font-extrabold shadow-none hover:bg-[#0c1b37]"
                rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined}
                disabled={submitting || authState === 'loading'}
              >
                {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
              </Button>
            </form>

            {mode === 'signin' && (
              <button
                type="button"
                className="mx-auto mt-4 min-h-10 rounded-lg px-2 text-sm font-semibold text-[#17213a] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173fba]"
                onClick={() => switchMode('forgot')}
              >
                Forgot password?
              </button>
            )}

            {pendingVerificationEmail && (
              <Button
                type="button"
                variant="outline"
                size="md"
                className="mt-4 min-h-11 w-full rounded-full"
                disabled={resending}
                leftIcon={!resending ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                onClick={() => void resendVerification()}
              >
                {resending ? 'Đang gửi lại...' : 'Gửi lại email xác minh'}
              </Button>
            )}

            <div className="mt-6 text-center text-sm text-[#5d667a]">
              {mode === 'signin' && (
                <button type="button" className="font-bold text-[#17213a] underline underline-offset-4" onClick={() => switchMode('signup')}>Create an account</button>
              )}
              {mode === 'signup' && (
                <button type="button" className="font-bold text-[#17213a] underline underline-offset-4" onClick={() => switchMode('signin')}>Already have an account? Log in</button>
              )}
              {mode === 'forgot' && (
                <button type="button" className="font-bold text-[#17213a] underline underline-offset-4" onClick={() => switchMode('signin')}>Back to log in</button>
              )}
            </div>
          </div>
        </section>

        <section className="hidden lg:block" aria-label="LINGUA OS learning illustration">
          <LearningArtwork />
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-[#e8e3da] px-2 pt-5 text-center text-xs text-[#747b89] sm:mt-8 sm:justify-between">
        <div className="flex items-center gap-2 text-[#17213a]">
          <BookOpen className="h-4 w-4 text-[#173fba]" />
          <Brain className="h-4 w-4 text-[#45bfae]" />
          <span className="font-semibold">Read · Practice · Remember</span>
        </div>
        <span>A modern language learning platform for a better you.</span>
      </div>
    </div>
  );
}
