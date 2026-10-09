'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LiveOnboardingFlow } from '../../features/onboarding/LiveOnboardingFlow';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <main className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--canvas)] px-3 py-3 text-[var(--text-primary)] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)] sm:rounded-[32px]">
        <LiveOnboardingFlow navigate={(path) => router.push(path)} />
      </div>
    </main>
  );
}
