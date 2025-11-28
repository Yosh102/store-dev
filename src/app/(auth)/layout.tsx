// app/(auth)/layout.tsx
import React from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'メール認証をお願いします | PLAY TUNE オフィシャルサイト',
    description: 'アカウント登録を完了するためのメール認証ページです。',
    robots: 'noindex',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ログインが必要（メール認証不要）のレイアウト
  return (
    <AuthGuard requireAuth={true}>
      {children}
    </AuthGuard>
  );
}