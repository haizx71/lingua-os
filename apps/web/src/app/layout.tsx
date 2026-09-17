import React from 'react';
import { Be_Vietnam_Pro, Inter, Lexend, Noto_Serif } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../features/auth';
import { AppRouteBoundary } from '../components/auth/AppRouteBoundary';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

const lexend = Lexend({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-lexend',
});

const notoSerif = Noto_Serif({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-noto-serif',
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
      <body
        className={`${beVietnamPro.className} ${beVietnamPro.variable} ${inter.variable} ${lexend.variable} ${notoSerif.variable}`}
      >
        <AuthProvider>
          <AppRouteBoundary>{children}</AppRouteBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
