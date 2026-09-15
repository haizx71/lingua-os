'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import { ArrowRight, BookOpen, Brain, CheckCircle2, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';

export interface AuthEntryProps {
  readonly onAuthenticated?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

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
        setMessage('Nếu email này có tài khoản, LINGUA OS đã gửi hướng dẫn đặt lại mật khẩu.');
        return;
      }

      const result = mode === 'signin'
        ? await signIn(normalizedEmail, password)
        : await signUp(normalizedEmail, password);

      if (mode === 'signup' && !result.session) {
        setPendingVerificationEmail(normalizedEmail);
        setMessage('Tài khoản đã được tạo. Hãy mở email xác minh trước khi đăng nhập.');
        return;
      }

      setMessage('Đăng nhập thành công. Đang mở không gian học tập của anh.');
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
      setMessage('Email xác minh mới đã được gửi. Hãy kiểm tra cả thư rác nếu chưa thấy.');
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
        <p className="text-sm leading-6 text-[var(--text-secondary)]">Môi trường này chưa được cấu hình Supabase Auth nên chưa thể đăng nhập.</p>
      </Card>
    );
  }

  const heading = mode === 'signin' ? 'Chào mừng anh quay lại' : mode === 'signup' ? 'Tạo tài khoản học tập' : 'Khôi phục mật khẩu';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận đường dẫn bảo mật đặt lại mật khẩu.'
    : mode === 'signup'
      ? 'Bắt đầu xây Language Brain riêng của anh và giữ toàn bộ tiến độ ở một nơi.'
      : 'Đăng nhập để tiếp tục đúng nơi Language Brain đã chuẩn bị cho anh.';

  return (
    <div className="mx-auto grid min-h-[620px] w-full max-w-5xl overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-floating)] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#eaf6ff] via-[#f5f8ff] to-[#ecf8f3] p-8 lg:flex lg:flex-col lg:justify-between xl:p-10">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/60" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-[var(--accent-teal)]/12 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-xs font-extrabold text-[var(--action-primary)] shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-[var(--accent-teal-strong)]" /> LINGUA OS
          </div>
          <h2 className="mt-7 max-w-md text-4xl font-black tracking-[-0.055em] text-[var(--text-primary)] xl:text-[44px] xl:leading-[1.08]">
            Mỗi ngày một chút. Não ngôn ngữ của anh sẽ nhớ phần còn lại.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Reader đưa từ vào ngữ cảnh, Review chọn đúng lúc cần ôn, còn Language Brain giúp anh nhìn thấy tiến bộ thật thay vì điểm thưởng ảo.
          </p>

          <div className="mt-8 grid max-w-md gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/72 p-3.5 shadow-sm backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><BookOpen className="h-5 w-5" /></span>
              <div><div className="text-sm font-extrabold text-[var(--text-primary)]">Học qua ngữ cảnh</div><div className="mt-0.5 text-xs text-[var(--text-secondary)]">Đọc nội dung vừa sức và gặp lại từ ở đúng thời điểm.</div></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/72 p-3.5 shadow-sm backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-teal-soft)] text-[var(--accent-teal-strong)]"><Brain className="h-5 w-5" /></span>
              <div><div className="text-sm font-extrabold text-[var(--text-primary)]">Một Language Brain riêng</div><div className="mt-0.5 text-xs text-[var(--text-secondary)]">Tiến độ, trí nhớ và năng lực của anh được nối thành một hệ thống.</div></div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--status-success)]" />
          <span>Đăng nhập an toàn bằng Supabase Auth; dữ liệu học tập vẫn tách khỏi identity.</span>
        </div>
      </section>

      <div className="flex items-center bg-[var(--surface-warm)]/35 px-5 py-7 sm:px-8 lg:bg-white lg:px-10 xl:px-12">
        <div className="mx-auto w-full max-w-md">
          <header className="mb-7">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--action-primary)] text-lg font-black text-white shadow-[0_8px_18px_rgba(66,103,217,0.2)]">L</span>
              <div><div className="text-sm font-extrabold text-[var(--text-primary)]">LINGUA OS</div><div className="text-[11px] text-[var(--text-muted)]">Your language brain</div></div>
            </div>
            <span className="lingua-kicker text-[var(--action-primary)]">Secure learning account</span>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--text-primary)]">{heading}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          </header>

          {(error || authError) && (
            <div className="mb-4"><InlineAlert variant="danger" title="Không thể hoàn tất xác thực">{error ?? 'Yêu cầu xác thực chưa thành công. Vui lòng thử lại.'}</InlineAlert></div>
          )}
          {message && (
            <div className="mb-4"><InlineAlert variant="success" title="Đã tiếp nhận">{message}</InlineAlert></div>
          )}

          <form className="space-y-4" onSubmit={submit}>
            <Input id="auth-email" name="email" type="email" label="Email" autoComplete="email" placeholder="anh@example.com" leftIcon={<Mail className="h-4 w-4" />} required fullWidth inputSize="lg" value={email} onChange={(event) => setEmail(event.target.value)} />

            {mode !== 'forgot' && (
              <Input id="auth-password" name="password" type="password" label="Mật khẩu" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : 1} leftIcon={<LockKeyhole className="h-4 w-4" />} required fullWidth inputSize="lg" value={password} onChange={(event) => setPassword(event.target.value)} helperText={mode === 'signup' ? 'Tối thiểu 8 ký tự.' : undefined} />
            )}

            {mode === 'signup' && (
              <Input id="auth-confirm-password" name="confirm-password" type="password" label="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} leftIcon={<LockKeyhole className="h-4 w-4" />} required fullWidth inputSize="lg" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button type="button" className="rounded-lg px-1 py-1 text-sm font-semibold text-[var(--action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" onClick={() => switchMode('forgot')}>Quên mật khẩu?</button>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined} disabled={submitting || authState === 'loading'}>
              {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Tạo tài khoản' : 'Gửi email khôi phục'}
            </Button>
          </form>

          {pendingVerificationEmail && (
            <Button type="button" variant="outline" size="md" className="mt-3 w-full" disabled={resending} leftIcon={!resending ? <CheckCircle2 className="h-4 w-4" /> : undefined} onClick={() => void resendVerification()}>{resending ? 'Đang gửi lại...' : 'Gửi lại email xác minh'}</Button>
          )}

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center">
            {mode === 'signin' && <button type="button" className="text-sm font-semibold text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signup')}>Chưa có tài khoản? Đăng ký</button>}
            {mode === 'signup' && <button type="button" className="text-sm font-semibold text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signin')}>Đã có tài khoản? Đăng nhập</button>}
            {mode === 'forgot' && <button type="button" className="text-sm font-semibold text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signin')}>Quay lại đăng nhập</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
