'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert, Input } from '@lingua/ui';
import { KeyRound, LogOut, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getBrowserSupabaseClient } from '../../lib/supabase/client';

export function AccountSecurityCard() {
  const {
    user,
    error: authError,
    updateEmail,
    updatePassword,
    signOut,
    signOutEverywhere,
    clearError,
  } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const begin = (operation: string) => {
    clearError();
    setLocalError(null);
    setMessage(null);
    setPending(operation);
  };

  const finish = () => setPending(null);

  const changeEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    if (!normalized || normalized === user?.email?.toLowerCase()) {
      setLocalError('Hãy nhập một địa chỉ email mới.');
      return;
    }
    begin('email');
    try {
      await updateEmail(normalized);
      setNewEmail('');
      setMessage('Yêu cầu đổi email đã được gửi. Hãy hoàn tất các bước xác minh Supabase gửi tới hộp thư liên quan.');
    } catch {
      setLocalError('Chưa thể đổi email lúc này. Vui lòng kiểm tra địa chỉ email và thử lại.');
    } finally {
      finish();
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setLocalError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Hai mật khẩu mới chưa khớp nhau.');
      return;
    }
    begin('password');
    try {
      await updatePassword(newPassword, currentPassword || undefined);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Mật khẩu đã được cập nhật.');
    } catch {
      setLocalError('Chưa thể đổi mật khẩu. Hãy kiểm tra mật khẩu hiện tại hoặc thử lại sau.');
    } finally {
      finish();
    }
  };

  const logout = async (everywhere: boolean) => {
    begin(everywhere ? 'logout-all' : 'logout-local');
    try {
      if (everywhere) await signOutEverywhere();
      else await signOut();
      window.location.assign('/auth');
    } finally {
      finish();
    }
  };

  const deleteAccount = async () => {
    const email = user?.email?.trim().toLowerCase() ?? '';
    if (!email || deleteConfirmation.trim().toLowerCase() !== email) {
      setLocalError('Nhập đúng email hiện tại để xác nhận xóa tài khoản.');
      return;
    }

    const client = getBrowserSupabaseClient();
    if (!client) {
      setLocalError('Supabase Auth chưa được cấu hình.');
      return;
    }

    begin('delete');
    try {
      const { error } = await client.functions.invoke('delete-account', {
        body: { confirmationEmail: deleteConfirmation.trim() },
      });
      if (error) throw error;

      // The server removes the identity and cascades learner data. Clear the
      // browser copy of the session as a separate local action afterwards.
      await client.auth.signOut({ scope: 'local' });
      window.location.assign('/auth');
    } catch {
      setLocalError('Không thể xóa tài khoản. Không có dữ liệu nào được coi là đã xóa nếu máy chủ chưa xác nhận.');
      finish();
    }
  };

  return (
    <Card variant="default" padding="lg" className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[var(--status-info-bg)] p-2 text-[var(--action-primary)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Tài khoản & bảo mật</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Identity do Supabase Auth quản lý; hồ sơ học tập và quyền dữ liệu vẫn do LINGUA API kiểm soát.
          </p>
        </div>
      </div>

      {(localError || authError) && (
        <InlineAlert variant="danger" title="Không thể hoàn tất thao tác">
          {localError ?? 'Yêu cầu xác thực chưa thành công.'}
        </InlineAlert>
      )}
      {message && (
        <InlineAlert variant="success" title="Đã cập nhật">
          {message}
        </InlineAlert>
      )}

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <Mail className="h-4 w-4" /> Email hiện tại
        </div>
        <p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">{user?.email ?? 'Chưa có email'}</p>
      </div>

      <form className="space-y-3 border-t border-[var(--border-subtle)] pt-5" onSubmit={changeEmail}>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Đổi email đăng nhập</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Email mới chỉ trở thành identity chính sau khi hoàn tất xác minh theo chính sách Supabase.</p>
        </div>
        <Input
          type="email"
          label="Email mới"
          autoComplete="email"
          fullWidth
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          required
        />
        <Button type="submit" variant="outline" size="md" isLoading={pending === 'email'} disabled={pending !== null}>
          Gửi yêu cầu đổi email
        </Button>
      </form>

      <form className="space-y-3 border-t border-[var(--border-subtle)] pt-5" onSubmit={changePassword}>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><KeyRound className="h-4 w-4" /> Đổi mật khẩu</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">LINGUA không lưu mật khẩu; việc kiểm tra và cập nhật được Supabase Auth thực hiện.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="password" label="Mật khẩu hiện tại" autoComplete="current-password" fullWidth value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <Input type="password" label="Mật khẩu mới" autoComplete="new-password" minLength={8} fullWidth value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </div>
        <Input type="password" label="Nhập lại mật khẩu mới" autoComplete="new-password" minLength={8} fullWidth value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        <Button type="submit" variant="outline" size="md" isLoading={pending === 'password'} disabled={pending !== null}>
          Cập nhật mật khẩu
        </Button>
      </form>

      <div className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Phiên đăng nhập</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Đăng xuất thiết bị hiện tại không làm gián đoạn các thiết bị khác.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="md" leftIcon={<LogOut className="h-4 w-4" />} isLoading={pending === 'logout-local'} disabled={pending !== null} onClick={() => void logout(false)}>
            Đăng xuất thiết bị này
          </Button>
          <Button type="button" variant="outline" size="md" isLoading={pending === 'logout-all'} disabled={pending !== null} onClick={() => void logout(true)}>
            Đăng xuất tất cả thiết bị
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--status-danger,#E11D48)]/30 pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--status-danger,#E11D48)]"><Trash2 className="h-4 w-4" /> Xóa tài khoản</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Thao tác này xóa identity Supabase và dữ liệu người học liên kết bằng cascade. Không thể hoàn tác.</p>
        </div>
        <Input
          type="email"
          label="Nhập email hiện tại để xác nhận"
          placeholder={user?.email ?? ''}
          fullWidth
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
        />
        <Button type="button" variant="danger" size="md" isLoading={pending === 'delete'} disabled={pending !== null || !user?.email} onClick={() => void deleteAccount()}>
          Xóa vĩnh viễn tài khoản
        </Button>
      </div>
    </Card>
  );
}
