'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  LockKeyhole,
  Mail,
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
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173fba] text-sm font-black text-white shadow-[0_8px_22px_rgba(23,63,186,0.22)]">
        L
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#49c6b5]" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[17px] font-black tracking-[-0.03em] text-[#17213a]">LINGUA OS</div>
        <div className="mt-0.5 hidden text-[10px] font-semibold tracking-[0.07em] text-[#8b91a0] sm:block">LEARN · SMARTER · EVERY DAY</div>
      </div>
    </div>
  );
}

function LearningArtwork() {
  return (
    <div className="relative h-full min-h-[640px] overflow-hidden bg-[linear-gradient(145deg,#214cc9_0%,#173fba_45%,#12328f_100%)] text-white">
      <div className="absolute -left-20 -top-16 h-72 w-72 rounded-full border-[34px] border-[#0c2f91] opacity-95" />
      <div className="absolute left-11 top-5 h-52 w-52 rounded-full border-[18px] border-[#0b2b83] opacity-75" />
      <div className="absolute right-16 top-0 h-36 w-16 bg-[#49c6b5]" />
      <Send className="absolute right-20 top-14 h-8 w-8 -rotate-12 text-[#0b286f]" fill="currentColor" />
      <Sparkles className="absolute right-8 top-32 h-9 w-9 text-[#ff725f]" fill="currentColor" />

      <div className="absolute right-8 top-44 flex h-16 w-24 items-center justify-center rounded-[16px] bg-[#ffe3a8] text-[#153c9f] shadow-[0_16px_34px_rgba(3,18,66,0.18)]">
        <MessageSquareText className="h-10 w-10" strokeWidth={1.7} />
      </div>

      <div className="absolute left-14 top-[38%] z-10 max-w-[330px]">
        <h2 className="text-[48px] font-black leading-[0.98] tracking-[-0.055em] text-white xl:text-[58px]">
          Better<br />People<br />Through<br />Languages.
        </h2>
      </div>

      <div className="absolute left-14 top-[72%] flex items-end gap-2 text-[#ffe29c]">
        <BarChart3 className="h-12 w-12" />
        <TrendingUp className="mb-4 h-9 w-9 text-[#4bc6b4]" />
      </div>

      <div className="absolute bottom-0 right-[-6%] h-[260px] w-[76%] opacity-55">
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
        <div className="absolute left-5 top-3 text-5xl font-black leading-none text-[#ff705d]">“</div>
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

  const heading = mode === 'signin' ? 'Welcome back 👋' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận liên kết đặt lại mật khẩu.'
    : mode === 'signup'
      ? 'Start small. Build consistency. Let LINGUA OS adapt with you.'
      : 'Continue your learning journey.';

  return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-[#f7f8fb] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-7">
          <BrandMark />
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="min-h-11 shrink-0 rounded-full border border-[#173fba] bg-white px-5 text-sm font-extrabold text-[#173fba] shadow-sm transition-colors hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173fba] focus-visible:ring-offset-2"
            >
              {mode === 'signin' ? 'Sign up' : 'Log in'}
            </button>
          )}
        </div>

        <div className="grid min-w-0 overflow-hidden rounded-[28px] border border-[#e8e2d8] bg-white shadow-[0_24px_80px_rgba(25,38,75,0.11)] lg:grid-cols-[1.15fr_0.85fr]">
          <section className="min-w-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,219,153,0.55),transparent_36%),linear-gradient(135deg,#fffaf0_0%,#fff1d6_100%)] px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12 xl:px-20">
            <div className="mx-auto flex w-full min-w-0 max-w-[430px] flex-col justify-center lg:min-h-[640px]">
              <header className="mb-7 min-w-0">
                <h1 className="max-w-full text-[33px] font-black leading-[1.04] tracking-[-0.05em] text-[#17213a] sm:text-[40px]">{heading}</h1>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-[#596277] sm:text-base">{description}</p>

                {mode === 'signin' && (
                  <button
                    type="button"
                    className="mt-4 inline-flex min-h-10 items-center rounded-lg px-1 text-sm font-bold text-[#17213a] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173fba]"
                    onClick={() => switchMode('signup')}
                  >
                    Create an account
                  </button>
                )}
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
                  leftIcon={<Mail className="h-5 w-5" />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-14 !rounded-[14px] !border-[#d8d1c4] !bg-white !pl-12 text-[15px] shadow-none"
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
                    leftIcon={<LockKeyhole className="h-5 w-5" />}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-14 !rounded-[14px] !border-[#d8d1c4] !bg-white !pl-12 text-[15px] shadow-none"
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
                    leftIcon={<LockKeyhole className="h-5 w-5" />}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-14 !rounded-[14px] !border-[#d8d1c4] !bg-white !pl-12 text-[15px] shadow-none"
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

              {mode === 'signup' && (
                <button type="button" className="mx-auto mt-5 min-h-10 rounded-lg px-2 text-sm font-bold text-[#17213a] underline underline-offset-4" onClick={() => switchMode('signin')}>
                  Already have an account? Log in
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" className="mx-auto mt-5 min-h-10 rounded-lg px-2 text-sm font-bold text-[#17213a] underline underline-offset-4" onClick={() => switchMode('signin')}>
                  Back to log in
                </button>
              )}
            </div>
          </section>

          <section className="hidden lg:block" aria-label="LINGUA OS learning illustration">
            <LearningArtwork />
          </section>
        </div>

        <footer className="mt-6 flex flex-col gap-3 border-t border-[#e4e7ee] pt-5 text-xs text-[#747b89] sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[15px]" aria-label="Supported language examples">
            <span>🇺🇸</span><span>🇪🇸</span><span>🇫🇷</span><span>🇩🇪</span><span>🇮🇹</span><span>🇵🇹</span>
          </div>
          <div className="flex items-center gap-2 text-[#596277]">
            <Brain className="h-4 w-4 text-[#45bfae]" />
            <span>A modern language learning platform for a better you.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
