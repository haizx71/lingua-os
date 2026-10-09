import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountSecurityCard } from '@/features/settings/AccountSecurityCard';

const authMock = vi.hoisted(() => ({
  user: { email: 'learner@example.test' },
  error: null,
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
  signOutEverywhere: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock('../../apps/web/src/features/auth/AuthContext', () => ({
  useOptionalAuth: () => authMock,
}));

describe('AccountSecurityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses distinct password labels and learner-facing security copy', () => {
    render(<AccountSecurityCard />);

    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu hiện tại để xóa tài khoản')).toBeInTheDocument();
    expect(screen.queryByText(/Supabase|LINGUA API|cascade|identity/i)).not.toBeInTheDocument();
    expect(screen.getByText(/dữ liệu học tập được liên kết/i)).toBeInTheDocument();
  });

  it('requires the account email and current password before requesting deletion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    render(<AccountSecurityCard />);

    const deleteButton = screen.getByRole('button', { name: 'Xóa vĩnh viễn tài khoản' });
    fireEvent.click(deleteButton);
    expect(screen.getByText(/Nhập đúng email hiện tại/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nhập email hiện tại để xác nhận'), { target: { value: 'other@example.test' } });
    fireEvent.click(deleteButton);
    expect(screen.getByText(/Nhập đúng email hiện tại/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nhập email hiện tại để xác nhận'), { target: { value: 'learner@example.test' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại để xóa tài khoản'), { target: { value: 'synthetic-current-password' } });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        confirmationEmail: 'learner@example.test',
        currentPassword: 'synthetic-current-password',
      }),
    }));
    expect(await screen.findByText(/Không thể xóa tài khoản/i)).toBeInTheDocument();
  });
});
