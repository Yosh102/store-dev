// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import WalletClient from './WalletClient';

export const metadata: Metadata = {
  title: 'ウォレット | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
  robots: 'noindex',
};

export default function CartPage() {
  return <WalletClient />;
}