// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = {
  title: 'カート | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <CheckoutClient />;
}