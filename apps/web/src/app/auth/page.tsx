'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthEntry } from '../../features/auth';

export default function AuthPage() {
  const router = useRouter();
  return <AuthEntry onAuthenticated={() => router.push('/onboarding')} />;
}
