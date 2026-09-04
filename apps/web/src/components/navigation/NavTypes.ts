import React from 'react';

export interface NavItem {
  href: string;
  labelVi: string;
  labelEn: string;
  iconName: string;
  isPrimary: boolean;
}

export const primaryNavItems: NavItem[] = [
  { href: '/today', labelVi: 'Hôm nay', labelEn: 'Today', iconName: 'Home', isPrimary: true },
  { href: '/read', labelVi: 'Đọc', labelEn: 'Read', iconName: 'BookOpen', isPrimary: true },
  { href: '/review', labelVi: 'Ôn tập', labelEn: 'Review', iconName: 'RotateCcw', isPrimary: true },
  { href: '/brain', labelVi: 'Brain', labelEn: 'Brain', iconName: 'Brain', isPrimary: true },
  { href: '/progress', labelVi: 'Tiến độ', labelEn: 'Progress', iconName: 'TrendingUp', isPrimary: true },
];

export const secondaryNavItems: NavItem[] = [
  { href: '/library', labelVi: 'Thư viện', labelEn: 'Library', iconName: 'Library', isPrimary: false },
  { href: '/dictionary', labelVi: 'Từ điển', labelEn: 'Dictionary', iconName: 'Search', isPrimary: false },
  { href: '/settings', labelVi: 'Cài đặt', labelEn: 'Settings', iconName: 'Settings', isPrimary: false },
  { href: '/profile', labelVi: 'Hồ sơ', labelEn: 'Profile', iconName: 'User', isPrimary: false },
];
