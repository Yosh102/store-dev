// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import SubscriptionSuccessClient from './SubscriptionSuccessClient';

export const metadata: Metadata = {
  title: '登録完了 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <SubscriptionSuccessClient />;
}