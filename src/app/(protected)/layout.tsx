// app/(protected)/layout.tsx
import React from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';

// 開発時はガードを外す。必要に応じて NEXT_PUBLIC_BYPASS_AUTH=true でも外せる
const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isDev) {
    // Development / Bypass: そのまま表示（未ログインでも見える）
    return <>{children}</>;
  }

  return (
    <AuthGuard requireAuth={true} requireEmailVerified={true}>
      {children}
    </AuthGuard>
  );
}
