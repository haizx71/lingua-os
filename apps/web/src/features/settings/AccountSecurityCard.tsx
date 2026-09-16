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
      setMessage('Yêu cầu đổi email đã được gửi. Hãy kiểm tra hộp thư để hoàn tất xác minh.');
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
      setLocalError('Không thể kết nối hệ thống xác thực. Vui lòng thử lại sau.');
      return;
    }

    begin('delete');
    try {
      const { error } = await client.functions.invoke('delete-account', {
        body: { confirmationEmail: deleteConfirmation.trim() },
      });
      if (error) throw error;
      await client.auth.signOut({ scope: 'local' });
      window.location.assign('/auth');
    } catch {
      setLocalError('Không thể xóa tài khoản lúc này. Vui lòng thử lại sau.');
      finish();
    }
  };

  return (
    <Card variant="default" padding="lg" className="min-w-0 space-y-6 rounded-[26px]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-xl bg-[var(--status-info-bg)] p-2 text-[var(--action-primary)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Tài khoản & bảo mật</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Quản lý email, mật khẩu và các phiên đăng nhập của bạn.</p>
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

      <div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <Mail className="h-4 w-4 shrink-0" /> Email hiện tại
        </div>
        <p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">{user?.email ?? 'Chưa có email'}</p>
      </div>

      <form className="min-w-0 space-y-3 border-t border-[var(--border-subtle)] pt-5" onSubmit={changeEmail}>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Đổi email đăng nhập</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Chúng tôi sẽ gửi email xác minh trước khi cập nhật địa chỉ mới.</p>
        </div>
        <Input type="email" label="Email mới" autoComplete="email" fullWidth value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
        <Button className="w-full sm:w-auto" type="submit" variant="outline" size="md" isLoading={pending === 'email'} disabled={pending !== null}>Gửi yêu cầu đổi email</Button>
      </form>

      <form className="min-w-0 space-y-3 border-t border-[var(--border-subtle)] pt-5" onSubmit={changePassword}>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><KeyRound className="h-4 w-4 shrink-0" /> Đổi mật khẩu</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Mật khẩu mới cần có ít nhất 8 ký tự.</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Input type="password" label="Mật khẩu hiện tại" autoComplete="current-password" fullWidth value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <Input type="password" label="Mật khẩu mới" autoComplete="new-password" minLength={8} fullWidth value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </div>
        <Input type="password" label="Nhập lại mật khẩu mới" autoComplete="new-password" minLength={8} fullWidth value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        <Button className="w-full sm:w-auto" type="submit" variant="outline" size="md" isLoading={pending === 'password'} disabled={pending !== null}>Cập nhật mật khẩu</Button>
      </form>

      <div className="min-w-0 space-y-3 border-t border-[var(--border-subtle)] pt-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Phiên đăng nhập</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Chọn đăng xuất thiết bị này hoặc tất cả thiết bị đang đăng nhập.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" type="button" variant="outline" size="md" leftIcon={<LogOut className="h-4 w-4" />} isLoading={pending === 'logout-local'} disabled={pending !== null} onClick={() => void logout(false)}>Đăng xuất thiết bị này</Button>
          <Button className="w-full sm:w-auto" type="button" variant="outline" size="md" isLoading={pending === 'logout-all'} disabled={pending !== null} onClick={() => void logout(true)}>Đăng xuất tất cả thiết bị</Button>
        </div>
      </div>

      <div className="min-w-0 space-y-3 border-t border-[var(--status-danger,#E11D48)]/30 pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--status-danger,#E11D48)]"><Trash2 className="h-4 w-4 shrink-0" /> Xóa tài khoản</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Xóa tài khoản và dữ liệu học liên quan. Thao tác này không thể hoàn tác.</p>
        </div>
        <Input type="email" label="Nhập email hiện tại để xác nhận" placeholder={user?.email ?? ''} fullWidth value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
        <Button className="w-full sm:w-auto" type="button" variant="danger" size="md" isLoading={pending === 'delete'} disabled={pending !== null || !user?.email} onClick={() => void deleteAccount()}>Xóa vĩnh viễn tài khoản</Button>
      </div>
    </Card>
  );
}
