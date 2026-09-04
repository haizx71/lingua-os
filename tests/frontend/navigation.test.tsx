import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesktopSidebar } from '../../apps/web/src/components/navigation/DesktopSidebar';
import { MobileBottomNav } from '../../apps/web/src/components/navigation/MobileBottomNav';
import { AppShell } from '../../apps/web/src/components/navigation/AppShell';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Application Shell & Navigation Foundation', () => {
  describe('Desktop Sidebar Navigation', () => {
    it('renders all 5 primary MVP routes and secondary routes including Profile', () => {
      render(<DesktopSidebar currentPath="/today" />);

      // Primary routes
      expect(screen.getByRole('link', { name: /Hôm nay/i })).toHaveAttribute('href', '/today');
      expect(screen.getByRole('link', { name: /Đọc/i })).toHaveAttribute('href', '/read');
      expect(screen.getByRole('link', { name: /Ôn tập/i })).toHaveAttribute('href', '/review');
      expect(screen.getByRole('link', { name: /Brain/i })).toHaveAttribute('href', '/brain');
      expect(screen.getByRole('link', { name: /Tiến độ/i })).toHaveAttribute('href', '/progress');

      // Secondary routes
      expect(screen.getByRole('link', { name: /Thư viện/i })).toHaveAttribute('href', '/library');
      expect(screen.getByRole('link', { name: /Từ điển/i })).toHaveAttribute('href', '/dictionary');
      expect(screen.getByRole('link', { name: /Cài đặt/i })).toHaveAttribute('href', '/settings');
      expect(screen.getByRole('link', { name: /Xem hồ sơ người học/i })).toHaveAttribute('href', '/profile');
    });

    it('marks active navigation item with aria-current="page"', () => {
      render(<DesktopSidebar currentPath="/today" />);
      const activeLink = screen.getByRole('link', { name: /Hôm nay/i });
      expect(activeLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Mobile Bottom Navigation', () => {
    it('renders strictly the 5 primary MVP navigation items', () => {
      render(<MobileBottomNav />);
      const navLinks = screen.getAllByRole('link');
      expect(navLinks).toHaveLength(5);

      const hrefs = navLinks.map((link) => link.getAttribute('href'));
      expect(hrefs).toEqual(['/today', '/read', '/review', '/brain', '/progress']);
    });
  });

  describe('AppShell Focus Mode', () => {
    it('renders content in focus mode without sidebar and bottom nav', () => {
      render(
        <AppShell focusMode={true}>
          <div data-testid="focus-content">Nội dung học tập tập trung</div>
        </AppShell>
      );

      expect(screen.getByTestId('focus-content')).toBeInTheDocument();
      expect(screen.queryByLabelText('Điều hướng chính di động')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Điều hướng màn hình lớn')).not.toBeInTheDocument();
    });
  });
});
