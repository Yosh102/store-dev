// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import AddressManager from './AddressClient';

export const metadata: Metadata = {
  title: '住所 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <AddressManager />;
}