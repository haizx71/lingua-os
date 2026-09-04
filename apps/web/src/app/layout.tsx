import React from 'react';
import './globals.css';
import { AuthProvider } from '../features/auth';
import { AppRouteBoundary } from '../components/auth/AppRouteBoundary';

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
      <body>
        <AuthProvider>
          <AppRouteBoundary>{children}</AppRouteBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
