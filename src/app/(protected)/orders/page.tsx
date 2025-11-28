// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import OrdersClient from './OrdersClient';

export const metadata: Metadata = {
  title: '注文履歴 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
  robots: 'noindex',
};

export default function CartPage() {
  return <OrdersClient />;
}