// components/auth/AuthGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { validateAndUpdateSubscriptionStatus } from '@/services/user-service';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireEmailVerified?: boolean;
  groupId?: string;
}

export function AuthGuard({ 
  children, 
  requireAuth = false, 
  requireEmailVerified = false,
  groupId,
}: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [validatingSubscription, setValidatingSubscription] = useState(false);

  // 開発モード認証スキップ判定
  const isDevMode = process.env.NODE_ENV === 'development' && 
                   process.env.NEXT_PUBLIC_SKIP_AUTH_IN_DEV === 'true';

  // トップページは常にスキップ
  const isTopPage = pathname === '/';

  useEffect(() => {
    if (loading) return;

    // 開発 or トップページならチェックをスキップ
    if (isDevMode || isTopPage) {
      if (isDevMode) console.log('🔧 Development mode: Skipping AuthGuard checks');
      return;
    }

    if (requireAuth && !user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (requireEmailVerified && (!user || !user.emailVerified)) {
      router.push('/verify-email');
      return;
    }

    if (groupId && user) {
      setValidatingSubscription(true);
      validateAndUpdateSubscriptionStatus(user.uid, groupId)
        .finally(() => setValidatingSubscription(false));
    }
  }, [user, loading, requireAuth, requireEmailVerified, router, groupId, isDevMode, isTopPage]);

  // 開発モードまたはトップページでは即レンダー
  if (isDevMode || isTopPage) {
    return <>{children}</>;
  }

  // ローディング中・検証中
  if (
    loading ||
    validatingSubscription ||
    (requireAuth && !user) ||
    (requireEmailVerified && (!user || !user.emailVerified))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          {/* インジケーターを太く変更 */}
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 text-sm sm:text-base">
            {validatingSubscription ? 'サブスクリプションを確認中...' : '認証を確認中...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
