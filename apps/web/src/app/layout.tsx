import React from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../features/auth';
import { AppRouteBoundary } from '../components/auth/AppRouteBoundary';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'LINGUA OS — Adaptive Language Learning',
  description: 'Hệ thống học ngôn ngữ thích nghi tối ưu cho người Việt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={beVietnamPro.className}>
        <AuthProvider>
          <AppRouteBoundary>{children}</AppRouteBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
