import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { MockApiClient } from '@lingua/types';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { TabletRail } from '@/components/navigation/TabletRail';
import { AppShell } from '@/components/navigation/AppShell';
import { renderWithProviders } from '../harness/test-render';
import { setApiClient } from '@/lib/api/client';

vi.mock('next/link', () => ({
  default: ({ children, href, 'aria-current': ariaCurrent, ...rest }: any) => (
    <a href={href} aria-current={ariaCurrent} {...rest}>
      {children}
    </a>
  ),
}));

describe('Tier 1: Feature 04 - App Shell & Responsive Navigation', () => {
  afterEach(() => {
    setApiClient(new MockApiClient());
    vi.unstubAllEnvs();
  });

  it('test_desktop_sidebar_renders_exactly_5_primary_mvp_routes', () => {
    renderWithProviders(<DesktopSidebar currentPath="/today" />);

    const desktop = screen.getByRole('complementary', { name: 'Điều hướng màn hình lớn' });
    const mainNavigation = within(desktop).getByRole('navigation', { name: 'Menu chính' });
    const todayLink = within(mainNavigation).getByRole('link', { name: /Hôm nay/i });
    const readLink = within(mainNavigation).getByRole('link', { name: /Đọc/i });
    const reviewLink = within(mainNavigation).getByRole('link', { name: /Ôn tập/i });
    const brainLink = within(mainNavigation).getByRole('link', { name: /Brain/i });
    const progressLink = within(mainNavigation).getByRole('link', { name: /Tiến độ/i });

    expect(todayLink).toHaveAttribute('href', '/today');
    expect(readLink).toHaveAttribute('href', '/read');
    expect(reviewLink).toHaveAttribute('href', '/review');
    expect(brainLink).toHaveAttribute('href', '/brain');
    expect(progressLink).toHaveAttribute('href', '/progress');
  });

  it('test_desktop_sidebar_renders_secondary_routes', () => {
    renderWithProviders(<DesktopSidebar currentPath="/library" />);
    const desktop = screen.getByRole('complementary', { name: 'Điều hướng màn hình lớn' });
    const exploreNavigation = within(desktop).getByRole('navigation', { name: 'Khám phá và cài đặt' });

    expect(within(exploreNavigation).getByRole('link', { name: /Thư viện/i })).toHaveAttribute('href', '/library');
    expect(within(exploreNavigation).getByRole('link', { name: /Từ điển/i })).toHaveAttribute('href', '/dictionary');
    expect(within(exploreNavigation).getByRole('link', { name: /Cài đặt/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: /Mở hồ sơ người học/i })).toHaveAttribute('href', '/profile');
  });

  it('test_active_route_is_marked_with_aria_current_page', () => {
    renderWithProviders(<DesktopSidebar currentPath="/review" />);
    const desktop = screen.getByRole('complementary', { name: 'Điều hướng màn hình lớn' });
    const mainNavigation = within(desktop).getByRole('navigation', { name: 'Menu chính' });
    const reviewLink = within(mainNavigation).getByRole('link', { name: /Ôn tập/i });
    expect(reviewLink).toHaveAttribute('aria-current', 'page');

    const todayLink = within(mainNavigation).getByRole('link', { name: /Hôm nay/i });
    expect(todayLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('test_mobile_bottom_nav_renders_all_5_primary_tabs_with_accessible_labels', () => {
    renderWithProviders(<MobileBottomNav />);
    const navElement = screen.getByRole('navigation', { name: /Điều hướng chính di động/i });
    expect(navElement).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/today', '/read', '/review', '/brain', '/progress']);
  });

  it('test_app_shell_focus_mode_hides_navigation_bars', () => {
    renderWithProviders(
      <AppShell focusMode={true}>
        <div data-testid="focus-view">Chế độ tập trung học</div>
      </AppShell>
    );

    expect(screen.getByTestId('focus-view')).toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng chính di động')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Điều hướng màn hình lớn')).not.toBeInTheDocument();
  });

  it('marks local mock-transport content as sample data', async () => {
    vi.stubEnv('APP_ENV', 'test');
    setApiClient(new MockApiClient());
    const local = renderWithProviders(<AppShell><div>Local preview route</div></AppShell>);
    expect(await screen.findByRole('note')).toHaveTextContent('Bản xem trước');
    expect(screen.getByRole('note')).toHaveTextContent('Dữ liệu minh họa không thuộc tài khoản của bạn.');

    local.unmount();
    vi.stubEnv('APP_ENV', 'production');
    setApiClient(new MockApiClient());
    renderWithProviders(<AppShell><div>Hosted route</div></AppShell>);
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
  });

  it('test_tablet_rail_renders_compact_icon_navigation', () => {
    renderWithProviders(<TabletRail currentPath="/brain" />);
    const railNav = screen.getByRole('complementary', { name: /Điều hướng thanh bên thu gọn/i });
    expect(railNav).toBeInTheDocument();

    const brainLink = screen.getByRole('link', { name: /Brain/i });
    expect(brainLink).toHaveAttribute('aria-current', 'page');
  });
});
