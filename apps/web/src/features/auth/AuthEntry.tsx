'use client';

import React, { useState } from 'react';
import { Card, Button, InlineAlert } from '@lingua/ui';
import { useAuth } from './AuthContext';

export interface AuthEntryProps {
  readonly onAuthenticated?: () => void;
}

export function AuthEntry({ onAuthenticated }: AuthEntryProps) {
  const { authState, isConfigured, error: authError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      if (mode === 'signup' && !result.session) {
        setMessage('Tài khoản đã được ghi nhận. Hãy xác minh email trước khi tiếp tục.');
      } else {
        setMessage('Đăng nhập thành công. Đang mở phần khởi tạo lộ trình.');
        onAuthenticated?.();
      }
    } catch {
      setError('Không thể hoàn tất xác thực. Vui lòng kiểm tra email, mật khẩu và thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <Card variant="elevated" padding="lg" className="max-w-md mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Chào mừng đến LINGUA OS</h1>
        <p className="text-sm text-[var(--text-secondary)]">Xác thực email/mật khẩu chưa được cấu hình cho môi trường này.</p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="lg" className="max-w-md mx-auto space-y-6">
      <header className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">LINGUA OS</span>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
        <p className="text-sm text-[var(--text-secondary)]">Học tiếng Anh theo nhịp phù hợp với bạn.</p>
      </header>
      {(error || authError) && <InlineAlert variant="danger" title="Không thể xác thực">{error ?? 'Vui lòng thử lại.'}</InlineAlert>}
      {message && <InlineAlert variant="success" title="Đã tiếp nhận">{message}</InlineAlert>}
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <label htmlFor="auth-email" className="text-sm font-medium text-[var(--text-primary)]">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
        </div>
        <div className="space-y-2">
          <label htmlFor="auth-password" className="text-sm font-medium text-[var(--text-primary)]">Mật khẩu</label>
          <input id="auth-password" name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting || authState === 'loading'}>
          {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
        </Button>
      </form>
      <button type="button" className="w-full text-sm text-[var(--action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] rounded-lg py-2" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null); setError(null); }}>
        {mode === 'signin' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </Card>
  );
}
