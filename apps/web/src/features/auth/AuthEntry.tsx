'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
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
      <Card variant="elevated" padding="lg" className="max-w-md mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Chào mừng đến LINGUA OS</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Môi trường này chưa được cấu hình Supabase Auth nên chưa thể đăng nhập.
        </p>
      </Card>
    );
  }

  const heading = mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Tạo tài khoản' : 'Khôi phục mật khẩu';
  const description = mode === 'forgot'
    ? 'Nhập email để nhận đường dẫn bảo mật đặt lại mật khẩu.'
    : 'Một tài khoản cho toàn bộ tiến độ, lịch ôn và dữ liệu học tập của anh.';

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
      <section className="hidden min-h-[560px] overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-8 lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--action-primary)]">
            <ShieldCheck className="h-4 w-4" /> LINGUA OS Identity
          </div>
          <div className="space-y-3">
            <h2 className="max-w-md text-4xl font-black tracking-tight text-[var(--text-primary)]">
              Học tiếp đúng nơi anh đã dừng lại.
            </h2>
            <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Phiên đăng nhập được giữ bằng cookie Supabase SSR; API phía sau chỉ nhận JWT đã được xác minh trước khi đọc hoặc ghi dữ liệu người học.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <KeyRound className="mb-3 h-5 w-5 text-[var(--action-primary)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Khôi phục an toàn</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Có email recovery, callback xác minh và đặt mật khẩu mới.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-[var(--action-primary)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Tách auth và profile</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Identity không được dùng thay cho hồ sơ học tập authoritative.</p>
          </div>
        </div>
      </section>

      <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md space-y-6 lg:max-w-none lg:p-8">
        <header className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--action-primary)]">LINGUA OS</span>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{heading}</h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </header>

        {(error || authError) && (
          <InlineAlert variant="danger" title="Không thể hoàn tất xác thực">
            {error ?? 'Yêu cầu xác thực chưa thành công. Vui lòng thử lại.'}
          </InlineAlert>
        )}
        {message && (
          <InlineAlert variant="success" title="Đã tiếp nhận">
            {message}
          </InlineAlert>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <Input
            id="auth-email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            placeholder="anh@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
            required
            fullWidth
            inputSize="lg"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {mode !== 'forgot' && (
            <Input
              id="auth-password"
              name="password"
              type="password"
              label="Mật khẩu"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : 1}
              leftIcon={<LockKeyhole className="h-4 w-4" />}
              required
              fullWidth
              inputSize="lg"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText={mode === 'signup' ? 'Tối thiểu 8 ký tự.' : undefined}
            />
          )}

          {mode === 'signup' && (
            <Input
              id="auth-confirm-password"
              name="confirm-password"
              type="password"
              label="Nhập lại mật khẩu"
              autoComplete="new-password"
              minLength={8}
              leftIcon={<LockKeyhole className="h-4 w-4" />}
              required
              fullWidth
              inputSize="lg"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          )}

          {mode === 'signin' && (
            <div className="flex justify-end">
              <button type="button" className="text-sm font-medium text-[var(--action-primary)] hover:underline" onClick={() => switchMode('forgot')}>
                Quên mật khẩu?
              </button>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting || authState === 'loading'}>
            {submitting
              ? 'Đang xử lý...'
              : mode === 'signin'
                ? 'Đăng nhập'
                : mode === 'signup'
                  ? 'Tạo tài khoản'
                  : 'Gửi email khôi phục'}
          </Button>
        </form>

        {pendingVerificationEmail && (
          <Button type="button" variant="outline" size="md" className="w-full" disabled={resending} onClick={() => void resendVerification()}>
            {resending ? 'Đang gửi lại...' : 'Gửi lại email xác minh'}
          </Button>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-4 text-center">
          {mode === 'signin' && (
            <button type="button" className="text-sm font-medium text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signup')}>
              Chưa có tài khoản? Đăng ký
            </button>
          )}
          {mode === 'signup' && (
            <button type="button" className="text-sm font-medium text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signin')}>
              Đã có tài khoản? Đăng nhập
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="text-sm font-medium text-[var(--action-primary)] hover:underline" onClick={() => switchMode('signin')}>
              Quay lại đăng nhập
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
