import { Suspense } from 'react';
import { Metadata } from 'next';
import SubscriptionsList from '@/components/subscriptions/SubscriptionsList';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'サブスクリプション管理',
  description: 'サブスクリプションの確認、更新、解約ができます',
};

// ローディング中のSkeletonコンポーネント
function SubscriptionsLoading() {
  return (
    <div className="w-full space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-start">
              <Skeleton className="h-16 w-16 rounded-lg mr-4" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <div>
                    <Skeleton className="h-6 w-[180px] mb-2" />
                    <Skeleton className="h-4 w-[120px]" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-1">
                <Skeleton className="h-4 w-[140px]" />
                <Skeleton className="h-4 w-[120px]" />
              </div>
              <div className="flex justify-between items-center py-1">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[160px]" />
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 md:px-8">
      <h1 className="text-2xl font-bold mb-6">サブスクリプション管理</h1>
      <Suspense fallback={<SubscriptionsLoading />}>
        <SubscriptionsList />
      </Suspense>
    </div>
  );
}
