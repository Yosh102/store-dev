// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import CouponsClient from './CouponsClient';

export const metadata: Metadata = {
  title: 'クーポン | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <CouponsClient />;
}