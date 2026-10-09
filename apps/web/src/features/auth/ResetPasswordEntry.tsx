'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import { ArrowRight, BookOpen, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

function ResetAuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-[var(--canvas)] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-5 flex items-center gap-3 sm:mb-6">
          <Image src="/assets/lingua-mark.png" alt="" width={42} height={42} priority className="h-10 w-10 shrink-0 rounded-full" />
          <div>
            <div className="text-base font-extrabold tracking-[-0.025em] text-[var(--text-primary)]">LINGUA OS</div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">Học theo nhịp của bạn</div>
          </div>
        </header>
        <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-7">
          <section className="flex min-w-0 items-center rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6 lg:min-h-[620px] lg:rounded-[28px] lg:p-10">
            {children}
          </section>
          <aside className="relative hidden min-w-0 flex-col justify-between overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] p-7 lg:flex lg:min-h-[620px] xl:p-9" aria-label="LINGUA OS">
            <div>
              <p className="lingua-kicker text-[var(--action-primary)]">Tài khoản của bạn</p>
              <h2 className="mt-3 max-w-md text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)]">Tiếp tục học cùng những câu chuyện mới.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Giữ tài khoản an toàn để bạn tiếp tục đọc, tra từ và ôn tập theo nhịp của mình.</p>
            </div>
            <Image src="/assets/reader-tea-book.png" alt="Tách trà và quyển sách" width={1492} height={1054} className="mx-auto my-5 w-full max-w-[480px] object-contain" />
            <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-4 text-sm font-semibold text-[var(--text-secondary)]"><BookOpen className="h-4 w-4 text-[var(--action-primary)]" aria-hidden="true" /> Đọc ngữ cảnh, học từ mới</div>
          </aside>
        </div>
        <footer className="mt-5 flex flex-col gap-2 px-1 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Giữ thông tin đăng nhập của bạn an toàn.</span>
          <span className="font-semibold text-[var(--text-secondary)]">LINGUA OS</span>
        </footer>
      </div>
    </main>
  );
}

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
      setMessage('Mật khẩu đã được cập nhật. Bạn có thể tiếp tục sử dụng tài khoản.');
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
      <ResetAuthFrame>
        <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md space-y-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Đặt lại mật khẩu chưa sẵn sàng</h1>
          <p className="text-sm text-[var(--text-secondary)]">Bạn chưa thể đặt lại mật khẩu lúc này.</p>
        </Card>
      </ResetAuthFrame>
    );
  }

  if (authState === 'loading') {
    return (
      <ResetAuthFrame>
        <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md">
          <p className="text-sm text-[var(--text-secondary)]">Đang kiểm tra đường dẫn khôi phục...</p>
        </Card>
      </ResetAuthFrame>
    );
  }

  if (authState !== 'authenticated') {
    return (
      <ResetAuthFrame>
        <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md space-y-4">
        <InlineAlert variant="danger" title="Liên kết không còn hợp lệ">
          Liên kết này đã hết hạn hoặc không còn hợp lệ. Hãy yêu cầu liên kết mới.
        </InlineAlert>
        <Button variant="primary" className="w-full" onClick={() => router.replace('/auth')}>
          Đến trang đăng nhập
        </Button>
        </Card>
      </ResetAuthFrame>
    );
  }

  return (
    <ResetAuthFrame>
      <Card variant="elevated" padding="lg" className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--action-primary)]">
            <ShieldCheck className="h-4 w-4" /> Bảo mật tài khoản
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đặt mật khẩu mới</h1>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Tạo mật khẩu mới để tiếp tục sử dụng tài khoản.
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
        <Button type="submit" variant="primary" size="lg" className="min-h-[48px] w-full" rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined} disabled={submitting}>
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
    </ResetAuthFrame>
  );
}
