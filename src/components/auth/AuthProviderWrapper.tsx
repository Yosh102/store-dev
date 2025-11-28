'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/context/auth-context';
import { initializeApp, getApps } from 'firebase/app';
import { config } from '@/lib/config';

export default function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!getApps().length) {
      initializeApp(config.firebase);
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}

