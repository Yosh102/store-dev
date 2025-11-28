// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import OrderSuccessClient from './OrderSuccessClient';

export const metadata: Metadata = {
  title: '注文完了 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <OrderSuccessClient />;
}