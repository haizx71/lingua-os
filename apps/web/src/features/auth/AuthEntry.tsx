'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Flame,
  Headphones,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from './AuthContext';

export interface AuthEntryProps {
  readonly onAuthenticated?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

const skillPreview = [
  { label: 'Vocabulary', value: 72, tone: '#2aa995' },
  { label: 'Reading', value: 64, tone: '#5378e8' },
  { label: 'Listening', value: 58, tone: '#d8a945' },
  { label: 'Speaking', value: 46, tone: '#b878df' },
];

function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#15366f] text-sm font-black text-white shadow-[0_10px_24px_rgba(21,54,111,0.18)]">
        L
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#54c5b3]" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[17px] font-black tracking-[-0.035em] text-[#18243d]">LINGUA OS</div>
        <div className="mt-0.5 hidden text-[10px] font-semibold tracking-[0.08em] text-[#8b928f] sm:block">YOUR LANGUAGE BRAIN</div>
      </div>
    </div>
  );
}

function ProgressRing() {
  return (
    <div className="relative flex h-[168px] w-[168px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 168 168" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="84" cy="84" r="68" fill="none" stroke="#edf0ea" strokeWidth="13" />
        <circle
          cx="84"
          cy="84"
          r="68"
          fill="none"
          stroke="#39ad9a"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray="427"
          strokeDashoffset="116"
        />
      </svg>
      <div className="relative text-center">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#929991]">Level</div>
        <div className="mt-1 text-[46px] font-black leading-none tracking-[-0.06em] text-[#18243d]">B1</div>
        <div className="mt-2 text-xs font-bold text-[#49a998]">73% ready</div>
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <section
      className="relative hidden min-w-0 overflow-hidden rounded-[34px] border border-[#dde5df] bg-[#e7f0eb] p-6 lg:flex lg:min-h-[690px] lg:flex-col xl:p-8"
      aria-label="LINGUA OS product preview"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#c9e7de] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#f1dfbd] opacity-65 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-4 px-1 pb-5">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#76827c]">Learning preview</div>
          <h2 className="mt-1 text-[28px] font-black tracking-[-0.045em] text-[#18243d]">Your progress, in one place.</h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2c9c8b] shadow-[0_10px_30px_rgba(54,94,77,0.1)]">
          <Brain className="h-5 w-5" />
        </div>
      </div>

      <div className="relative z-10 rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_60px_rgba(58,86,73,0.12)] xl:p-7">
        <div className="grid min-w-0 items-center gap-7 xl:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex justify-center">
            <ProgressRing />
          </div>

          <div className="min-w-0">
            <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#18243d]">Language Brain</p>
                <p className="mt-1 text-xs leading-5 text-[#747d78]">A balanced view of the skills you are building.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e7f7f3] px-3 py-1 text-[11px] font-extrabold text-[#238c7b]">Growing</span>
            </div>

            <div className="space-y-4">
              {skillPreview.map((skill) => (
                <div key={skill.label} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-bold text-[#3f4b52]">{skill.label}</span>
                    <span className="shrink-0 font-extrabold text-[#6e7773]">{skill.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#eef1ed]">
                    <div className="h-full rounded-full" style={{ width: `${skill.value}%`, backgroundColor: skill.tone }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid min-w-0 grid-cols-3 gap-3">
        {[
          { label: 'Read', icon: BookOpen, surface: '#fff5df', color: '#b37625' },
          { label: 'Review', icon: Target, surface: '#e8f5f2', color: '#248f7f' },
          { label: 'Brain', icon: Brain, surface: '#edf0ff', color: '#526ed1' },
        ].map(({ label, icon: Icon, surface, color }) => (
          <div key={label} className="min-w-0 rounded-[22px] border border-white/80 bg-white/85 p-4 shadow-[0_12px_30px_rgba(58,86,73,0.08)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: surface, color }}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-3 truncate text-sm font-extrabold text-[#243047]">{label}</p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-5 rounded-[26px] border border-white/80 bg-[#17345d] p-5 text-white shadow-[0_18px_45px_rgba(27,52,87,0.18)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a9d9ce]">Featured reading</div>
            <p className="mt-2 truncate text-base font-extrabold">An Unexpected Morning</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#d7e0eb]">A short story chosen to stretch reading fluency without breaking momentum.</p>
          </div>
          <BookOpen className="mt-1 h-5 w-5 shrink-0 text-[#7dd5c5]" />
        </div>
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
    ? 'Welcome back'
    : mode === 'signup'
      ? 'Create your account'
      : 'Reset your password';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận liên kết đặt lại mật khẩu.'
    : mode === 'signup'
      ? 'Start with a few minutes a day. LINGUA OS will adapt as you learn.'
      : 'Continue from exactly where your learning left off.';

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f5f6f1] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="pointer-events-none absolute left-[-120px] top-[80px] h-[340px] w-[340px] rounded-full bg-[#f4e8cc] opacity-55 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-[-140px] h-[380px] w-[380px] rounded-full bg-[#d9eee8] opacity-55 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1240px]">
        <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-6">
          <BrandMark />
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="min-h-11 shrink-0 rounded-full border border-[#cad1cb] bg-white/85 px-5 text-sm font-extrabold text-[#183154] shadow-sm transition-colors hover:border-[#8ebcaf] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f9f8d] focus-visible:ring-offset-2"
            >
              {mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          )}
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-7">
          <section className="min-w-0 rounded-[30px] border border-[#e3e6df] bg-white/95 p-5 shadow-[0_24px_70px_rgba(40,54,47,0.08)] sm:p-8 lg:flex lg:min-h-[690px] lg:items-center lg:p-10 xl:p-12">
            <div className="mx-auto w-full min-w-0 max-w-[430px]">
              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eef6f2] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#468b7f]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Adaptive language learning
                </div>
                <h1 className="text-[34px] font-black leading-[1.02] tracking-[-0.052em] text-[#18243d] sm:text-[42px]">{heading}</h1>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-[#69736e] sm:text-[15px]">{description}</p>

                {mode === 'signin' && (
                  <p className="mt-4 text-sm text-[#69736e]">
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      aria-label="Chưa có tài khoản? Đăng ký"
                      className="font-extrabold text-[#1f7468] underline decoration-[#a9cec5] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f9f8d]"
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
                  placeholder="name@example.com"
                  required
                  fullWidth
                  inputSize="lg"
                  leftIcon={<Mail className="h-5 w-5" />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-[54px] !rounded-2xl !border-[#d6dcd6] !bg-[#fbfcfa] !pl-12 text-base shadow-none focus:!bg-white"
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
                    className="h-[54px] !rounded-2xl !border-[#d6dcd6] !bg-[#fbfcfa] !pl-12 text-base shadow-none focus:!bg-white"
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
                    fullWidth
                    inputSize="lg"
                    leftIcon={<LockKeyhole className="h-5 w-5" />}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-[54px] !rounded-2xl !border-[#d6dcd6] !bg-[#fbfcfa] !pl-12 text-base shadow-none focus:!bg-white"
                  />
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="min-h-[54px] w-full rounded-2xl bg-[#17345d] text-base font-extrabold shadow-[0_12px_28px_rgba(23,52,93,0.16)] hover:bg-[#10294c]"
                  rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined}
                  disabled={submitting || authState === 'loading'}
                >
                  {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Đăng ký' : 'Gửi liên kết đặt lại mật khẩu'}
                </Button>
              </form>

              {mode === 'signin' && (
                <button
                  type="button"
                  className="mx-auto mt-4 flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#4c5b58] transition-colors hover:text-[#1f7468] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f9f8d]"
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
                  className="mx-auto mt-5 flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#40524f] hover:text-[#1f7468] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f9f8d]"
                  onClick={() => switchMode('signin')}
                >
                  Đã có tài khoản? Đăng nhập
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  className="mx-auto mt-5 flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#40524f] hover:text-[#1f7468] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f9f8d]"
                  onClick={() => switchMode('signin')}
                >
                  Quay lại đăng nhập
                </button>
              )}

              <div className="mt-8 grid grid-cols-3 gap-2 border-t border-[#edf0eb] pt-5 text-center">
                <div className="min-w-0">
                  <Flame className="mx-auto h-4 w-4 text-[#d88b45]" />
                  <p className="mt-1 truncate text-[10px] font-bold text-[#7a827e]">Daily rhythm</p>
                </div>
                <div className="min-w-0">
                  <Brain className="mx-auto h-4 w-4 text-[#35a18f]" />
                  <p className="mt-1 truncate text-[10px] font-bold text-[#7a827e]">Adaptive path</p>
                </div>
                <div className="min-w-0">
                  <Headphones className="mx-auto h-4 w-4 text-[#627de0]" />
                  <p className="mt-1 truncate text-[10px] font-bold text-[#7a827e]">Real practice</p>
                </div>
              </div>
            </div>
          </section>

          <ProductPreview />
        </div>

        <footer className="mt-5 flex min-w-0 flex-col gap-2 px-1 text-xs text-[#7a827e] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquareText className="h-4 w-4 shrink-0 text-[#3da894]" />
            <span className="min-w-0">Learn a little every day. Let the system handle the path.</span>
          </div>
          <span className="shrink-0 font-semibold text-[#929995]">LINGUA OS</span>
        </footer>
      </div>
    </main>
  );
}
