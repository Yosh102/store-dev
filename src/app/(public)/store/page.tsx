// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import StoreClient from './StoreClient';

export const metadata: Metadata = {
  title: 'ストア | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function CartPage() {
  return <StoreClient />;
}