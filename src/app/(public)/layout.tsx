// app/(public)/layout.tsx
import React from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>
  
  {children}</AuthGuard>;
}