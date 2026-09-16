'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LiveOnboardingFlow } from '../../features/onboarding/LiveOnboardingFlow';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <main className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--canvas)] px-3 py-3 text-[var(--text-primary)] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent-teal-soft)]/70 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-[var(--surface-blue)] blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-white/80 shadow-[0_24px_80px_rgba(33,45,78,0.10)] backdrop-blur-sm sm:rounded-[32px]">
        <LiveOnboardingFlow navigate={(path) => router.push(path)} />
      </div>
    </main>
  );
}
