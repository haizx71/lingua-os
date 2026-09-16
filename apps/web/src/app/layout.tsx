import React from 'react';
import './globals.css';
import { AuthProvider } from '../features/auth';
import { AppRouteBoundary } from '../components/auth/AppRouteBoundary';

export const metadata = {
  title: 'LINGUA OS — Adaptive Language Learning',
  description: 'Hệ thống học ngôn ngữ thích nghi tối ưu cho người Việt',
};

const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('lingua-theme') || 'light';
    var useDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthProvider>
          <AppRouteBoundary>{children}</AppRouteBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
