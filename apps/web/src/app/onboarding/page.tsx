'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LiveOnboardingFlow } from '../../features/onboarding/LiveOnboardingFlow';

export default function OnboardingPage() {
  const router = useRouter();
  return <LiveOnboardingFlow navigate={(path) => router.push(path)} />;
}
