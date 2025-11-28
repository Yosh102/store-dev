// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'お問い合わせ | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function CartPage() {
  return <ContactClient />;
}