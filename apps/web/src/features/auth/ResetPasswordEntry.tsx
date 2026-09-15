'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export function ResetPasswordEntry() {
  const router = useRouter();
  const { authState, isConfigured, updatePassword, signOut, clearError, error: authError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Hai mật khẩu chưa khớp nhau.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setMessage('Mật khẩu đã được cập nhật. Anh có thể tiếp tục dùng phiên hiện tại.');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn; hãy yêu cầu email khôi phục mới.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <Card variant="elevated" padding="lg" className="mx-auto max-w-md space-y-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Chưa cấu hình xác thực</h1>
        <p className="text-sm text-[var(--text-secondary)]">Không thể đặt lại mật khẩu ở môi trường này.</p>
      </Card>
    );
  }

  if (authState === 'loading') {
    return (
      <Card variant="elevated" padding="lg" className="mx-auto max-w-md">
        <p className="text-sm text-[var(--text-secondary)]">Đang xác minh phiên khôi phục...</p>
      </Card>
    );
  }

  if (authState !== 'authenticated') {
    return (
      <Card variant="elevated" padding="lg" className="mx-auto max-w-md space-y-4">
        <InlineAlert variant="danger" title="Phiên khôi phục không hợp lệ">
          Liên kết khôi phục đã hết hạn hoặc chưa tạo được phiên bảo mật.
        </InlineAlert>
        <Button variant="primary" className="w-full" onClick={() => router.replace('/auth')}>
          Yêu cầu liên kết mới
        </Button>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--action-primary)]">
          <ShieldCheck className="h-4 w-4" /> LINGUA OS Security
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đặt mật khẩu mới</h1>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Chọn mật khẩu mới cho tài khoản. Phiên recovery chỉ dùng để xác thực thao tác này.
        </p>
      </header>

      {(error || authError) && (
        <InlineAlert variant="danger" title="Không thể đổi mật khẩu">
          {error ?? 'Yêu cầu chưa hoàn tất. Vui lòng thử lại.'}
        </InlineAlert>
      )}
      {message && <InlineAlert variant="success" title="Đã cập nhật">{message}</InlineAlert>}

      <form className="space-y-4" onSubmit={submit}>
        <Input
          id="new-password"
          name="new-password"
          type="password"
          label="Mật khẩu mới"
          autoComplete="new-password"
          minLength={8}
          required
          fullWidth
          inputSize="lg"
          leftIcon={<LockKeyhole className="h-4 w-4" />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          helperText="Tối thiểu 8 ký tự."
        />
        <Input
          id="confirm-new-password"
          name="confirm-new-password"
          type="password"
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          minLength={8}
          required
          fullWidth
          inputSize="lg"
          leftIcon={<LockKeyhole className="h-4 w-4" />}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
        </Button>
      </form>

      <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row">
        <Button variant="outline" className="flex-1" onClick={() => router.push('/today')}>
          Tiếp tục học
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onClick={async () => {
            await signOut();
            router.replace('/auth');
          }}
        >
          Đăng xuất
        </Button>
      </div>
    </Card>
  );
}
